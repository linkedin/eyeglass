"use strict";
import debugGenerator = require("debug");
import * as path from "path";
import fs = require("fs-extra");
import RSVP = require("rsvp");
import mkdirp = require("mkdirp");
import BroccoliPlugin = require("broccoli-plugin");
import glob = require("glob");
import FSTree = require("fs-tree-diff");
import walkSync = require("walk-sync");
import queue = require("async-promise-queue");
import ensureSymlink = require("ensure-symlink");
import * as nodeSass from "node-sass";
import copyObject = require("lodash.clonedeep");
import MergeTrees = require("broccoli-merge-trees");
import { EventEmitter } from "chained-emitter";
import DiskCache = require("sync-disk-cache");
import heimdall = require("heimdalljs");
import {statSync} from "fs";
import {determineOptimalConcurrency} from "./concurrency";

const concurrency = RSVP.resolve(determineOptimalConcurrency());

const debug = debugGenerator("broccoli-eyeglass");
const hotCacheDebug = debugGenerator("broccoli-eyeglass:hot-cache");
const concurrencyDebug = debug.extend("concurrency");

let sass: typeof nodeSass;
let renderSass: (options: nodeSass.Options) => Promise<nodeSass.Result>;

type SassPromiseRenderer =
  ((options: nodeSass.Options) => Promise<nodeSass.Result>)
  | ((options: nodeSass.SyncOptions) => Promise<nodeSass.Result>);

interface CachedContents {
  contents: Record<string, string>;
  urls: Record<string, string>;
}

type CachedDependencies = Array<[string, string]>;

function initSass(): void {
  if (!sass) {
    sass = nodeSass;
    // Standard async rendering for node-sass.
    renderSass = RSVP.denodeify(sass.render);
  }
}

function absolutizeEntries(entries: Array<Entry>): void {
  // We make everything absolute because relative path comparisons don't work for us.
  entries.forEach(entry => {
    // TODO support windows paths
    entry.relativePath = path.join(entry.basePath, entry.relativePath);
    entry.basePath = "/";
  });
}

function shouldPersist(env: typeof process.env, persist: boolean): boolean {
  let result: string | boolean | undefined;

  if (env.CI) {
    result = env.FORCE_PERSISTENCE_IN_CI;
  } else {
    result = persist;
  }

  return !!result;
}

class Entry {
  relativePath: string;
  basePath: string;
  mode: number;
  size: number;
  mtime: number | Date;
  constructor(path: string) {
    let stats = fs.statSync(path);
    this.relativePath = path;
    this.basePath = "/";
    this.mode = stats.mode;
    this.size = stats.size;
    this.mtime = stats.mtime;
  }

  isDirectory(): boolean {
    return false;
  }
}

function unique(array: Array<string>): Array<string> {
  return new Array(...new Set(array));
}

// This promise runs sass synchronously
function renderSassSync(options: nodeSass.SyncOptions): Promise<nodeSass.Result> {
  return RSVP.resolve(sass.renderSync(options));
}

function removePathPrefix(prefix: string, fileNames: Array<string>): Array<string> {
  if (prefix[prefix.length - 1] !== path.sep) {
    prefix = prefix + path.sep;
  }
  let newFileNames = new Array<string>();
  for (let i = 0; i < fileNames.length; i++) {
    if (fileNames[i].indexOf(prefix) === 0) {
      newFileNames[i] = fileNames[i].substring(prefix.length);
    } else {
      newFileNames[i] = fileNames[i];
    }
  }
  return newFileNames;
}

export interface CompilationDetails {
  /**
   * The directory to which the sassFilename is relative.
   */
  srcPath: string;
  /**
   * The path of the sass file being compiled (relative to srcPath).
   */
  sassFilename: string;
  /**
   * The absolute path of the Sass file.
   */
  fullSassFilename: string;
  /**
   * The directory where compiled css files are being written.
   */
  destDir: string;
  /**
   * The CSS filename relative to the destDir.
   */
  cssFilename: string;
  /**
   * The absolute path of the CSS file.
   * (note: the file is not there yet, obviously)
   */
  fullCssFilename: string;
  /**
   * The options that will be used to compile the file.
   */
  options: nodeSass.Options;
}

interface GenericCache {
  get(key: string): string | number | undefined;
  set(key: string, value: string | number): void;
}

export interface BroccoliSassOptions extends BroccoliPlugin.BroccoliPluginOptions {
  /**
   * The directory to write css files to. Relative to the build output directory.
   */
  cssDir: string;
  /**
   * When `true`, will discover sass files to compile that are found in the sass
   * directory. Defaults to true unless sourceFiles are specified.
   * Files beginning with an underscore are called "partials" and are not
   * discovered.
   */
  discover?: boolean;
  /**
   * The directory to look for scss files to compile. Defaults to tree root.
   *
   */
  sassDir?: string;

  /**
   * Force sass rendering to use node-sass's synchronous rendering.
   * Defaults to * `false`.
   *
   */
  renderSync?: boolean;
  /**
   * Array of file names or glob patterns (relative to the sass directory) that
   * should be compiled. Note that file names must include the file extension
   * (unlike @import in Sass). E.g.: ['application.scss']
   *
   */
  sourceFiles?: Array<string>;

  /**
   * Set to the name of your application so that your cache is isolated from
   * other broccoli-eyeglass based builds. When falsy, persistent caching is
   * disabled.
   */
  persistentCache?: string;

