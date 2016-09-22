var path = require("path");
var debug = require("debug")("broccoli-eyeglass");
var fs = require("fs");
var mkdirp = require("mkdirp");
var BroccoliPlugin = require("broccoli-plugin");
var sass = require("node-sass");
var glob = require("glob");
var RSVP = require("rsvp");
var FSTree = require("fs-tree-diff");
var FSTreeFromEntries = FSTree.fromEntries;
var walkSync = require("walk-sync");

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

  this.sass = sass;
  this.options = copyObject(options || {});
  var EventEmitter = require("chained-emitter").EventEmitter;
  this.events = new EventEmitter();

  this.currentTree = null;
  this.dependencies = {};
  this.outputs = {};

  moveOption(this.options, this, "cssDir", "sassDir",
    "optionsGenerator", "fullException",
    "verbose", "renderSync",
    "discover", "sourceFiles");
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
      promises.push(self.compileCssFile(details));
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
          success(result);
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
  var self = this;
  var nextTree = null;
  var patches = [];
  var inputPath = this.inputPaths[0];
  var outputPath = this.outputPath;
  var currentTree = this.currentTree;

  if (this.hasKnownDependencies()) {
    debug("caching", "Has known dependencies");
    nextTree = this.knownDependenciesTree(inputPath);
    this.currentTree = nextTree;
    currentTree = currentTree || new FSTree();
    patches = currentTree.calculatePatch(nextTree);
    debug("caching", "currentTree = ", currentTree);
    debug("caching", "nextTree = ", nextTree);
    debug("caching", "patches = ", patches);
  } else {
    debug("caching", "No known dependencies");
  }

  // TODO: handle indented syntax files.
  var treeFiles = removePathPrefix(inputPath, this.filesInTree(inputPath));
  treeFiles = treeFiles.filter(function(f, i) {
    f = path.join(inputPath, f);
    if (self.dependencies[f] === undefined) {
      debug("caching", "building because no deps for", f);
      return true;
    }
    for (var p = 0; p < patches.length; p++) {
      var entry = patches[p][2];
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
  var outputs = this.outputsFromOnly(removed);
  outputs.forEach(function(output) {
    if (output.indexOf(outputPath) === 0) {
      fs.unlink(output);
    } else {
      debug("caching", "not removing because outside the outputTree", output);
    }
  });

  debug("caching", "building files:", treeFiles);

  var absoluteTreeFiles = treeFiles.map(function(f) {
    return path.join(inputPath, f);
  });

  this.clearDependencies(absoluteTreeFiles);
  this.clearOutputs(absoluteTreeFiles);

  return RSVP.all(self.compileTree(inputPath, treeFiles, outputPath)).finally(function() {
    if (!self.currentTree) {
      self.currentTree = self.knownDependenciesTree(inputPath);
    }
  });
};

module.exports = BroccoliSassCompiler;
