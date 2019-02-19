"use strict";
import debugGenerator = require("debug");
import * as path from "path";
import crypto = require("crypto");
import fs = require("fs-extra");
import RSVP = require("rsvp");
import mkdirp = require("mkdirp");
import BroccoliPlugin = require("broccoli-plugin");
import glob = require("glob");
import FSTree = require("fs-tree-diff");
import walkSync = require("walk-sync");
import os = require("os");
import queue = require("async-promise-queue");
import ensureSymlink = require("ensure-symlink");
import * as nodeSass from "node-sass";
import copyObject = require("lodash.clonedeep");
import MergeTrees = require("broccoli-merge-trees");
import { EventEmitter } from "chained-emitter";
import DiskCache = require("sync-disk-cache");

const FSTreeFromEntries = FSTree.fromEntries;
const debug = debugGenerator("broccoli-eyeglass");
const hotCacheDebug = debugGenerator("broccoli-eyeglass:hot-cache");
const persistentCacheDebug = debugGenerator("broccoli-eyeglass:persistent-cache");

let sass: typeof nodeSass;
let renderSass: (options: nodeSass.Options) => Promise<nodeSass.Result>;

type SassPromiseRenderer =
  ((options: nodeSass.Options) => Promise<nodeSass.Result>)
  | ((options: nodeSass.SyncOptions) => Promise<nodeSass.Result>);

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
  mtime: Date;
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
//     sass file. It must be called synchonously. You can change the output
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
// * compiler.events.emit("additional-output", absolutePath);
//     marks the file as an additional output for the Sass file being compiled so that future
//     cached compiles will be able to install or remove them as needed in conjunction with the
//     sass file.
//
// You can subscribe to the following events:
//
//   * compiler.events.on("compiling", function(details) { });
//       prepare for a compilation to occur with these options. The options
//       are a unique copy for this compilation. E.g. This can be used to
//       prime a cache in the options for the compilation.
//   * compiler.events.on("compiled", function(details, result) { });
//       receive notification of a successful compilation.
//   * compiler.events.on("failed", function(details, error) { });
//       receive notification of a compilation failure.
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
  private outputs: Record<string, Set<string>>;

  protected cssDir: string;
  protected discover: boolean | undefined;
  protected events: EventEmitter;
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

    if (shouldPersist(process.env, !!options.persistentCache)) {
      this.persistentCache = new DiskCache(options.persistentCache);
    }

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

    this.verbose = options.verbose || false;
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

  compileTree(srcPath: string, files: Array<string>, destDir: string): Promise<void | Array<void | nodeSass.Result>> {
    switch (files.length) {
      case 0:
        return RSVP.resolve();
      case 1:
        return RSVP.all(this.compileSassFile(srcPath, files[0], destDir));
      default: {
        let numConcurrentCalls = Number(process.env.JOBS) || os.cpus().length;

        let worker = queue.async.asyncify((file: string) => {
          return RSVP.all(this.compileSassFile(srcPath, file, destDir));
        });

        return RSVP.resolve(queue(worker, files, numConcurrentCalls));
      }
    }
  }

  compileSassFile(srcPath: string, sassFilename: string, destDir: string): Array<Promise<void | nodeSass.Result>> {
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
        promises.push(this.compileCssFileMaybe(details));
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

    let hash = this.hashForFile(file);
    let hd = hash.digest("hex");
    return hd !== hexDigest;
  }

  /* get the cached output for a source file, or compile the file if not in cache
   *
   * @argument details The compilation details object.
   *
   * @return Promise that resolves to the cached output of the file or the output
   *   of compiling the file
   **/
  getFromCacheOrCompile(details: CompilationDetails): Promise<void>   {
    let key = this.keyForSourceFile(details.srcPath, details.sassFilename, details.options);

    try {
      let cachedDependencies = this.persistentCache!.get(this.dependenciesKey(key));
      if (!cachedDependencies.isCached) {
        let reason = { message: "no dependency data for " + details.sassFilename };
        return this.handleCacheMiss(details, reason, key);
      }

      let dependencies: Array<[string, string]> = JSON.parse(cachedDependencies.value);

      // check dependency caches
      if (dependencies.some(dep => this.dependencyChanged(details.srcPath, dep))) {
        let reason = { message: "dependency changed" };
        return this.handleCacheMiss(details, reason, key);
      }

      let cachedOutput = this.persistentCache!.get(this.outputKey(key));
      if (!cachedOutput.isCached) {
        let reason = { message: "no output data for " + details.sassFilename };
        return this.handleCacheMiss(details, reason, key);
      }

      let depFiles = dependencies.map(depAndHash => depAndHash[0]);
      let value: [Array<string>, Record<string, string>] = [depFiles, JSON.parse(cachedOutput.value)];
      return RSVP.resolve(this.handleCacheHit(details, value));
    } catch (error) {
      return this.handleCacheMiss(details, error, key);
    }
  }

  /* compute the hash for a file.
   *
   * @argument absolutePath The absolute path to the file.
   * @return hash object of the file data
   **/
  hashForFile(absolutePath: string): crypto.Hash {
    let data = fs.readFileSync(absolutePath, "UTF8");
    return crypto.createHash("md5").update(data);
  }

  /* construct a base cache key for a file to be compiled.
   *
   * @argument srcDir The directory in which to resolve relative paths against.
   * @argument relativeFilename The filename relative to the srcDir that is being compiled.
   * @argument options The compilation options.
   *
   * @return Promise that resolves to the cache key for the file or rejects if
   *         it can't read the file.
   **/
  keyForSourceFile(srcDir: string, relativeFilename: string, _options: nodeSass.Options): string {
    let absolutePath = path.join(srcDir, relativeFilename);
    let hash = this.hashForFile(absolutePath);
    return relativeFilename + "@" + hash.digest("hex");
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
    return "[[[output of " + key + "]]]";
  }

  /* retrieve the files from cache, write them, and populate the hot cache information
   * for rebuilds.
   */
  handleCacheHit(details: CompilationDetails, inputAndOutputFiles: [Array<string>, Record<string, string>]): void {
    let inputFiles = inputAndOutputFiles[0];
    let outputFiles = inputAndOutputFiles[1];

    persistentCacheDebug(
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

    let files = Object.keys(outputFiles);

    persistentCacheDebug(
      "cached output files for %s are: %s",
      details.sassFilename,
      files.join(", ")
    );

    files.map(file => {
      let data = outputFiles[file];
      let cachedFile = path.join(this.cachePath!, file);
      let outputFile = path.join(this.outputPath, file);
      // populate the output cache for rebuilds
      this.addOutput(details.fullSassFilename, outputFile);

      writeDataToFile(cachedFile, outputFile, Buffer.from(data, "base64"));
    });
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

  /* hash all dependencies synchronously and return the files that exist
   * as an array of pairs (filename, hash).
   */
  hashDependencies(details: CompilationDetails): Array<[string, string]> {
    let depsWithHashes = new Array<[string, string] | []>();

    this.dependenciesOf(details.fullSassFilename).forEach(f => {
      try {
        let h = this.hashForFile(f);

        if (f.startsWith(details.srcPath)) {
          f = f.substring(details.srcPath.length + 1);
        }
        depsWithHashes.push([f, h.digest("hex")]);
      } catch (e) {
        if (typeof e === "object" && e !== null && e.code === "ENOENT") {
          persistentCacheDebug("Ignoring non-existent file: %s", f);
          depsWithHashes.push([]);
        } else {
          throw e;
        }
      }
    });

    // prune out the dependencies that weren't files.
    return depsWithHashes.filter(dwh => dwh.length > 0) as Array<[string, string]>;
  }

  /* read all output files asynchronously and return the contents
   * as a hash of relative filenames to base64 encoded strings.
   */
  readOutputs(details: CompilationDetails): Record<string, string> {
    let reads = new Array<[string, string]>();
    let outputs = this.outputsFrom(details.fullSassFilename);

    outputs.forEach(output => reads.push([output, fs.readFileSync(output, "base64")]));

    return reads.reduce((content: Record<string, string>, output) => {
      let fileName = output[0];
      let contents = output[1];

      if (fileName.startsWith(details.destDir)) {
        content[fileName.substring(details.destDir.length + 1)] = contents;
      } else {
        persistentCacheDebug(
          "refusing to cache output file found outside the output tree: %s",
          fileName
        );
      }
      return content;
    }, {});
  }

  /* Writes the dependencies and output contents to the persistent cache */
  populateCache(key: string, details: CompilationDetails, _result: nodeSass.Result): void {
    persistentCacheDebug("Populating cache for " + key);

    let cache = this.persistentCache!;

    let depsWithHashes = this.hashDependencies(details);
    let outputContents = this.readOutputs(details);

    cache.set(this.dependenciesKey(key), JSON.stringify(depsWithHashes));
    cache.set(this.outputKey(key), JSON.stringify(outputContents));
  }

  /* When the cache misses, we need to compile the file and then populate the cache */
  handleCacheMiss(details: CompilationDetails, reason: Error | {message: string; stack?: Array<string>}, key: string): Promise<void> {
    persistentCacheDebug(
      "Persistent cache miss for %s. Reason: %s",
      details.sassFilename,
      reason.message
    );
    // for errors
    if (reason.stack) {
      persistentCacheDebug("Stacktrace:", reason.stack);
    }
    return this.compileCssFile(details).then(result => {
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
  compileCssFileMaybe(details: CompilationDetails): Promise<void> | Promise<nodeSass.Result> {
    if (this.persistentCache) {
      return this.getFromCacheOrCompile(details);
    } else {
      return this.compileCssFile(details);
    }
  }

  compileCssFile(details: CompilationDetails): Promise<nodeSass.Result> {
    let sass = this.renderer();

    let success = this.handleSuccess.bind(this, details);
    let failure = this.handleFailure.bind(this, details);

    return this.events.emit("compiling", details).then(() => {
      let dependencyListener = (absolutePath: string): void => {
        this.addDependency(details.fullSassFilename, absolutePath);
      };

      let additionalOutputListener = (filename: string): void => {
        this.addOutput(details.fullSassFilename, filename);
      };

      this.events.addListener("additional-output", additionalOutputListener);
      this.events.addListener("dependency", dependencyListener);

      return RSVP.resolve(sass(details.options as nodeSass.SyncOptions)) // XXX This cast sucks
        .finally(() => {
          this.events.removeListener("dependency", dependencyListener);
          this.events.removeListener("additional-output", additionalOutputListener);
        })
        .then(result => {
          debug(`render of ${result.stats.entry} took ${result.stats.duration}`)
          return success(result).then(() => result);
        }, failure);
    });
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
    let tree = FSTreeFromEntries(entries);
    tree.addEntries(this.knownDependencies(), { sortAndExpand: true });
    return tree;
  }

  _reset(): void {
    this.currentTree = null;
    this.dependencies = {};
    this.outputs = {};
  }

  _build(): Promise<void | Array<void | nodeSass.Result>> {
    let inputPath = this.inputPaths[0];
    let outputPath = this.outputPath;
    let currentTree = this.currentTree;

    let nextTree: FSTree | null = null;
    let patches = new Array<FSTree.Patch>();
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
        hotCacheDebug("looking for", entry.relativePath);
        if (deps.has(entry.relativePath)) {
          hotCacheDebug("building because", entry.relativePath, "is used by", f);
          return true;
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

    // Cleanup any unneeded output files
    let removed = [];
    for (var p = 0; p < patches.length; p++) {
      if (patches[p][0] === "unlink") {
        let entry = patches[p][2];
        if (entry.relativePath.indexOf(inputPath) === 0) {
          removed.push(entry.relativePath);
        }
      }
    }

    if (removed.length > 0) {
      let outputs = this.outputsFromOnly(removed);
      outputs.forEach(output => {
        if (output.indexOf(outputPath) === 0) {
          fs.unlinkSync(output);
        } else {
          hotCacheDebug("not removing because outside the outputTree", output);
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

    return this.compileTree(inputPath, treeFiles, outputPath).finally(() => {
      if (!this.currentTree) {
        this.currentTree = this.knownDependenciesTree(inputPath);
      }
    });
  }

  build(): Promise<void | Array<void | nodeSass.Result>> {
    this.buildCount++;

    if (this.buildCount === 1 && process.env.BROCCOLI_EYEGLASS === "forceInvalidateCache") {
      persistentCacheDebug("clearing cache because forceInvalidateCache was set.");
      this.persistentCache && this.persistentCache.clear();
    }

    return this._build().catch(e => {
      this._reset();

      fs.removeSync(this.outputPath);
      fs.mkdirpSync(this.outputPath);

      throw e;
    });
  }
}

module.exports.shouldPersist = shouldPersist;