  /**
   * Integer. Set to the maximum number of listeners your use of eyeglass
   * compiler needs. Defaults to 10. Note: do not set
   * eyeglassCompiler.events.setMaxListeners() yourself as eyeglass has its own
   * listeners it uses internally.
   *
   */
  maxListeners?: number;

  /**
   * @see OptionsGenerator
   */
  optionsGenerator?: OptionsGenerator;
  /**
   * NOT YET IMPLEMENTED
   */
  fullException?: boolean;
  /**
   * When true, console logging will occur for each css file that is built
   * along with timing information.
   */
  verbose?: boolean;
  /**
   * This is a cache that can be provided to cache across multiple instances of
   * BroccoliSassCompiler. It can be a map, or some other cache store like
   * like the memory capped lru-cache. Only strings and numbers will be placed
   * as values in the cache.
   *
   * It is the responsibility of the caller to clear the session cache between
   * calls to build(). Failure to do so will cause inconsistent build output.
   *
   * If a session cache is not provided, a short lived cache will be used locally
   * for a single build's duration of one tree.
   */
  sessionCache?: GenericCache;
}

type OptionsGeneratorCallback = (cssFile: string, options: nodeSass.Options) => void;
/**
 * @param sassFile the sass file that will be compiled.
 * @param cssFile the default location where the css output will be written.
 *   This can be overridden by passing a different path to the callback.
 * @param options The options that eyeglass will be given. These can be mutated.
 *   Note: the options `file`, `data`, and `outFile` are not set and cannot be
 *   set in the options generator.
 * @param cb This callback accepts a css filename and options to use for
 *   compilation. This callback can be invoked 0 or more times. Each time it is
 *   invoked, the sass file will be compiled to the provided css file name
 *   (relative to the output directory) and the options provided.
 */
// TODO: statically forbid file, data, and outFile
type OptionsGenerator = (sassFile: string, cssFile: string, options: nodeSass.Options, cb: OptionsGeneratorCallback) => unknown;

// sassFile: The sass file being compiled
// cssFile: The default css file location.
// cb: This callback must be invoked once for each time you want to compile the
//     sass file. It must be called synchronously. You can change the output
//     filename and options passed to it.
const defaultOptionsGenerator: OptionsGenerator = (
  _sassFile: string,
  cssFile: string,
  options: nodeSass.Options,
  cb: OptionsGeneratorCallback
): ReturnType<OptionsGeneratorCallback> => cb(cssFile, options);


// Support for older versions of node.
function parsePath(pathname: string): path.ParsedPath {
  if (path.parse) {
    return path.parse(pathname);
  } else {
    let parsed: path.ParsedPath = {
      root: "",
      name: "",
      dir: path.dirname(pathname),
      base: path.basename(pathname),
      ext: path.extname(pathname),
    };
    parsed.name = parsed.base.substring(0, parsed.base.length - parsed.ext.length);
    return parsed;
  }
}

function formatPath(parsed: path.ParsedPath): string {
  if (path.format) {
    return path.format(parsed);
  } else {
    return path.join(parsed.dir, parsed.name + parsed.ext);
  }
}

function forbidNodeSassOption(options: nodeSass.Options, property: keyof nodeSass.Options): void {
  if (options[property]) {
    throw new Error(`The node-sass option '${property}' cannot be set explicitly.`);
  }
}

/* write data to cachedFile, and symlink outputFile to that
 *
 * @argument cachedFile - the file to write the data to
 * @argument outputFile - where to write the symlink
 * @argument data - the data to write
 */
function writeDataToFile(cachedFile: string, outputFile: string, data: Buffer): void {
  mkdirp.sync(path.dirname(cachedFile));
  fs.writeFileSync(cachedFile, data);

  mkdirp.sync(path.dirname(outputFile));
  ensureSymlink(cachedFile, outputFile);
}
// This Sass compiler has a different philosophy than the default one
// that comes with broccoli. It is directory based instead of being file
// based and can merge several input trees into a single output tree
// instead of using the trees as a proxy for includePaths. It has error
// handling, verbose logging and will pass through any options that
// it doesn't own. It uses the node-sass async api via promises.
// It allows several css files to be compiled from a single sass file
// by customizing the options and output file names.
//
// You can emit the following events from custom functions that are invoked during compilation:
// * compiler.events.emit("dependency", absolutePath);
//     marks the file as a dependency for the Sass file being compiled so that future
//     compiles will invalidate the cache if that file changes.
// * compiler.events.emit("additional-output", absolutePathToOutput, httpPathToOutput, absolutePathToSource);
//     marks the file as an additional output for the Sass file being compiled so that future
//     cached compiles will be able to install or remove them as needed in conjunction with the
//     sass file. Note: the source will not be considered a dependency unless the "dependency" event
//     is also emitted.
//
// You can subscribe to the following events:
//
//   * compiler.events.on("compiling", function(details) { });
//       prepare for a compilation to occur with these options. The options
//       are a unique copy for this compilation. E.g. This can be used to
//       prime a cache in the options for the compilation.
//   * compiler.events.on("compiled", (details, result) => { });
//       receive notification of a successful compilation.
//   * compiler.events.on("failed", (details, error) => { });
//       receive notification of a compilation failure.
//   * compiler.events.on("stale-external-output", (outputFile) => {})
//       receive a notification that a file outside of this broccoli output
//       tree might need to be removed because the only known sass file
//       in this tree to output it has been deleted.
//   * compiler.events.on("cached-asset", (absolutePathToSource, httpPathToOutput) => {})
//       receive a notification that an additional asset that was created
//       when the caller fired "additional-output" (see above) needs to be
//       restored because the sass file that produced it was retrieved from
//       cache. This is only invoked when the asset was created outside of the
//       broccoli tree for this addon. If the asset was in the tree, it will
//       be automatically recreated from the cache.
//
//   For all these events, a compilation details object is passed of the
//   following form:
//
//   {
//     srcPath: /* Source directory containing the sassFilename */,
//     sassFilename: /* Sass file relative to the srcPath */,
//     fullSassFilename: /* Fully expanded and resolved sass filename. */,
//     destDir: /* The location cssfiles are being written (a tmp dir) */,
//     cssFilename: /* The css filename relation to the output directory */,
//     fullCssFilename: /* Fully expanded and resolved css filename */,
//     options: /* The options used for this compile */
//   };
//
export default class BroccoliSassCompiler extends BroccoliPlugin {
  private buildCount: number;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  private colors: any;
  private currentTree: null | FSTree;
  private dependencies: Record<string, Set<string>>;
  private outputURLs: Record<string, Map<string, string>>;
  private outputs: Record<string, Set<string>>;

