"use strict";

var fs = require("fs");
var path = require("path");

function ImportUtilities(eyeglass, sass, options, fallbackImporter) {
  this.root = options.root;
  this.eyeglass = eyeglass;
  this.sass = sass;
  this.alreadyImported = {};
  this.fallbackImporter = fallbackImporter;
}

ImportUtilities.prototype = {
  // Returns whether a file exists.
  existsSync: function(file) {
    // This fs method is going to be deprecated
    // but can be re-implemented with fs.accessSync later.
    return fs.existsSync(file);
  },

  packageRootDir: function(dir) {
    if (this.existsSync(path.join(dir, "package.json"))) {
      return dir;
    } else {
      var parentDir = path.resolve(dir, "..");
      if (parentDir !== dir) {
        return this.packageRootDir(parentDir);
      }
    }
  },

  getModuleByName: function(moduleName, dir) {
    return this.eyeglass.modules.access(moduleName, dir);
  },

  importOnce: function(data, done) {
    if (this.eyeglass.enableImportOnce && this.alreadyImported[data.file]) {
      done({contents: "", file: "already-imported:" + data.file});
    } else {
      this.alreadyImported[data.file] = true;
      done(data);
    }
  },


  // If fallbackImporter is provided and it handles the import
  // then the done callback is invoked with its result.
  // if there is no fallbackImporter or it decides to not handle
  // the import, then the noFallback callback is invoked with no arguments.
  fallback: function(uri, prev, done, noFallback) {
    var utils = this;
    if (this.fallbackImporter && Array.isArray(this.fallbackImporter)) {
      this.fallbackNth(uri, prev, 0, done, noFallback);
    } else if (this.fallbackImporter) {
      this.fallbackImporter(uri, prev, function(result) {
        if (result === utils.sass.NULL || !result) {
          noFallback();
        } else {
          done(result);
        }
      });
    } else {
      noFallback();
    }
  },

  fallbackNth: function(uri, prev, index, done, noFallback) {
    var utils = this;
    if (index < this.fallbackImporter.length) {
      this.fallbackImporter[index](uri, prev, function(result) {
        if (result === utils.sass.NULL || !result) {
          utils.fallbackNth(uri, prev, index + 1, done, noFallback);
        } else {
          done(result);
        }
      });
    } else {
      noFallback();
    }
  }
};

module.exports = ImportUtilities;
