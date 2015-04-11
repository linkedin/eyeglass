var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var CachingWriter = require('broccoli-caching-writer');
var sass = require('node-sass');
var glob = require("glob");
var colors = require('colors/safe');
var RSVP = require('rsvp');
var EventEmitter = require('chained-emitter').EventEmitter;


// node-sass async has bad bugs in it right now.
// var renderSass = RSVP.denodeify(sass.render);

// This promise runs sass synchronously for right now.
function renderSass(options) {
  return new RSVP.Promise(function(resolve, reject) {
    try {
      resolve(sass.renderSync(options));
    } catch (e) {
      reject(e);
    }
  });
}

// Simple copy for options hashes.
function copyObject(obj) {
  var newObj = {};
  for(var key in obj) {
    if(obj.hasOwnProperty(key)) {
      if (typeof obj[key] == "object") {
        newObj[key] = copyObject(obj[key]);
      } else {
        newObj[key] = obj[key];
      }
    }
  }
  return newObj;
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
      delete source[property]
    }
    return destination[property];
  }
}

function removePathPrefix(prefix, fileNames) {
  if (prefix[prefix.length - 1] != path.sep) {
    prefix = prefix + path.sep;
  }
  var newFileNames = [];
  for (var i = 0; i < fileNames.length; i++) {
    if (fileNames[i].indexOf(prefix) == 0) {
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
  cb(cssFile, options)
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
    }
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
    throw new Error("The node-sass option " + property + "cannot be set explicitly.");
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
var BroccoliSassCompiler = CachingWriter.extend({
  init: function(inputTrees, options) {
    this._super.init(inputTrees);
    this.options = copyObject(options || {});
    this.events = new EventEmitter();

    moveOption(this.options, this, "cssDir", "optionsGenerator", "fullException", "verbose");
    if (!this.cssDir) throw new Error('Expected cssDir option.')
    if (!this.optionsGenerator) this.optionsGenerator = defaultOptionsGenerator;
    forbidNodeSassOption(this.options, "file");
    forbidNodeSassOption(this.options, "data");
    forbidNodeSassOption(this.options, "outFile");

    if (this.verbose) {
      this.events.on("compiled", this.logCompilationSuccess.bind(this));
      this.events.on("failed", this.logCompilationFailure.bind(this));
    }
  },

  logCompilationSuccess: function(details, result) {
    var timeInSeconds = result.stats.duration / 1000.0;
    if (timeInSeconds == 0) timeInSeconds = "0.001" // nothing takes zero seconds.
    var action = colors.inverse.green("compile (" + timeInSeconds + "s)");
    var message = details.fullSassFilename + " => " + details.cssFilename;
    console.log(action + " " + message);
  },

  logCompilationFailure: function(details, error) {
    var sassFilename = details.sassFilename;
    var action = colors.bgRed.white("error");
    var message = colors.red(error.message);
    var location = "Line " + error.line + ", Column " + error.column;
    if (error.file.substring(error.file.length - sassFilename.length) != sassFilename) {
      location = location + " of " + error.file;
    }
    console.log(action + " " + sassFilename + " (" + location + "): " + message);
  },

  compileTree: function(srcPath, files, destDir) {
    var self = this;
    var result = files.reduce(function(promises, sassFile) {
      return promises.concat(self.compileSassFile(srcPath, sassFile, destDir));
    }, []);
    return result;
  },

  compileSassFile: function(srcPath, sassFilename, destDir) {
    var self = this;
    var sassOptions = copyObject(this.options);
    sassOptions.file = path.join(srcPath, sassFilename);
    var parsedName = parsePath(sassFilename);
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
  },

  compileCssFile: function(details) {
   var success = this.handleSuccess.bind(this, details);
   var failure = this.handleFailure.bind(this, details);
   return new RSVP.Promise(function(resolve, reject) {
    this.events.emit("compiling", details)
    .then(function() {
     renderSass(details.options)
     .then(success, failure)
     .then(resolve, reject);
    });
   }.bind(this));
  },

  handleSuccess: function(details, result) {
    mkdirp.sync(path.dirname(details.fullCssFilename));
    fs.writeFileSync(details.fullCssFilename, result.css)
    return this.events.emit("compiled", details, result);
  },

  handleFailure: function(details, error) {
    var failed = this.events.emit("failed", details, error);
    var rethrow = failed.finally(function() {
      // TODO: implement fullException
      //RSVP.rethrow(error)
    });
    return RSVP.allSettled([failed, rethrow]);
  },

  updateCache: function(srcPaths, destDir) {
    // TODO: add srcPaths to the includePaths option
    var self = this;
    var files = {};

    for (var i = 0; i < srcPaths.length; i++) {
      // TODO: handle indented syntax files.
      var pattern = path.join(srcPaths[i], "**", "[^_]*.scss");
      files[srcPaths[i]] = removePathPrefix(srcPaths[i], glob.sync(pattern));
    }

    // TODO: limit concurrency?
    var promises = srcPaths.reduce(function (results, srcPath) {
      return results.concat(self.compileTree(srcPath, files[srcPath], destDir))
    }, []);

    return RSVP.allSettled(promises);
  }
});

module.exports = BroccoliSassCompiler;