  protected cssDir: string;
  protected discover: boolean | undefined;
  protected fullException: boolean;
  protected maxListeners: number;
  protected options: nodeSass.Options;
  protected optionsGenerator: OptionsGenerator;
  protected persistentCache: DiskCache | undefined;
  protected renderSync: boolean;
  protected sassDir: string | undefined;
  protected sourceFiles: Array<string>;
  protected treeName: string | undefined;
  protected verbose: boolean;
  protected persistentCacheDebug: debugGenerator.Debugger;
  protected sessionCache: GenericCache | undefined;
  protected buildCache: GenericCache;

  public events: EventEmitter;

  constructor(inputTree: BroccoliPlugin.BroccoliNode | Array<BroccoliPlugin.BroccoliNode>, options: BroccoliSassOptions & nodeSass.Options) {
    if (Array.isArray(inputTree)) {
      if (inputTree.length > 1) {
        // eslint-disable-next-line no-console
        console.warn(
          "Support for passing several trees to BroccoliSassCompiler has been removed.\n" +
            "Passing the trees to broccoli-merge-trees with the overwrite option set,\n" +
            "but you should do this yourself if you need to compile CSS files from them\n" +
            "or use the node-sass includePaths option if you need to import from them."
        );
        inputTree = new MergeTrees(inputTree, { overwrite: true, annotation: "Sass Trees" });
      } else {
        inputTree = inputTree[0];
      }
    }
    options = options || {};
    options.persistentOutput = true;
    super([inputTree], options);

    this.buildCount = 0;

    this.events = new EventEmitter();

    this.currentTree = null;
    this.dependencies = {};
    this.outputs = {};
    this.outputURLs = {}

    this.sessionCache = options.sessionCache;
    delete options.sessionCache;

    this.buildCache = this.sessionCache || new Map();

    if (shouldPersist(process.env, !!options.persistentCache)) {
      this.persistentCache = new DiskCache(options.persistentCache);
    }
    this.persistentCacheDebug = debugGenerator(`broccoli-eyeglass:persistent-cache:${options.persistentCache || 'disabled'}`);

    this.treeName = options.annotation;
    delete options.annotation;

    this.cssDir = options.cssDir;
    delete options.cssDir;

    this.sassDir = options.sassDir;
    delete options.sassDir;

    this.optionsGenerator = options.optionsGenerator || defaultOptionsGenerator;
    delete options.optionsGenerator;

    this.fullException = options.fullException || false;
    delete options.fullException;

    this.verbose = options.verbose || debugGenerator.enabled("broccoli-eyeglass:results") || debugGenerator.enabled("eyeglass:results");
    delete options.verbose;

    this.renderSync = options.renderSync || false;
    delete options.renderSync;

    this.discover = options.discover;
    delete options.discover;

    if (!options.sourceFiles) {
      this.sourceFiles = [];
      if (this.discover === false) {
        throw new Error("sourceFiles are required when discovery is disabled.");
      } else {
        // Default to discovery mode if no sourcefiles are provided.
        this.discover = true;
      }
    } else {
      this.sourceFiles = options.sourceFiles;
    }
    delete options.sourceFiles;

    this.maxListeners = options.maxListeners || 10;
    delete options.maxListeners;

    this.options = copyObject(options);
    if (!this.cssDir) {
      throw new Error("Expected cssDir option.");
    }
    forbidNodeSassOption(this.options, "file");
    forbidNodeSassOption(this.options, "data");
    forbidNodeSassOption(this.options, "outFile");

    if (this.verbose) {
      this.colors = require("colors/safe");
      this.events.on("compiled", this.logCompilationSuccess.bind(this));
      this.events.on("failed", this.logCompilationFailure.bind(this));
    }

    this.events.addListener("compiled", (details: CompilationDetails, result: nodeSass.Result) => {
      this.addOutput(details.fullSassFilename, details.fullCssFilename);
      let depFiles = result.stats.includedFiles;
      this.addDependency(details.fullSassFilename, details.fullSassFilename);
      for (let i = 0; i < depFiles.length; i++) {
        this.addDependency(details.fullSassFilename, depFiles[i]);
      }
    });
  }

