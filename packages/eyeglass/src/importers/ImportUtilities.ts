import * as debug from "../util/debug";
import { URI } from "../util/URI";
import merge = require("lodash.merge");
import { Importer, ImporterReturnType } from "node-sass";
import { IEyeglass } from "../IEyeglass";
import { SassImplementation } from "../util/SassImplementation";
import { Config } from "../util/Options";
import { unreachable } from "../util/assertions";
import { ImportedFile } from "./ImporterFactory";

export default class ImportUtilities {
  root: string;
  eyeglass: IEyeglass;
  sass: SassImplementation;
  fallbackImporter: Importer | Array<Importer>;
  options: Config;
  context: any;
  constructor(eyeglass: IEyeglass, sass: SassImplementation, options: Config, fallbackImporter: Importer | Array<Importer> | undefined, context: any) {
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
  static createImporter(importer: Importer): Importer {
    return function (uri, prev, done) {
      uri = URI.web(uri);
      prev = URI.system(prev);
      importer.call(this, uri, prev, done);
    };
  }
  importOnce(data: {file: string; contents: string;}, done: (data: ImportedFile) => void) {
    if (this.options.eyeglass.enableImportOnce && this.context.eyeglass.imported[data.file]) {
      // log that we've already imported this file
      /* istanbul ignore next - don't test debug */
      debug.importer("%s was already imported", data.file);
      done({ contents: "", file: "already-imported:" + data.file });
    } else {
      this.context.eyeglass.imported[data.file] = true;
      done(data);
    }
  }
  fallback(uri: string, prev: string, done: (result: ImporterReturnType) => void, noFallback: (this: any) => void) {
    if (Array.isArray(this.fallbackImporter)) {
      if (this.fallbackImporter.length > 0) {
        this.fallbackNth(uri, prev, 0, done, noFallback);
      } else {
        noFallback.call(this.context);
      }
    } else if (this.fallbackImporter) {
      this.fallbackImporter.call(this.context, uri, prev, function (result: ImporterReturnType) {
        if (result === this.sass.NULL || !result) {
          noFallback.call(this.context);
        } else {
          done(result);
        }
      }.bind(this));
    } else {
      noFallback.call(this.context);
    }
  }
  fallbackNth(uri: string, prev: string, index: number, done: (result: ImporterReturnType) => void, noFallback:  (context: any) => void) {
    if (!Array.isArray(this.fallbackImporter)) {
      return done(new Error("[internal error] fallbackNth can only be called for a list of fallbacks."));
    }
    let fallbackImporter = this.fallbackImporter[index];

    // TODO (test) - how do we get into this condition? needs a test case
    if (!fallbackImporter) {
      noFallback.call(this.context);
    } else {
      fallbackImporter.call(this.context, uri, prev, function (result: ImporterReturnType) {
        if (result === this.sass.NULL || !result) {
          this.fallbackNth(uri, prev, index + 1, done, noFallback);
        } else {
          done(result);
        }
      }.bind(this));
    }
  }
}

