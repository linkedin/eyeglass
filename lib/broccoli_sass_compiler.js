"use strict";

const path = require("path");
const crypto = require("crypto");
const debugGenerator = require("debug");
const debug = debugGenerator("broccoli-eyeglass");
const hotCacheDebug = debugGenerator("broccoli-eyeglass:hot-cache");
const persistentCacheDebug = debugGenerator("broccoli-eyeglass:persistent-cache");
const fs = require("fs-extra");
const RSVP = require("rsvp");
const Promise = RSVP.Promise;
const mkdirp = require("mkdirp");
mkdirp.promise = mkdirp.promise || RSVP.denodeify(mkdirp);
const BroccoliPlugin = require("broccoli-plugin");
const glob = require("glob");
const FSTree = require("fs-tree-diff");
const FSTreeFromEntries = FSTree.fromEntries;
const walkSync = require("walk-sync");
const os = require("os");
const queue = require("async-promise-queue");
const ensureSymlink = require("ensure-symlink");

let sass;
let renderSass;

function initSass() {
  if (!sass) {
    sass = require("node-sass");
    // Standard async rendering for node-sass.
    renderSass = RSVP.denodeify(sass.render);
  }
}

function absolutizeEntries(entries) {
  // We make everything absolute because relative path comparisons don't work for us.
  entries.forEach(entry => {
    // TODO support windows paths
    entry.relativePath = path.join(entry.basePath, entry.relativePath);
    entry.basePath = "/";
  });
}

function shouldPersist(env, persist) {
  let result;

  if (env.CI) {
    result = env.FORCE_PERSISTENCE_IN_CI;
  } else {
    result = persist;
  }

  return !!result;
}

class Entry {
  constructor(path) {
    let stats = fs.statSync(path);
    this.relativePath = path;
    this.basePath = "/";
    this.mode = stats.mode;
    this.size = stats.size;
    this.mtime = stats.mtime;
  }

  isDirectory() {
    return false;
  }
}

function unique(array) {
  let o = {};
  let rv = [];
  for (let i = 0; i < array.length; i++) {
    o[array[i]] = array[i];
  }
  for (let k in o) {
    if (o.hasOwnProperty(k)) {
      rv.push(o[k]);
    }
  }
  return rv;
}

// This promise runs sass synchronously
function renderSassSync(options) {
  return new RSVP.Promise(resolve => resolve(sass.renderSync(options)));
}

// Simple copy for options hashes.
function copyObject(obj) {
  if (typeof obj !== "object") {
    return obj;
  }
  if (obj.forEach) {
    let newObj = [];
    obj.forEach(o => newObj.push(copyObject(o)));
    return newObj;
  } else {
    let newObj = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = copyObject(obj[key]);
      }
    }
    return newObj;
  }
}

function moveOption(source, destination, property) {
  if (arguments.length > 3) {
    let returnValues = [];
    for (let i = 2; i < arguments.length; i++) {
      returnValues[i - 2] = moveOption(source, destination, arguments[i]);
    }
  } else {
    if (source.hasOwnProperty(property)) {
      destination[property] = source[property];
      delete source[property];
    }
    return destination[property];
  }
}

function removePathPrefix(prefix, fileNames) {
  if (prefix[prefix.length - 1] !== path.sep) {
    prefix = prefix + path.sep;
  }
  let newFileNames = [];
  for (let i = 0; i < fileNames.length; i++) {
    if (fileNames[i].indexOf(prefix) === 0) {
      newFileNames[i] = fileNames[i].substring(prefix.length);
    } else {
      newFileNames[i] = fileNames[i];
    }
  }
  return newFileNames;
}

// sassFile: The sass file being compiled
// cssFile: The default css file location.
// cb: This callback must be invoked once for each time you want to compile the
//     sass file. It must be called synchonously. You can change the output
//     filename and options passed to it.
function defaultOptionsGenerator(sassFile, cssFile, options, cb) {
  cb(cssFile, options);
}

// Support for older versions of node.
function parsePath(pathname) {
  if (path.parse) {
    return path.parse(pathname);
  } else {
    let parsed = {
      dir: path.dirname(pathname),
      base: path.basename(pathname),
      ext: path.extname(pathname),
    };
    parsed.name = parsed.base.substring(0, parsed.base.length - parsed.ext.length);
    return parsed;
  }
}