  logCompilationSuccess(details: CompilationDetails, result: nodeSass.Result): void {
    let timeInSeconds = result.stats.duration / 1000.0;
    if (timeInSeconds === 0) {
      timeInSeconds = 0.001; // nothing takes zero seconds.
    }
    let action: string = this.colors.inverse.green(`compile (${timeInSeconds}s)`);
    let message = this.scopedFileName(details.sassFilename) + " => " + details.cssFilename;
    // eslint-disable-next-line no-console
    console.log(action + " " + message);
  }

  logCompilationFailure(details: CompilationDetails, error: nodeSass.SassError): void {
    let sassFilename = details.sassFilename;
    let action: string = this.colors.bgRed.white("error");
    let message: string = this.colors.red(error.message);
    let location = `Line ${error.line}, Column ${error.column}`;
    if (error.file.substring(error.file.length - sassFilename.length) !== sassFilename) {
      location = location + " of " + error.file;
    }
    // eslint-disable-next-line no-console
    console.log(action + " " + sassFilename + " (" + location + "): " + message);
  }

  compileTree(srcPath: string, files: Array<string>, destDir: string, compilationTimer: heimdall.Cookie<SassRenderSchema>): Promise<void | Array<void | nodeSass.Result>> {
    switch (files.length) {
      case 0:
        return RSVP.resolve();
      case 1:
        return RSVP.all(this.compileSassFile(srcPath, files[0], destDir, compilationTimer));
      default: {
        let worker = queue.async.asyncify((file: string) => {
          return RSVP.all(this.compileSassFile(srcPath, file, destDir, compilationTimer));
        });
        return concurrency.then(numConcurrentCalls => {
          concurrencyDebug("Compiling files with a worker queue of size %d", numConcurrentCalls);
          return RSVP.resolve(queue(worker, files, numConcurrentCalls));
        })
      }
    }
  }

  compileSassFile(srcPath: string, sassFilename: string, destDir: string, compilationTimer: heimdall.Cookie<SassRenderSchema>): Array<Promise<void | nodeSass.Result>> {
    let sassOptions = copyObject(this.options);
    let fullSassFilename = path.join(srcPath, sassFilename);
    sassOptions.file = fullSassFilename;
    let parsedName = parsePath(sassFilename);

    if (this.sassDir && parsedName.dir.slice(0, this.sassDir.length) === this.sassDir) {
      parsedName.dir = parsedName.dir.slice(this.sassDir.length + 1);
    }

    parsedName.ext = ".css";
    parsedName.base = parsedName.name + ".css";

    let cssFileName = path.join(this.cssDir, formatPath(parsedName));
    let promises: Array<Promise<void> | Promise<nodeSass.Result>> = [];

    this.optionsGenerator(
      sassFilename,
      cssFileName,
      sassOptions,
      (resolvedCssFileName, resolvedOptions) => {
        let details = {
          srcPath: srcPath,
          sassFilename: sassFilename,
          fullSassFilename: resolvedOptions.file || fullSassFilename,
          destDir: destDir,
          cssFilename: resolvedCssFileName,
          fullCssFilename: path.join(destDir, resolvedCssFileName),
          options: copyObject(resolvedOptions),
        };
        details.options.outFile = details.cssFilename;
        promises.push(this.compileCssFileMaybe(details, compilationTimer));
      }
    );

    return promises;
  }

  renderer(): SassPromiseRenderer {
    initSass();
    if (this.renderSync) {
      return renderSassSync;
    } else {
      return renderSass;
    }
  }

  /* Check if a dependency's hash has changed.
   *
   * @argument srcDir The directory in which to resolve relative paths against.
   * @argument dep An array of two elements, the first is the file and
   *               the second is the last known hash of that file.
   *
   * @return Boolean true if the file hasn't changed from the input hash, otherwise false
   **/
  dependencyChanged(srcDir: string, dep: [string, string]): boolean {
    let file = path.isAbsolute(dep[0]) ? dep[0] : path.join(srcDir, dep[0]);
    let hexDigest = dep[1];
    return hexDigest !== this.hashForFile(file);
  }

  /* get the cached output for a source file, or compile the file if not in cache
   *
   * @argument details The compilation details object.
   *
   * @return Promise that resolves to the cached output of the file or the output
   *   of compiling the file
   **/
  getFromCacheOrCompile(details: CompilationDetails, compilationTimer: heimdall.Cookie<SassRenderSchema>): Promise<void>   {
    let key = this.keyForSourceFile(details.srcPath, details.sassFilename, details.options);

    try {
      let cachedDependencies = this.persistentCache!.get(this.dependenciesKey(key));
      if (!cachedDependencies.isCached) {
        let reason = { message: "no dependency data for " + details.sassFilename };
        return this.handleCacheMiss(details, reason, key, compilationTimer);
      }

      let dependencies: CachedDependencies = JSON.parse(cachedDependencies.value);

      // check dependency caches
      if (dependencies.some(dep => this.dependencyChanged(details.srcPath, dep))) {
        let reason = { message: "dependency changed" };
        return this.handleCacheMiss(details, reason, key, compilationTimer);
      }

      let cachedOutput = this.persistentCache!.get(this.outputKey(key));
      if (!cachedOutput.isCached) {
        let reason = { message: "no output data for " + details.sassFilename };
        return this.handleCacheMiss(details, reason, key, compilationTimer);
      }

      let depFiles = dependencies.map(depAndHash => depAndHash[0]);
      let value: [Array<string>, CachedContents] = [depFiles, JSON.parse(cachedOutput.value)];
      compilationTimer.stats.cacheHitCount++;
      return RSVP.resolve(this.handleCacheHit(details, value).then(() => {}));
    } catch (error) {
      return this.handleCacheMiss(details, error, key, compilationTimer);
    }
  }

