"use strict";

var debug = require("../util/debug");
var URI = require("../util/URI");
var merge = require("lodash.merge");

function ImportUtilities(eyeglass, sass, options, fallbackImporter, context) {
  this.root = options.eyeglass.root;
  this.eyeglass = eyeglass;
  this.sass = sass;
  this.fallbackImporter = fallbackImporter;
  this.options = options;
  this.context = merge(context, {
    eyeglass: {
      imported: {} // keep track of files already imported @see importOnce
    }
  });
}

ImportUtilities.createImporter = function(importer) {
  return function(uri, prev, done) {
    uri = URI.web(uri);
    prev = URI.system(prev);
    importer.call(this, uri, prev, done);
  };
};

ImportUtilities.prototype.importOnce = function(data, done) {
  if (this.options.eyeglass.enableImportOnce && this.context.eyeglass.imported[data.file]) {
    // log that we've already imported this file
    /* istanbul ignore next - don't test debug */
    debug.import && debug.import("%s was already imported", data.file);
    done({contents: "", file: "already-imported:" + data.file});
  } else {
    this.context.eyeglass.imported[data.file] = true;
    done(data);
  }
};

ImportUtilities.prototype.fallback = function(uri, prev, done, noFallback) {
  if (this.fallbackImporter && Array.isArray(this.fallbackImporter)) {
    fallbackNth.call(this, uri, prev, 0, done, noFallback);
  } else if (this.fallbackImporter) {
    this.fallbackImporter.call(this.context, uri, prev, function(result) {
      if (result === this.sass.NULL || !result) {
        noFallback.call(this.context);
      } else {
        done(result);
      }
    }.bind(this));
  } else {
    noFallback.call(this.context);
  }
};

function fallbackNth(uri, prev, index, done, noFallback) {
  var fallbackImporter = this.fallbackImporter[index];

  // TODO (test) - how do we get into this condition? needs a test case
  if (!fallbackImporter) {
    noFallback.call(this.context);
  } else {
    fallbackImporter.call(this.context, uri, prev, function(result) {
      if (result === this.sass.NULL || !result) {
        fallbackNth.call(this, uri, prev, index + 1, done, noFallback);
      } else {
        done(result);
      }
    }.bind(this));
  }
}

module.exports = ImportUtilities;
