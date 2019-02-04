"use strict";
// TODO: Annotate Types

import * as debug from "../util/debug";
import { URI } from "../util/URI";
import merge = require("lodash.merge");

export default class ImportUtilities {
  root: string;
  eyeglass: any;
  sass: any;
  fallbackImporter: any;
  options: any;
  context: any;
  constructor(eyeglass, sass, options, fallbackImporter, context) {
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
  static createImporter(importer) {
    return function (uri, prev, done) {
      uri = URI.web(uri);
      prev = URI.system(prev);
      importer.call(this, uri, prev, done);
    };
  };
  importOnce(data, done) {
    if (this.options.eyeglass.enableImportOnce && this.context.eyeglass.imported[data.file]) {
      // log that we've already imported this file
      /* istanbul ignore next - don't test debug */
      debug.importer("%s was already imported", data.file);
      done({ contents: "", file: "already-imported:" + data.file });
    } else {
      this.context.eyeglass.imported[data.file] = true;
      done(data);
    }
  };
  fallback(uri, prev, done, noFallback) {
    if (this.fallbackImporter && Array.isArray(this.fallbackImporter)) {
      this.fallbackNth(uri, prev, 0, done, noFallback);
    } else if (this.fallbackImporter) {
      this.fallbackImporter.call(this.context, uri, prev, function (result) {
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
  fallbackNth(uri, prev, index, done, noFallback) {
    let fallbackImporter = this.fallbackImporter[index];

    // TODO (test) - how do we get into this condition? needs a test case
    if (!fallbackImporter) {
      noFallback.call(this.context);
    } else {
      fallbackImporter.call(this.context, uri, prev, function (result) {
        if (result === this.sass.NULL || !result) {
          this.fallbackNth(uri, prev, index + 1, done, noFallback);
        } else {
          done(result);
        }
      }.bind(this));
    }
  }
}