  /* compute the hash for a file.
   *
   * @argument absolutePath The absolute path to the file.
   * @return hash object of the file data
   **/
  hashForFile(absolutePath: string): string {
    return this.fileKey(absolutePath);
  }

  /* compute a key for a file that will change if the file has changed. */
  fileKey(file: string): string {
    let cachedKeyKey = `fileKey(${file})`;
    let cachedKey = this.buildCache.get(cachedKeyKey) as string;
    if (cachedKey) { return cachedKey; }
    let key;
    try {
      let stat = statSync(file);
      key = `${mtimeMs(stat)}:${stat.size}:${stat.mode}`;
      this.buildCache.set(cachedKeyKey, key);
    } catch (_) {
      key = `0:0:0`;
    }
    this.buildCache.set(cachedKeyKey, key);
    return key;
  }


  /* construct a base cache key for a file to be compiled.
   *
   * @argument srcDir The directory in which to resolve relative paths against.
   * @argument relativeFilename The filename relative to the srcDir that is being compiled.
   * @argument options The compilation options.
   *
   * @return The cache key for the file
   **/
  keyForSourceFile(srcDir: string, relativeFilename: string, _options: nodeSass.Options): string {
    let absolutePath = path.join(srcDir, relativeFilename);
    let hash = this.hashForFile(absolutePath);
    return relativeFilename + "@" + hash;
  }

  /* construct a cache key for storing dependency hashes.
   *
   * @argument key The base cache key
   * @return String
   */
  dependenciesKey(key: string): string {
    return "[[[dependencies of " + key + "]]]";
  }

  /* construct a cache key for storing output.
   *
   * @argument key The base cache key
   * @return String
   */
  outputKey(key: string): string {
    return "[[[output of " + key + "] v2]]";
  }

  /* retrieve the files from cache, write them, and populate the hot cache information
   * for rebuilds.
   */
  handleCacheHit(details: CompilationDetails, inputAndOutputFiles: [Array<string>, CachedContents]): Promise<Array<void>> {
    let [inputFiles, outputFiles] = inputAndOutputFiles;

    this.persistentCacheDebug(
      "Persistent cache hit for %s. Writing to: %s",
      details.sassFilename,
      details.fullCssFilename
    );

    if (this.verbose) {
      let action: string = this.colors.inverse.green("cached");
      let message = this.scopedFileName(details.sassFilename) + " => " + details.cssFilename;
      // eslint-disable-next-line no-console
      console.log(action + " " + message);
    }

    inputFiles.forEach(dep => {
      // populate the dependencies cache for rebuilds
      this.addDependency(details.fullSassFilename, path.resolve(details.srcPath, dep));
    });

    let {contents, urls} = outputFiles;
    let files = Object.keys(contents);

    this.persistentCacheDebug(
      "cached output files for %s are: %s",
      details.sassFilename,
      files.join(", ")
    );

    for (let file of files) {
      let data = contents[file];
      let cachedFile = path.join(this.cachePath!, file);
      let outputFile = path.join(this.outputPath, file);
      // populate the output cache for rebuilds
      this.addOutput(details.fullSassFilename, outputFile);

      writeDataToFile(cachedFile, outputFile, Buffer.from(data, "base64"));
    }
    let eventPromises: Array<Promise<any>> = [];
    let allUrls = Object.keys(urls);
    if (allUrls.length > 0) {
      this.persistentCacheDebug(
        "firing 'cached-asset' for each asset url for %s: %s",
        details.sassFilename,
        allUrls.join(", ")
      );
    }
    for (let url of allUrls) {
      let sourceFile = urls[url];
      eventPromises.push(this.events.emit("cached-asset", sourceFile, url))
    }
    return RSVP.all(eventPromises);
  }

  scopedFileName(file: string): string {
    file = this.relativize(file);
    if (this.treeName) {
      return this.treeName + "/" + file;
    } else {
      return file;
    }
  }

  relativize(file: string): string {
    return removePathPrefix(this.inputPaths[0], [file])[0];
  }
  isOutputInTree(file: string): boolean {
    if (path.isAbsolute(file)) {
      return file.startsWith(this.outputPath);
    } else {
      return true;
    }
  }
  relativizeOutput(file: string): string {
    return removePathPrefix(this.outputPath, [file])[0];
  }

  relativizeAll(files: Array<string>): Array<string> {
    return removePathPrefix(this.inputPaths[0], files);
  }

  hasDependenciesSet(file: string): boolean {
    return this.dependencies[this.relativize(file)] !== undefined;
  }

  dependenciesOf(file: string): Set<string> {
    return this.dependencies[this.relativize(file)] || new Set();
  }

  outputsFrom(file: string): Set<string> {
    return this.outputs[this.relativize(file)] || new Set();
  }

  outputURLsFrom(file: string): Map<string, string> {
    return this.outputURLs[this.relativize(file)] || new Map();
  }

