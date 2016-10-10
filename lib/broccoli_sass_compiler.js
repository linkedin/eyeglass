var path = require("path");
var crypto = require("crypto");
var debug = require("debug")("broccoli-eyeglass");
var fs = require("fs");
var RSVP = require("rsvp");
var mkdirp = require("mkdirp");
mkdirp.promise = mkdirp.promise || RSVP.denodeify(mkdirp);
var BroccoliPlugin = require("broccoli-plugin");
var sass = require("node-sass");
var glob = require("glob");
var FSTree = require("fs-tree-diff");
var FSTreeFromEntries = FSTree.fromEntries;
var walkSync = require("walk-sync");

require("string.prototype.startswith");

function unique(array) {
  var o = {};
  var rv = [];
  for (var i = 0; i < array.length; i++) {
    o[array[i]] = array[i];
  }
  for (var k in o) {
    if (o.hasOwnProperty(k)) {
      rv.push(o[k]);
    }
  }
  return rv;
}

// Standard async rendering for node-sass.
var renderSass = RSVP.denodeify(sass.render);

// This promise runs sass synchronously
function renderSassSync(options) {
  return new RSVP.Promise(function(resolve) {
    resolve(sass.renderSync(options));
  });
}

// Simple copy for options hashes.
function copyObject(obj) {
  var newObj, key;

  if (typeof obj !== "object") {
    return obj;
  }
  if (obj.forEach) {
    newObj = [];
    obj.forEach(function(o) {
      newObj.push(copyObject(o));
    });
    return newObj;
  } else {
    newObj = {};
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = copyObject(obj[key]);
      }
    }
    return newObj;
  }
}