function formatPath(parsed) {
  if (path.format) {
    return path.format(parsed);
  } else {
    return path.join(parsed.dir, parsed.name + parsed.ext);
  }
}

function forbidNodeSassOption(options, property) {
  if (options[property]) {
    throw new Error("The node-sass option '" + property + "' cannot be set explicitly.");
  }
}

/* write data to cachedFile, and symlink outputFile to that
 *
 * @argument cachedFile - the file to write the data to
 * @argument outputFile - where to write the symlink
 * @argument data - the data to write
 */
function writeDataToFile(cachedFile, outputFile, data) {
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
module.exports = class BroccoliSassCompiler extends BroccoliPlugin {
  constructor(inputTree, options) {
    if (Array.isArray(inputTree)) {
      if (inputTree.length > 1) {
        console.warn(
          "Support for passing several trees to BroccoliSassCompiler has been removed.\n" +
          "Passing the trees to broccoli-merge-trees with the overwrite option set,\n" +
          "but you should do this yourself if you need to compile CSS files from them\n" +
          "or use the node-sass includePaths option if you need to import from them.");
        let MergeTrees = require("broccoli-merge-trees");
        inputTree = new MergeTrees(inputTree, {overwrite: true, annotation: "Sass Trees"});
      } else {
        inputTree = inputTree[0];
      }
    }
    options = options || {};
    options.persistentOutput = true;
    super([inputTree], options);

    this.buildCount = 0;
    this.treeName = options.annotation;
    this.sass = sass;
    this.options = copyObject(options);
    let EventEmitter = require("chained-emitter").EventEmitter;
    this.events = new EventEmitter();

    this._reset();

    if (shouldPersist(process.env, !!options.persistentCache)) {
      let DiskCache = require("sync-disk-cache");
      this.persistentCache = new DiskCache(options.persistentCache);
    }
    moveOption(this.options, this, "cssDir", "sassDir",
      "optionsGenerator", "fullException",
      "verbose", "renderSync",
      "discover", "sourceFiles",
      "maxListeners");


    if (!this.cssDir) {
      throw new Error("Expected cssDir option.");
    }
    if (!this.optionsGenerator) {
      this.optionsGenerator = defaultOptionsGenerator;
    }
    if (!this.sourceFiles) {
      this.sourceFiles = [];
      if (this.discover === false) {
        throw new Error("sourceFiles are required when discovery is disabled.");
      } else {
        // Default to discovery mode if no sourcefiles are provided.
        this.discover = true;
      }
    }
    this.maxListeners = this.maxListeners || 10;
    forbidNodeSassOption(this.options, "file");
    forbidNodeSassOption(this.options, "data");
    forbidNodeSassOption(this.options, "outFile");

    if (this.verbose) {
      this.colors = require("colors/safe");
      this.events.on("compiled", this.logCompilationSuccess.bind(this));
      this.events.on("failed", this.logCompilationFailure.bind(this));
    }

    this.events.addListener("compiled", (details, result) => {
      this.addOutput(details.fullSassFilename, details.fullCssFilename);
      let depFiles = result.stats.includedFiles;
      this.addDependency(details.fullSassFilename, details.fullSassFilename);
      for (let i = 0; i < depFiles.length; i++) {
        this.addDependency(details.fullSassFilename, depFiles[i]);
      }
    });
  }

  logCompilationSuccess(details, result) {
    let timeInSeconds = result.stats.duration / 1000.0;
    if (timeInSeconds === 0) {
      timeInSeconds = "0.001"; // nothing takes zero seconds.
    }
    let action = this.colors.inverse.green("compile (" + timeInSeconds + "s)");
    let message = this.scopedFileName(details.sassFilename) + " => " + details.cssFilename;
    console.log(action + " " + message);
  }

  logCompilationFailure(details, error) {
    let sassFilename = details.sassFilename;
    let action = this.colors.bgRed.white("error");
    let message = this.colors.red(error.message);
    let location = "Line " + error.line + ", Column " + error.column;
    if (error.file.substring(error.file.length - sassFilename.length) !== sassFilename) {
      location = location + " of " + error.file;
    }
    console.log(action + " " + sassFilename + " (" + location + "): " + message);
  }

  compileTree(srcPath, files, destDir) {
    switch (files.length) {
      case 0: return Promise.resolve();
      case 1: return Promise.all(this.compileSassFile(srcPath, files[0], destDir));
      default:  {
        let numConcurrentCalls = Number(process.env.JOBS) || os.cpus().length;

        let worker = queue.async.asyncify(file => {
          return Promise.all(this.compileSassFile(srcPath, file, destDir));
        });

        return Promise.resolve(queue(worker, files, numConcurrentCalls));
      }
    }
  }

  compileSassFile(srcPath, sassFilename, destDir) {
    let sassOptions = copyObject(this.options);
    sassOptions.file = path.join(srcPath, sassFilename);
    let parsedName = parsePath(sassFilename);

    if (this.sassDir && parsedName.dir.slice(0, this.sassDir.length) === this.sassDir) {
      parsedName.dir = parsedName.dir.slice(this.sassDir.length + 1);
    }

    parsedName.ext = ".css";
    parsedName.base = parsedName.name + ".css";

    let cssFileName = path.join(this.cssDir, formatPath(parsedName));
    let promises = [];

    this.optionsGenerator(
      sassFilename, cssFileName, sassOptions,
      (resolvedCssFileName, resolvedOptions) => {
        let details = {
          srcPath: srcPath,
          sassFilename: sassFilename,
          fullSassFilename: resolvedOptions.file,
          destDir: destDir,
          cssFilename: resolvedCssFileName,
          fullCssFilename: path.join(destDir, resolvedCssFileName),
          options: copyObject(resolvedOptions)
        };
        details.options.outFile = details.cssFilename;
        promises.push(this.compileCssFileMaybe(details));
      });

    return promises;
  }

  renderer() {
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
  dependencyChanged(srcDir, dep) {
    let file = path.isAbsolute(dep[0]) ? dep[0] : path.join(srcDir, dep[0]);
    let hexDigest = dep[1];

    let hash = this.hashForFile(file);
    let hd = hash.digest("hex");
    return (hd !== hexDigest);
  }

  /* get the cached output for a source file, or compile the file if not in cache
   *
   * @argument details The compilation details object.
   *
   * @return Promise that resolves to the cached output of the file or the output
   *   of compiling the file
   **/
  getFromCacheOrCompile(details) {
    let key = this.keyForSourceFile(details.srcPath, details.sassFilename, details.options);

    try {
      let cachedDependencies = this.persistentCache.get(this.dependenciesKey(key));
      if (!cachedDependencies.isCached) {
        let reason = {message: "no dependency data for " + details.sassFilename};
        return this.handleCacheMiss(details, reason, key);
      }

      let dependencies = JSON.parse(cachedDependencies.value);

      // check dependency caches
      if (dependencies.some(dep => this.dependencyChanged(details.srcPath, dep))) {
        let reason = {message: "dependency changed"};
        return this.handleCacheMiss(details, reason, key);
      }

      let cachedOutput = this.persistentCache.get(this.outputKey(key));
      if (!cachedOutput.isCached) {
        let reason = {message: "no output data for " + details.sassFilename};
        return this.handleCacheMiss(details, reason, key);
      }

      let depFiles = dependencies.map(depAndHash => depAndHash[0]);
      let value = [
        depFiles,
        JSON.parse(cachedOutput.value)
      ];
      return Promise.resolve(this.handleCacheHit(details, value));
    } catch (error) {
      return this.handleCacheMiss(details, error, key);
    }
  }

  /* compute the hash for a file.
   *
   * @argument absolutePath The absolute path to the file.
   * @return hash object of the file data
   **/
  hashForFile(absolutePath) {
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
  keyForSourceFile(srcDir, relativeFilename, options) {
    let absolutePath = path.join(srcDir, relativeFilename);
    let hash = this.hashForFile(absolutePath);
    return relativeFilename + "@" + hash.digest("hex");
  }

  /* construct a cache key for storing dependency hashes.
   *
   * @argument key The base cache key
   * @return String
   */
  dependenciesKey(key) {
    return "[[[dependencies of " + key + "]]]";
  }

  /* construct a cache key for storing output.
   *
   * @argument key The base cache key
   * @return String
   */
  outputKey(key) {
    return "[[[output of " + key + "]]]";
  }

  /* retrieve the files from cache, write them, and populate the hot cache information
   * for rebuilds.
   */
  handleCacheHit(details, inputAndOutputFiles) {
    let inputFiles = inputAndOutputFiles[0];
    let outputFiles = inputAndOutputFiles[1];

    persistentCacheDebug("%s is cached. Writing to %s.",
      details.sassFilename,
      details.fullCssFilename);

    if (this.verbose) {
      let action = this.colors.inverse.green("cached");
      let message = this.scopedFileName(details.sassFilename) + " => " + details.cssFilename;
      console.log(action + " " + message);
    }

    inputFiles.forEach(dep => {
      // populate the dependencies cache for rebuilds
      this.addDependency(details.fullSassFilename, path.resolve(details.srcPath, dep));
    });

    let files = Object.keys(outputFiles);

    persistentCacheDebug("cached output files for %s are: %s",
      details.sassFilename,
      files.join(", "));

    return files.map(file => {
      let data = outputFiles[file];
      let cachedFile = path.join(this.cachePath, file);
      let outputFile = path.join(this.outputPath, file);
      // populate the output cache for rebuilds
      this.addOutput(details.fullSassFilename, outputFile);

      writeDataToFile(cachedFile, outputFile, new Buffer(data, "base64"));
    });
  }

  scopedFileName(file) {
    file = this.relativize(file);
    if (this.treeName) {
      return this.treeName + "/" + file;
    } else {
      return file;
    }
  }

  relativize(file) {
    return removePathPrefix(this.inputPaths[0], [file])[0];
  }

  relativizeAll(files) {
    return removePathPrefix(this.inputPaths[0], files);
  }

  hasDependenciesSet(file) {
    return this.dependencies[this.relativize(file)] !== undefined;
  }

  dependenciesOf(file) {
    return this.dependencies[this.relativize(file)] || new Set();
  }

  outputsFrom(file) {
    return this.outputs[this.relativize(file)] || new Set();
  }

  /* hash all dependencies synchronously and return the files that exist
   * as an array of pairs (filename, hash).
   */
  hashDependencies(details) {
    let depsWithHashes = [];

    this.dependenciesOf(details.fullSassFilename).forEach(f => {
      try {
        let h = this.hashForFile(f);

        if (f.startsWith(details.srcPath)) {
          f = f.substring(details.srcPath.length + 1);
        }
        depsWithHashes.push([
          f,
          h.digest("hex")
        ]);
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
    return depsWithHashes.filter(dwh => dwh.length > 0);
  }

  /* read all output files asynchronously and return the contents
   * as a hash of relative filenames to base64 encoded strings.
   */
  readOutputs(details) {
    let reads = [];
    let outputs = this.outputsFrom(details.fullSassFilename);

    outputs.forEach(output => reads.push([output, fs.readFileSync(output, "base64")]));

    return reads.reduce((content, output) => {
      let fileName = output[0];
      let contents = output[1];

      if (fileName.startsWith(details.destDir)) {
        content[fileName.substring(details.destDir.length + 1)] = contents;
      } else {
        persistentCacheDebug("refusing to cache output file found outside the output tree: %s",
          fileName);
      }
      return content;
    }, {});
  }

  /* Writes the dependencies and output contents to the persistent cache */
  populateCache(key, details, result) {
    persistentCacheDebug("Populating cache for " + key);

    let cache = this.persistentCache;

    let depsWithHashes = this.hashDependencies(details);
    let outputContents = this.readOutputs(details);

    cache.set(this.dependenciesKey(key), JSON.stringify(depsWithHashes));
    cache.set(this.outputKey(key), JSON.stringify(outputContents));
  }

  /* When the cache misses, we need to compile the file and then populate the cache */
  handleCacheMiss(details, reason, key) {
    persistentCacheDebug("Persistent cache miss for %s. Reason: %s",
      details.sassFilename,
      reason.message);
    // for errors
    if (reason.stack) {
      persistentCacheDebug("Stacktrace:", reason.stack);
    }
    return this.compileCssFile(details)
      .then(result => {
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
  compileCssFileMaybe(details) {
    if (this.persistentCache) {
      return this.getFromCacheOrCompile(details);
    } else {
      return this.compileCssFile(details);
    }
  }

  compileCssFile(details) {
    let sass = this.renderer();

    let success = this.handleSuccess.bind(this, details);
    let failure = this.handleFailure.bind(this, details);

    return this.events.emit("compiling", details)
      .then(() => {
        let dependencyListener = absolutePath => {
          this.addDependency(details.fullSassFilename, absolutePath);
        };

        let additionalOutputListener = filename => {
          this.addOutput(details.fullSassFilename, filename);
        };

        this.events.addListener("additional-output", additionalOutputListener);
        this.events.addListener("dependency", dependencyListener);

        return Promise.resolve(sass(details.options))
          .finally(() => {
            this.events.removeListener("dependency", dependencyListener);
            this.events.removeListener("additional-output", additionalOutputListener);
          })
          .then(result => {
            return success(result).then(() => result);
          }, failure);
      });
  }

  handleSuccess(details, result) {
    let cachedFile = path.join(this.cachePath, details.cssFilename);
    let outputFile = details.fullCssFilename;

    writeDataToFile(cachedFile, outputFile, result.css);

    return this.events.emit("compiled", details, result);
  }

  handleFailure(details, error) {
    let failed = this.events.emit("failed", details, error);
    return failed.then(() => {
      if (typeof error === "object" && error !== null) {
        error.message = error.message  +
          "\n    at " + error.file + ":" + error.line + ":" + error.column;
      }
      throw error;
    });
  }

  filesInTree(srcPath) {
    let sassDir = this.sassDir || "";
    let files = [];

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

  addOutput(sassFilename, outputFilename) {
    sassFilename = this.relativize(sassFilename);

    this.outputs[sassFilename] =
      this.outputs[sassFilename] || new Set();
    this.outputs[sassFilename].add(outputFilename);
  }

  clearOutputs(files) {
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
  outputsFromOnly(inputs) {
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

  addDependency(sassFilename, dependencyFilename) {
    sassFilename = this.relativize(sassFilename);
    this.dependencies[sassFilename] =
      this.dependencies[sassFilename] || new Set();
    this.dependencies[sassFilename].add(dependencyFilename);
  }

  clearDependencies(files) {
    this.relativizeAll(files).forEach(f => {
      delete this.dependencies[f];
    });
  }

  knownDependencies() {
    let deps = new Set();
    let sassFiles = Object.keys(this.dependencies);

    for (let i = 0; i < sassFiles.length; i++) {
      let sassFile = sassFiles[i];
      deps.add(sassFile);
      this.dependencies[sassFile].forEach(dep => deps.add(dep));
    }

    let entries = [];

    deps.forEach(d => {
      try {
        entries.push(new Entry(d));
      } catch (e) {
        // Lots of things aren't files that are dependencies, ignore them.
      }
    });

    return entries;
  }

  hasKnownDependencies() {
    return Object.keys(this.dependencies).length > 0;
  }

  knownDependenciesTree(inputPath) {
    let entries = walkSync.entries(inputPath);
    absolutizeEntries(entries);
    let tree = new FSTreeFromEntries(entries);
    tree.addEntries(this.knownDependencies(), {sortAndExpand: true});
    return tree;
  }

  _reset() {
    this.currentTree = null;
    this.dependencies = {};
    this.outputs = {};
  }

  _build() {
    let inputPath = this.inputPaths[0];
    let outputPath = this.outputPath;
    let currentTree = this.currentTree;

    let nextTree = null;
    let patches = [];
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
        let action = this.colors.inverse.green("unchanged");
        let message = this.scopedFileName(f);
        console.log(action + " " + message);
      }
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

    let internalListeners = absoluteTreeFiles.length * 2 + // 1 dep & 1 output listeners each
      1 +                            // one compilation listener
      (this.verbose ? 2 : 0);        // 2 logging listeners if in verbose mode

    debug("There are %d internal event listeners.", internalListeners);
    debug("Setting max external listeners to %d via the maxListeners option (default: 10).",
      this.maxListeners);
    this.events.setMaxListeners(internalListeners + this.maxListeners);

    return this.compileTree(inputPath, treeFiles, outputPath).finally(() => {
      if (!this.currentTree) {
        this.currentTree = this.knownDependenciesTree(inputPath);
      }
    });
  }

  build() {
    this.buildCount = this.buildCount + 1;

    if (this.buildCount === 1 && process.env.BROCCOLI_EYEGLASS === "forceInvalidateCache") {
      persistentCacheDebug("clearing cache because forceInvalidateCache was set.");
      this.persistentCache.clear();
    }

    return this._build().catch(e => {
      this._reset();

      fs.removeSync(this.outputPath);
      fs.mkdirpSync(this.outputPath);

      throw e;
    });
  }
};

module.exports.shouldPersist = shouldPersist;