  /**
   * Some filenames returned from importers are not really files
   * on disk. These three prefixes are used in eyeglass.
   * Skipping a read on these files avoids a more expensive fs call
   * and exception handling.
   * @param filename a filename returned from an importer
   */
  isNotFile(filename: string): boolean {
    return filename.startsWith("already-imported:") ||
           filename.startsWith("autoGenerated:") ||
           filename.startsWith("fs:");
  }

  /* hash all dependencies synchronously and return the files that exist
   * as an array of pairs (filename, hash).
   */
  hashDependencies(details: CompilationDetails): CachedDependencies {
    let depsWithHashes = new Array<[string, string]>();

    this.dependenciesOf(details.fullSassFilename).forEach(f => {
      try {
        if (this.isNotFile(f)) {
          this.persistentCacheDebug("Ignoring non-file dependency: %s", f);
        } else {
          let h = this.hashForFile(f);

          if (f.startsWith(details.srcPath)) {
            f = f.substring(details.srcPath.length + 1);
          }
          depsWithHashes.push([f, h]);
        }
      } catch (e) {
        if (typeof e === "object" && e !== null && e.code === "ENOENT") {
          this.persistentCacheDebug("Ignoring non-existent file: %s", f);
        } else {
          throw e;
        }
      }
    });

    // prune out the dependencies that weren't files.
    return depsWithHashes;
  }

  /* read all output files asynchronously and return the contents
   * as a hash of relative filenames to base64 encoded strings.
   */
  readOutputs(details: CompilationDetails): CachedContents {
    let contents: Record<string, string> = {};
    let urls: Record<string, string> = {};
    let outputs = this.outputsFrom(details.fullSassFilename);

    for (let output of outputs) {
      if (this.isOutputInTree(output)) {
        contents[this.relativizeOutput(output)] = fs.readFileSync(output, "base64");
      } else {
        this.persistentCacheDebug(
          "refusing to cache output file found outside the output tree: %s",
          output
        );
      }
    }

    let outputURLs = this.outputURLsFrom(details.fullSassFilename);
    for (let url of outputURLs.keys()) {
      urls[url] = outputURLs.get(url)!;
    }

    return {contents, urls};
  }

  /* Writes the dependencies and output contents to the persistent cache */
  populateCache(key: string, details: CompilationDetails, _result: nodeSass.Result): void {
    this.persistentCacheDebug("Populating cache for " + key);

    let cache = this.persistentCache!;

    let depsWithHashes = this.hashDependencies(details);
    let outputContents = this.readOutputs(details);

    cache.set(this.dependenciesKey(key), JSON.stringify(depsWithHashes));
    cache.set(this.outputKey(key), JSON.stringify(outputContents));
  }

  /* When the cache misses, we need to compile the file and then populate the cache */
  handleCacheMiss(details: CompilationDetails, reason: Error | {message: string; stack?: Array<string>}, key: string, compilationTimer: heimdall.Cookie<SassRenderSchema>): Promise<void> {
    compilationTimer.stats.cacheMissCount++;
    this.persistentCacheDebug(
      "Persistent cache miss for %s. Reason: %s",
      details.sassFilename,
      reason.message
    );
    // for errors
    if (reason.stack) {
      this.persistentCacheDebug("Stacktrace:", reason.stack);
    }
    return this.compileCssFile(details, compilationTimer).then(result => {
      return this.populateCache(key, details, result);
    });
  }

  /* Compile the file if it's not in the cache.
   * Reuse cached output if it is.
   *
   * @argument details The compilation details object.
   *
   * @return A promise that resolves when the output files are written
   *   either from cache or by compiling. Rejects on error.
   */
  compileCssFileMaybe(details: CompilationDetails, compilationTimer: heimdall.Cookie<SassRenderSchema>): Promise<void> | Promise<nodeSass.Result> {
    if (this.persistentCache) {
      return this.getFromCacheOrCompile(details, compilationTimer);
    } else {
      return this.compileCssFile(details, compilationTimer);
    }
  }

  compileCssFile(details: CompilationDetails, compilationTimer: heimdall.Cookie<SassRenderSchema>): Promise<nodeSass.Result> {
    let sass = this.renderer();

    let success = this.handleSuccess.bind(this, details);
    let failure = this.handleFailure.bind(this, details);

    return this.events.emit("compiling", details).then(() => {
      let dependencyListener = (absolutePath: string): void => {
        this.addDependency(details.fullSassFilename, absolutePath);
      };

      let additionalOutputListener = (absolutePathToOutput: string, httpPathToOutput: string | undefined, absolutePathToSource: string | undefined): void => {
        this.persistentCacheDebug("additional-output %s -> %s -> %s", absolutePathToSource, httpPathToOutput, absolutePathToOutput);
        if (!this.isOutputInTree(absolutePathToOutput)) {
          // it's outside this tree, don't cache the output.
          if (absolutePathToSource && httpPathToOutput) {
            this.persistentCacheDebug("additional-output is outside tree will cache source & url");
            // something outside this tree is putting it there, so we need to
            // let that same thing deal with it again when the warm cache is accessed.
            // we will track this file from its source location and target url
            this.addSource(details.fullSassFilename, absolutePathToSource, httpPathToOutput);
          }
        } else {
          this.persistentCacheDebug("additional-output is in tree will cache contents");
          this.addOutput(details.fullSassFilename, absolutePathToOutput);
        }
      };

      this.events.addListener("additional-output", additionalOutputListener);
      this.events.addListener("dependency", dependencyListener);
      let sassPromise = sass(details.options as nodeSass.SyncOptions); // XXX This cast sucks
      return sassPromise
        .finally(() => {
          this.events.removeListener("dependency", dependencyListener);
          this.events.removeListener("additional-output", additionalOutputListener);
        })
        .then(result => {
          compilationTimer.stats.nodeSassTime += result.stats.duration;
          compilationTimer.stats.importCount += result.stats.includedFiles.length;
          for (let f of result.stats.includedFiles) {
            if (!f.startsWith("already-imported:")) {
              compilationTimer.stats.uniqueImportCount++;
            }
          }
          debug(`render of ${result.stats.entry} took ${result.stats.duration}`)
          return success(result).then(() => result);
        }, failure);
    }) as Promise<nodeSass.Result>;
  }