function moveOption(source, destination, property) {
  if (arguments.length > 3) {
    var returnValues = [];
    for (var i = 2; i < arguments.length; i++) {
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
  var newFileNames = [];
  for (var i = 0; i < fileNames.length; i++) {
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
    var parsed = {
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
function BroccoliSassCompiler(inputTree, options) {
  if (Array.isArray(inputTree)) {
    if (inputTree.length > 1) {
      console.warn("Support for passing several trees to BroccoliSassCompiler has been removed.\n" +
                   "Passing the trees to broccoli-merge-trees with the overwrite option set,\n" +
                   "but you should do this yourself if you need to compile CSS files from them\n" +
                   "or use the node-sass includePaths option if you need to import from them.");
      var MergeTrees = require("broccoli-merge-trees");
      inputTree = new MergeTrees(inputTree, {overwrite: true, annotation: "Sass Trees"});
    } else {
      inputTree = inputTree[0];
    }
  }
  options = options || {};
  options.persistentOutput = true;
  BroccoliPlugin.call(this, [inputTree], options);

  this.buildCount = 0;
  this.sass = sass;
  this.options = copyObject(options || {});
  var EventEmitter = require("chained-emitter").EventEmitter;
  this.events = new EventEmitter();

  this.currentTree = null;
  this.dependencies = {};
  this.outputs = {};
  if (options.persistentCache) {
    var AsyncDiskCache = require("async-disk-cache");
    this.persistentCache = new AsyncDiskCache(options.persistentCache);
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

  this.events.addListener("compiled", function(details, result) {
    this.addOutput(details.fullSassFilename, details.fullCssFilename);
    var depFiles = result.stats.includedFiles;
    this.addDependency(details.fullSassFilename, details.fullSassFilename);
    for (var i = 0; i < depFiles.length; i++) {
      this.addDependency(details.fullSassFilename, depFiles[i]);
    }
  }.bind(this));
}

BroccoliSassCompiler.prototype = Object.create(BroccoliPlugin.prototype);
BroccoliSassCompiler.prototype.constructor = BroccoliSassCompiler;
BroccoliSassCompiler.prototype.logCompilationSuccess = function(details, result) {
  var timeInSeconds = result.stats.duration / 1000.0;
  if (timeInSeconds === 0) {
    timeInSeconds = "0.001"; // nothing takes zero seconds.
  }
  var action = this.colors.inverse.green("compile (" + timeInSeconds + "s)");
  var message = details.fullSassFilename + " => " + details.cssFilename;
  console.log(action + " " + message);
};

BroccoliSassCompiler.prototype.logCompilationFailure = function(details, error) {
  var sassFilename = details.sassFilename;
  var action = this.colors.bgRed.white("error");
  var message = this.colors.red(error.message);
  var location = "Line " + error.line + ", Column " + error.column;
  if (error.file.substring(error.file.length - sassFilename.length) !== sassFilename) {
    location = location + " of " + error.file;
  }
  console.log(action + " " + sassFilename + " (" + location + "): " + message);
};

BroccoliSassCompiler.prototype.compileTree = function(srcPath, files, destDir) {
  var self = this;
  var result = files.reduce(function(promises, sassFile) {
    return promises.concat(self.compileSassFile(srcPath, sassFile, destDir));
  }, []);
  return result;
};

BroccoliSassCompiler.prototype.compileSassFile = function(srcPath, sassFilename, destDir) {
  var self = this;
  var sassOptions = copyObject(this.options);
  sassOptions.file = path.join(srcPath, sassFilename);
  var parsedName = parsePath(sassFilename);
  if (this.sassDir && parsedName.dir.slice(0, this.sassDir.length) === this.sassDir) {
    parsedName.dir = parsedName.dir.slice(this.sassDir.length + 1);
  }
  parsedName.ext = ".css";
  parsedName.base = parsedName.name + ".css";
  var cssFileName = path.join(this.cssDir, formatPath(parsedName));
  var promises = [];
  this.optionsGenerator(
    sassFilename, cssFileName, sassOptions,
    function(resolvedCssFileName, resolvedOptions) {
      var details = {
        srcPath: srcPath,
        sassFilename: sassFilename,
        fullSassFilename: resolvedOptions.file,
        destDir: destDir,
        cssFilename: resolvedCssFileName,
        fullCssFilename: path.join(destDir, resolvedCssFileName),
        options: copyObject(resolvedOptions)
      };
      details.options.outFile = details.cssFilename;
      promises.push(self.compileCssFileMaybe(details));
    });
  return promises;
};

BroccoliSassCompiler.prototype.renderer = function() {
  if (this.renderSync) {
    return renderSassSync;
  } else {
    return renderSass;
  }
};

var READ_AS_UTF_8 = {encoding: "utf8"};
var readFile = RSVP.denodeify(fs.readFile);
var writeFile = RSVP.denodeify(fs.writeFile);

/* Check if a dependency's hash has changed.
 *
 * @argument srcDir The directory in which to resolve relative paths against.
 * @argument dep An array of two elements, the first is the file and
 *               the second is the last known hash of that file.
 *
 * Returns a promise that resolves as true when the file hasn't changed from the specified hash.
 **/
BroccoliSassCompiler.prototype.checkDependency = function(srcDir, dep) {
  var self = this;
  var file = path.isAbsolute(dep[0]) ? dep[0] : path.join(srcDir, dep[0]);
  var hexDigest = dep[1];
  return new RSVP.Promise(function(resolve, reject) {
    self.hashForFile(file).then(function(hash) {
      var hd = hash.digest("hex");
      if (hd === hexDigest) {
        resolve(true);
      } else {
        reject(new Error("dependency changed: " + dep[0]));
      }
    }, reject);
  });
};

/* get the cached output for a source file, or receive a cache miss.
 *
 * @argument srcDir The directory in which to resolve relative paths against.
 * @argument relativeFilename The filename relative to the srcDir that is being compiled.
 * @argument options The compilation options.
 *
 * @return Promise that resolves to the cached output of the compiled file or rejects with an
 *   error explaining why the cache wasn't available. In most cases, the cache error will have
 *   a property named `key` that can be used to populate the cache if it's missing. Some error
 *   conditions can't set the key property -- for example when a file is removed or the cache
 *   can't be created.
 **/
BroccoliSassCompiler.prototype.cachedOutput = function(srcDir, relativeFilename, options) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    self.keyForSourceFile(srcDir, relativeFilename, options).then(function(key) {
      self.persistentCache.get(self.dependenciesKey(key)).then(function(cacheEntry) {
        if (cacheEntry.isCached) {
          var dependencies = JSON.parse(cacheEntry.value);
          var depChecks = dependencies.map(function(dep) {
            return self.checkDependency(srcDir, dep);
          });
          RSVP.all(depChecks).
            then(function(depResults) {
              return self.persistentCache.get(self.outputKey(key));
            }).
            then(function(cacheEntry) {
              if (cacheEntry.isCached) {
                var depFiles = dependencies.map(function(depAndHash) {
                  return depAndHash[0];
                });
                resolve([depFiles, JSON.parse(cacheEntry.value)]);
              } else {
                var error = new Error("no output data for " + relativeFilename);
                error.key = key;
                reject(error);
              }
            }).
            catch(function(error) {
              error.key = key;
              reject(error);
            });
        } else {
          var error = new Error("no dependency data for " + relativeFilename);
          error.key = key;
          reject(error);
        }
      });
    }, reject);
  });
};

/* compute the hash for a file.
 *
 * @argument absolutePath The absolute path to the file.
 * @return Promise that resolves to a hash object. rejects if it can't read the file.
 **/
BroccoliSassCompiler.prototype.hashForFile = function(absolutePath) {
  return readFile(absolutePath, READ_AS_UTF_8).then(function(data) {
    return crypto.createHash("md5").update(data);
  });
};

/* construct a base cache key for a file to be compiled.
 *
 * @argument srcDir The directory in which to resolve relative paths against.
 * @argument relativeFilename The filename relative to the srcDir that is being compiled.
 * @argument options The compilation options.
 *
 * @return Promise that resolves to the cache key for the file or rejects if it can't read the file.
 **/
BroccoliSassCompiler.prototype.keyForSourceFile = function(srcDir, relativeFilename, options) {
  var absolutePath = path.join(srcDir, relativeFilename);
  return this.hashForFile(absolutePath).then(function(hash) {
    return relativeFilename + "@" + hash.digest("hex");
  });
};

/* construct a cache key for storing dependency hashes.
 *
 * @argument key The base cache key
 * @return String
 */
BroccoliSassCompiler.prototype.dependenciesKey = function(key) {
  return "[[[dependencies of " + key + "]]]";
};

/* construct a cache key for storing output.
 *
 * @argument key The base cache key
 * @return String
 */
BroccoliSassCompiler.prototype.outputKey = function(key) {
  return "[[[output of " + key + "]]]";
};

/* retrieve the files from cache, write them, and populate the hot cache information
 * for rebuilds.
 */
BroccoliSassCompiler.prototype.handleCacheHit = function(details, inputAndOutputFiles) {
  var self = this;
  var inputFiles = inputAndOutputFiles[0];
  var outputFiles = inputAndOutputFiles[1];
  debug("Persistent cache %s is cached. Writing to %s.",
        details.sassFilename,
        details.fullCssFilename);
  var results = [];
  inputFiles.forEach(function(dep) {
    // populate the dependencies cache for rebuilds
    self.addDependency(details.fullSassFilename, path.resolve(details.srcPath, dep));
  });
  var files = Object.keys(outputFiles);
  debug("cached output files for %s are: %s", details.sassFilename, files.join(", "));
  files.forEach(function(f) {
    var data = outputFiles[f];
    var outputFile = path.join(details.destDir, f);
    // populate the output cache for rebuilds
    self.addOutput(details.fullSassFilename, outputFile);
    var writePromise = mkdirp.promise(path.dirname(outputFile)).
      then(function() {
        return writeFile(outputFile, new Buffer(data, "base64"));
      });
    results.push(writePromise);
  });
  return RSVP.all(results);
};

BroccoliSassCompiler.prototype.dependenciesOf = function(file) {
  return this.dependencies[file] || [];
};

BroccoliSassCompiler.prototype.outputsFrom = function(file) {
  return this.outputs[file] || [];
};

/* hash all dependencies asynchronously and return the files that exist
 * as an array of pairs (filename, hash).
 */
BroccoliSassCompiler.prototype.hashDependencies = function(details) {
  var self = this;
  var dependencyPromises = [];
  self.dependenciesOf(details.fullSassFilename).forEach(function(f) {
    dependencyPromises.push(self.hashForFile(f).then(function(h) {
      if (f.startsWith(details.srcPath)) {
        f = f.substring(details.srcPath.length + 1);
      }
      return [f, h.digest("hex")];
    }).catch(function(e) {
      if (e.code === "ENOENT") {
        debug("Ignoring non-existent file: %s", f);
        return [];
      } else {
        throw e;
      }
    }));
  });
  return RSVP.all(dependencyPromises).then(function(depsWithHashes) {
    return depsWithHashes.filter(function(dwh) {
      return dwh.length > 0; // prune out the dependencies that weren't files.
    });
  });
};

/* read all output files asynchronously and return the contents
 * as a hash of relative filenames to base64 encoded strings.
 */
BroccoliSassCompiler.prototype.readOutputs = function(details) {
  var readPromises = [];
  var outputs = this.outputsFrom(details.fullSassFilename);
  outputs.forEach(function(o) {
    readPromises.push(readFile(o).then(function(buffer) {
      return [o, buffer.toString("base64")];
    }));
  });
  return RSVP.all(readPromises).then(function(outputs) {
    outputContents = {};
    outputs.forEach(function(output) {
      var fileName = output[0];
      var contents = output[1];
      if (fileName.startsWith(details.destDir)) {
        outputContents[fileName.substring(details.destDir.length + 1)] = contents;
      } else {
        debug("refusing to cache output file found outside the output tree: %s", o);
      }
    });
    return outputContents;
  });
};

/* Writes the dependencies and output contents to the persistent cache */
BroccoliSassCompiler.prototype.populateCache = function(key, details, result) {
  var self = this;
  var cache = this.persistentCache;
  var setDeps = self.hashDependencies(details).then(function(depsWithHashes) {
    return cache.set(self.dependenciesKey(key), JSON.stringify(depsWithHashes));
  });

  var setOutput = self.readOutputs(details).then(function(outputContents) {
    return cache.set(self.outputKey(key), JSON.stringify(outputContents));
  });

  return RSVP.all([setDeps, setOutput]);
};

/* When the cache misses, we need to compile the file and then populate the cache if we can. */
BroccoliSassCompiler.prototype.handleCacheMiss = function(details, reason) {
  var self = this;
  var key = reason.key;
  if (key) {
    debug("Persistent cache miss for %s. Reason: %s",
          details.sassFilename,
          reason.message);
  } else {
    debug("Cannot cache %s. Reason: %s",
          details.sassFilename,
          reason.message);
    debug("Stacktrace:", reason.stack);
  }
  return self.compileCssFile(details).
    then(function(result) {
      if (key) {
        return self.populateCache(key, details, result);
      }
    });
};

/* Compile the file if it's not in the cache.
 * Reuse cached output if it is.
 *
 * @argument details The compilation details object.
 *
 * @return A promise that resolves when the output files are written
 *   either from cache or by compiling. Rejects on error.
 */
BroccoliSassCompiler.prototype.compileCssFileMaybe = function(details) {
  var self = this;
  if (this.persistentCache) {
    return this.cachedOutput(details.srcPath, details.sassFilename, details.options).
      then(self.handleCacheHit.bind(self, details),
           self.handleCacheMiss.bind(self, details));
  } else {
    return self.compileCssFile(details);
  }
};

BroccoliSassCompiler.prototype.compileCssFile = function(details) {
  var sass = this.renderer();
  var success = this.handleSuccess.bind(this, details);
  var failure = this.handleFailure.bind(this, details);
  var self = this;

  return this.events.emit("compiling", details)
    .then(function() {
      var dependencyListener = function(absolutePath) {
        self.addDependency(details.fullSassFilename, absolutePath);
      };

      var additionalOutputListener = function(filename) {
        self.addOutput(details.fullSassFilename, filename);
      };

      self.events.addListener("additional-output", additionalOutputListener);
      self.events.addListener("dependency", dependencyListener);

      return sass(details.options)
        .then(function(result) {
          self.events.removeListener("dependency", dependencyListener);
          self.events.removeListener("additional-output", additionalOutputListener);
          return success(result).then(function() {
            return result;
          });
        }, failure);
    });
};

BroccoliSassCompiler.prototype.handleSuccess = function(details, result) {
  mkdirp.sync(path.dirname(details.fullCssFilename));
  fs.writeFileSync(details.fullCssFilename, result.css);
  return this.events.emit("compiled", details, result);
};

BroccoliSassCompiler.prototype.handleFailure = function(details, error) {
  var failed = this.events.emit("failed", details, error);
  var rethrow = failed.finally(function() {
    var message = error.message;
    var location = "    at " + error.file + ":" + error.line + ":" + error.column;
    // TODO: implement fullException
    throw new Error(message + "\n" + location);
  });
  return rethrow;
};

BroccoliSassCompiler.prototype.filesInTree = function(srcPath) {
  var sassDir = this.sassDir || "";
  var files = [];
  if (this.discover) {
    var pattern = path.join(srcPath, sassDir, "**", "[^_]*.scss");
    files = glob.sync(pattern);
  }
  this.sourceFiles.forEach(function(sourceFile) {
    var pattern = path.join(srcPath, sassDir, sourceFile);
    files = files.concat(glob.sync(pattern));
  });
  return unique(files);
};

function Entry(path) {
  var stats = fs.statSync(path);
  this.relativePath = path;
  this.basePath = "/";
  this.mode = stats.mode;
  this.size = stats.size;
  this.mtime = stats.mtime;
}

Entry.prototype.isDirectory = function() {
  return false;
};

BroccoliSassCompiler.prototype.addOutput = function(sassFilename, outputFilename) {
  this.outputs[sassFilename] =
    this.outputs[sassFilename] || new Set();
  this.outputs[sassFilename].add(outputFilename);
};

BroccoliSassCompiler.prototype.clearOutputs = function(files) {
  var self = this;
  files.forEach(function(f) {
    if (self.outputs[f]) {
      delete self.outputs[f];
    }
  });
};

/* This method computes the output files that are only output for at least one given inputs
 * and never for an input that isn't provided.
 *
 * This is important because the same assets might be output from compiling several
 * different inputs for tools like eyeglass assets.
 *
 * @return Set<String> The full paths output files.
 */
BroccoliSassCompiler.prototype.outputsFromOnly = function(inputs) {
  var otherOutputs = new Set();
  var onlyOutputs = new Set();
  var allInputs = Object.keys(this.outputs);
  for (var i = 0; i < allInputs.length; i++) {
    var outputs = this.outputs[allInputs[i]];
    if (inputs.indexOf(allInputs[i]) < 0) {
      outputs.forEach(function(output) {
        otherOutputs.add(output);
      });
    } else {
      outputs.forEach(function(output) {
        onlyOutputs.add(output);
      });
    }
  }
  onlyOutputs.forEach(function(only) {
    if (otherOutputs.has(only)) {
      onlyOutputs.delete(only);
    }
  });
  return onlyOutputs;
};

BroccoliSassCompiler.prototype.addDependency = function(sassFilename, dependencyFilename) {
  this.dependencies[sassFilename] =
    this.dependencies[sassFilename] || new Set();
  this.dependencies[sassFilename].add(dependencyFilename);
};

BroccoliSassCompiler.prototype.clearDependencies = function(files) {
  var self = this;
  files.forEach(function(f) {
    if (self.dependencies[f]) {
      delete self.dependencies[f];
    }
  });
};

BroccoliSassCompiler.prototype.knownDependencies = function() {
  var deps = new Set();
  var sassFiles = Object.keys(this.dependencies);
  for (var i = 0; i < sassFiles.length; i++) {
    var sassFile = sassFiles[i];
    deps.add(sassFile);
    this.dependencies[sassFile].forEach(function (dep) {
      deps.add(dep);
    });
  }
  var entries = [];
  deps.forEach(function(d) {
      try {
        entries.push(new Entry(d));
      } catch (e) {
        // Lots of things aren't files that are dependencies, ignore them.
      }
  });
  return entries;
};

BroccoliSassCompiler.prototype.hasKnownDependencies = function() {
  return Object.keys(this.dependencies).length > 0;
};

function absolutizeEntries(entries) {
  // We make everything absolute because relative path comparisons don't work for us.
  entries.forEach(function(entry) {
    // TODO support windows paths
    entry.relativePath = path.join(entry.basePath, entry.relativePath);
    entry.basePath = "/";
  });
}

BroccoliSassCompiler.prototype.knownDependenciesTree = function(inputPath) {
  var entries = walkSync.entries(inputPath);
  absolutizeEntries(entries);
  var tree = new FSTreeFromEntries(entries);
  tree.addEntries(this.knownDependencies(), {sortAndExpand: true});
  return tree;
};

BroccoliSassCompiler.prototype.build = function() {
  this.buildCount = this.buildCount + 1;
  var self = this;
  var nextTree = null;
  var patches = [];
  var inputPath = this.inputPaths[0];
  var outputPath = this.outputPath;
  var currentTree = this.currentTree;

  function doBuild() {
    if (self.hasKnownDependencies()) {
      debug("caching", "Has known dependencies");
      nextTree = self.knownDependenciesTree(inputPath);
      self.currentTree = nextTree;
      currentTree = currentTree || new FSTree();
      patches = currentTree.calculatePatch(nextTree);
      debug("caching", "currentTree = ", currentTree);
      debug("caching", "nextTree = ", nextTree);
      debug("caching", "patches = ", patches);
    } else {
      debug("caching", "No known dependencies");
    }

    // TODO: handle indented syntax files.
    var treeFiles = removePathPrefix(inputPath, self.filesInTree(inputPath));
    treeFiles = treeFiles.filter(function(f, i) {
      f = path.join(inputPath, f);
      if (self.dependencies[f] === undefined) {
        debug("caching", "building because no deps for", f);
        return true;
      }
      debug("hot cache dependencies are", self.dependencies[f]);
      for (var p = 0; p < patches.length; p++) {
        var entry = patches[p][2];
        debug("looking for", entry.relativePath);
        if (self.dependencies[f].has(entry.relativePath)) {
          debug("caching", "building because", entry.relativePath, "is used by", f);
          return true;
        }
      }
    });

    // Cleanup any unneeded output files
    var removed = [];
    for (var p = 0; p < patches.length; p++) {
      if (patches[p][0] === "unlink") {
        var entry = patches[p][2];
        if (entry.relativePath.indexOf(inputPath) === 0) {
          removed.push(entry.relativePath);
        }
      }
    }
    if (removed.length > 0) {
      var outputs = self.outputsFromOnly(removed);
      outputs.forEach(function(output) {
        if (output.indexOf(outputPath) === 0) {
          fs.unlinkSync(output);
        } else {
          debug("caching", "not removing because outside the outputTree", output);
        }
      });
      self.clearOutputs(removed);
    }

    debug("caching", "building files:", treeFiles);

    var absoluteTreeFiles = treeFiles.map(function(f) {
      return path.join(inputPath, f);
    });

    self.clearDependencies(absoluteTreeFiles);
    self.clearOutputs(absoluteTreeFiles);

    var internalListeners = absoluteTreeFiles.length * 2 + // 1 dep & 1 output listeners each
                            1 +                            // one compilation listener
                            (self.verbose ? 2 : 0);        // 2 logging listeners if in verbose mode

    debug("There are %d internal event listeners.", internalListeners);
    debug("Setting max external listeners to %d via the maxListeners option (default: 10).",
          self.maxListeners);
    self.events.setMaxListeners(internalListeners + self.maxListeners);

    return RSVP.all(self.compileTree(inputPath, treeFiles, outputPath)).finally(function() {
      if (!self.currentTree) {
        self.currentTree = self.knownDependenciesTree(inputPath);
      }
    });
  }

  if (self.buildCount === 1 && process.env["BROCCOLI_EYEGLASS"] === "forceInvalidateCache") {
    debug("clearing perisistent cache because forceInvalidateCache was set.");
    return this.persistentCache.clear().then(doBuild);
  } else {
    return doBuild();
  }
};

module.exports = BroccoliSassCompiler;
