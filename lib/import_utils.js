"use strict";

var fs = require("fs");
var debug = require("./util/debug");
var merge = require("lodash.merge");

function ImportUtilities(eyeglass, sass, options, fallbackImporter, context) {
  this.root = options.eyeglass.root;
  this.eyeglass = eyeglass;
  this.sass = sass;
  this.alreadyImported = {};
  this.fallbackImporter = fallbackImporter;
  this.options = options;
  this.context = merge(context, {
    eyeglass: {
      imported: {} // keep track of files already imported @see importOnce
    }
  });
}

ImportUtilities.prototype = {
  // Returns whether a file exists.
  existsSync: function(file) {
    // This fs method is going to be deprecated
    // but can be re-implemented with fs.accessSync later.
    return fs.existsSync(file);
  },

  importOnce: function(data, done) {
    if (this.options.eyeglass.enableImportOnce && this.context.eyeglass.imported[data.file]) {
      // log that we've already imported this file
      debug.import("%s was already imported", data.file);
      done({contents: "", file: "already-imported:" + data.file});
    } else {
      this.context.eyeglass.imported[data.file] = true;
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
      this.fallbackImporter.call(this.context, uri, prev, function(result) {
        if (result === utils.sass.NULL || !result) {
          noFallback.call(this.context);
        } else {
          done(result);
        }
      }.bind(this));
    } else {
      noFallback.call(this.context);
    }
  },

  fallbackNth: function(uri, prev, index, done, noFallback) {
    var utils = this;
    if (index < this.fallbackImporter.length) {
      this.fallbackImporter[index].call(this.context, uri, prev, function(result) {
        if (result === utils.sass.NULL || !result) {
          utils.fallbackNth(uri, prev, index + 1, done, noFallback);
        } else {
          done(result);
        }
      });
    } else {
      noFallback.call(this.context);
    }
  }
};

module.exports = ImportUtilities;