  handleSuccess(details: CompilationDetails, result: nodeSass.Result): Promise<void> {
    let cachedFile = path.join(this.cachePath!, details.cssFilename);
    let outputFile = details.fullCssFilename;

    writeDataToFile(cachedFile, outputFile, result.css);

    return this.events.emit("compiled", details, result);
  }

  handleFailure(details: CompilationDetails, error: nodeSass.SassError | null): Promise<void> {
    let failed = this.events.emit("failed", details, error);
    return failed.then(() => {
      if (typeof error === "object" && error !== null) {
        error.message =
          `${error.message}\n    at ${error.file}:${error.line}:${error.column}`;
      }
      throw error;
    });
  }

  filesInTree(srcPath: string): Array<string> {
    let sassDir = this.sassDir || "";
    let files = new Array<string>();

    if (this.discover) {
      let pattern = path.join(srcPath, sassDir, "**", "[^_]*.scss");
      files = glob.sync(pattern);
    }

    this.sourceFiles.forEach(sourceFile => {
      let pattern = path.join(srcPath, sassDir, sourceFile);
      files = files.concat(glob.sync(pattern));
    });

    return unique(files);
  }

  addSource(sassFilename: string, sourceFilename: string, httpPathToOutput: string): void {
    sassFilename = this.relativize(sassFilename);
    this.outputURLs[sassFilename] = this.outputURLs[sassFilename] || new Map<string, string>();
    let urlMap = this.outputURLs[sassFilename];
    urlMap.set(httpPathToOutput, sourceFilename);
  }

  addOutput(sassFilename: string, outputFilename: string): void {
    sassFilename = this.relativize(sassFilename);

    this.outputs[sassFilename] = this.outputs[sassFilename] || new Set();
    this.outputs[sassFilename].add(outputFilename);
  }

  clearOutputs(files: Array<string>): void {
    this.relativizeAll(files).forEach(f => {
      if (this.outputs[f]) {
        delete this.outputs[f];
      }
      if (this.outputURLs[f]) {
        delete this.outputURLs[f];
      }
    });
  }

  /* This method computes the output files that are only output for at least one given inputs
   * and never for an input that isn't provided.
   *
   * This is important because the same assets might be output from compiling several
   * different inputs for tools like eyeglass assets.
   *
   * @return Set<String> The full paths output files.
   */
  outputsFromOnly(inputs: Array<string>): Set<string> {
    inputs = this.relativizeAll(inputs);

    let otherOutputs = new Set();
    let onlyOutputs = new Set();
    let allInputs = Object.keys(this.outputs);

    for (let i = 0; i < allInputs.length; i++) {
      let outputs = this.outputs[allInputs[i]];
      if (inputs.indexOf(allInputs[i]) < 0) {
        outputs.forEach(output => otherOutputs.add(output));
      } else {
        outputs.forEach(output => onlyOutputs.add(output));
      }
    }
    onlyOutputs.forEach(only => {
      if (otherOutputs.has(only)) {
        onlyOutputs.delete(only);
      }
    });
    return onlyOutputs;
  }

  addDependency(sassFilename: string, dependencyFilename: string): void {
    sassFilename = this.relativize(sassFilename);
    this.dependencies[sassFilename] = this.dependencies[sassFilename] || new Set();
    this.dependencies[sassFilename].add(dependencyFilename);
  }

  clearDependencies(files: Array<string>): void {
    this.relativizeAll(files).forEach(f => {
      delete this.dependencies[f];
    });
  }

  knownDependencies(): Array<Entry> {
    let deps = new Set<string>();
    let sassFiles = Object.keys(this.dependencies);

    for (let i = 0; i < sassFiles.length; i++) {
      let sassFile = sassFiles[i];
      deps.add(sassFile);
      this.dependencies[sassFile].forEach(dep => deps.add(dep));
    }

    let entries = new Array<Entry>();

    deps.forEach(d => {
      try {
        entries.push(new Entry(d));
      } catch (e) {
        // Lots of things aren't files that are dependencies, ignore them.
      }
    });

    return entries;
  }

  hasKnownDependencies(): boolean {
    return Object.keys(this.dependencies).length > 0;
  }

  knownDependenciesTree(inputPath: string): FSTree {
    let entries = walkSync.entries(inputPath);
    absolutizeEntries(entries);
    let tree = FSTree.fromEntries<FSTree.Entry>(entries);
    tree.addEntries(this.knownDependencies(), { sortAndExpand: true });
    return tree;
  }

  _reset(): void {
    this.currentTree = null;
    this.dependencies = {};
    this.outputs = {};
    this.outputURLs = {};
  }

  _build(): Promise<void | Array<void | nodeSass.Result>> {
    let inputPath = this.inputPaths[0];
    let outputPath = this.outputPath;
    let currentTree = this.currentTree;

    let nextTree: FSTree | null = null;
    let patches = new Array<FSTree.Operation>();
    let compilationAvoidanceTimer = heimdall.start("eyeglass:broccoli:build:invalidation");
    if (this.hasKnownDependencies()) {
      hotCacheDebug("Has known dependencies");
      nextTree = this.knownDependenciesTree(inputPath);
      this.currentTree = nextTree;
      currentTree = currentTree || new FSTree();
      patches = currentTree.calculatePatch(nextTree);
      hotCacheDebug("currentTree = ", currentTree);
      hotCacheDebug("nextTree = ", nextTree);
      hotCacheDebug("patches = ", patches);
    } else {
      hotCacheDebug("No known dependencies");
    }

    // TODO: handle indented syntax files.
    let treeFiles = removePathPrefix(inputPath, this.filesInTree(inputPath));

    treeFiles = treeFiles.filter(f => {
      f = path.join(inputPath, f);

      if (!this.hasDependenciesSet(f)) {
        hotCacheDebug("no deps for", this.scopedFileName(f));
        return true;
      }

      let deps = this.dependenciesOf(f);
      hotCacheDebug("dependencies are", deps);
      for (var p = 0; p < patches.length; p++) {
        let entry = patches[p][2];
        if (entry) {
          hotCacheDebug("looking for", entry.relativePath);
          if (deps.has(entry.relativePath)) {
            hotCacheDebug("building because", entry.relativePath, "is used by", f);
            return true;
          }
        }
      }

      if (this.verbose) {
        let action: string = this.colors.inverse.green("unchanged");
        let message = this.scopedFileName(f);
        // eslint-disable-next-line no-console
        console.log(action + " " + message);
      }
      return false;
    });
    compilationAvoidanceTimer.stop();

    // Cleanup any unneeded output files
    let removed = [];
    for (var p = 0; p < patches.length; p++) {
      if (patches[p][0] === "unlink") {
        let entry = patches[p][2];
        if (entry) {
          if (entry.relativePath.indexOf(inputPath) === 0) {
            removed.push(entry.relativePath);
          }
        }
      }
    }

    if (removed.length > 0) {
      let outputs = this.outputsFromOnly(removed);
      // TODO: outputURLsFromOnly(removed)
      outputs.forEach(output => {
        if (output.indexOf(outputPath) === 0) {
          fs.unlinkSync(output);
        } else {
          hotCacheDebug("not removing because outside the outputTree", output);
          this.events.emit("stale-external-output", output)
        }
      });
      this.clearOutputs(removed);
    }

    hotCacheDebug("building files:", treeFiles);

    let absoluteTreeFiles = treeFiles.map(f => path.join(inputPath, f));

    this.clearDependencies(absoluteTreeFiles);
    this.clearOutputs(absoluteTreeFiles);

    let internalListeners =
      absoluteTreeFiles.length * 2 + // 1 dep & 1 output listeners each
      1 + // one compilation listener
      (this.verbose ? 2 : 0); // 2 logging listeners if in verbose mode

    debug("There are %d internal event listeners.", internalListeners);
    debug(
      "Setting max external listeners to %d via the maxListeners option (default: 10).",
      this.maxListeners
    );
    this.events.setMaxListeners(internalListeners + this.maxListeners);

    let compilationTimer = heimdall.start(`eyeglass:broccoli:build:compileTree:${inputPath}`, SassRenderSchema);
    compilationTimer.stats.numSassFiles = treeFiles.length;
    return this.compileTree(inputPath, treeFiles, outputPath, compilationTimer).finally(() => {
      compilationTimer.stop();
      if (!this.currentTree) {
        this.currentTree = this.knownDependenciesTree(inputPath);
      }
    });
  }

  build(): Promise<void | Array<void | nodeSass.Result>> {
    this.buildCount++;

    if (this.buildCount > 1) {
      this.buildCache = this.sessionCache || new Map();
    } else {
      if (process.env.BROCCOLI_EYEGLASS === "forceInvalidateCache") {
        this.persistentCacheDebug("clearing cache because forceInvalidateCache was set.");
        this.persistentCache && this.persistentCache.clear();
      }
    }

    return this._build().catch(e => {
      this._reset();

      fs.removeSync(this.outputPath);
      fs.mkdirpSync(this.outputPath);

      throw e;
    });
  }
}

class SassRenderSchema {
  numSassFiles: number;
  nodeSassTime: number;
  importCount: number;
  uniqueImportCount: number;
  cacheMissCount: number;
  cacheHitCount: number;
  constructor() {
    this.cacheMissCount = 0;
    this.cacheHitCount = 0;
    this.numSassFiles = 0;
    this.nodeSassTime = 0;
    this.importCount = 0;
    this.uniqueImportCount = 0;
  }
}

module.exports.shouldPersist = shouldPersist;

/* shim for fs.Stats.mtimeMS which was introduced in node 8. */
function mtimeMs(stat: fs.Stats): number {
  if (stat.mtimeMs) {
    return stat.mtimeMs;
  } else {
    return stat.mtime.valueOf();
  }
}