import * as debug from "../util/debug";
import { URI } from "../util/URI";
import merge = require("lodash.merge");
import { ImporterReturnType, AsyncImporter, AsyncContext } from "node-sass";
import { IEyeglass } from "../IEyeglass";
import { SassImplementation } from "../util/SassImplementation";
import { Config } from "../util/Options";
import { isPresent, Dict } from "../util/typescriptUtils";
import { ImportedFile } from "./ImporterFactory";
import heimdall = require("heimdalljs");

const TIME_IMPORTS = !!(process.env.EYEGLASS_PERF_DEBUGGING);

type ImportContext = AsyncContext & {eyeglass: {imported: Dict<boolean>}};
type LazyString = () => string;

class ImportSchema {
  uri: string;
  constructor() {
    this.uri = "";
  }
}

export default class ImportUtilities {
  root: string;
  eyeglass: IEyeglass;
  sass: SassImplementation;
  fallbackImporter: AsyncImporter | Array<AsyncImporter> | undefined;
  options: Config;
  context: ImportContext;
  constructor(eyeglass: IEyeglass, sass: SassImplementation, options: Config, fallbackImporter: AsyncImporter | Array<AsyncImporter> | undefined, context: AsyncContext) {
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
  static createImporter(name: string, importer: AsyncImporter): AsyncImporter {
    return function (uri, prev, doneImporting) {
      let importTimer: heimdall.Cookie<ImportSchema> | undefined;
      if (TIME_IMPORTS) {
        importTimer = heimdall.start(`eyeglass:import:${name}`, ImportSchema);
        importTimer.stats["uri"] = uri;
      }
      let done: typeof doneImporting = (data): void => {
        if (importTimer) { importTimer.stop(); }
        doneImporting(data);
      };
      uri = URI.web(uri);
      prev = URI.system(prev);
      importer.call(this, uri, prev, done);
    };
  }
  importOnce(data: {file: string; contents: string | LazyString}, done: (data: ImportedFile) => void): void {
    if (this.options.eyeglass.enableImportOnce && this.context.eyeglass.imported[data.file]) {
      // log that we've already imported this file
      /* istanbul ignore next - don't test debug */
      debug.importer("%s was already imported", data.file);
      done({ contents: "", file: "already-imported:" + data.file });
    } else {
      this.context.eyeglass.imported[data.file] = true;
      let file = data.file;
      let contents = typeof data.contents === "function" ? data.contents() : data.contents;
      done({file, contents});
    }
  }
  fallback(uri: string, prev: string, done: (result: ImporterReturnType) => void, noFallback: (this: ImportContext) => void): void {
    if (Array.isArray(this.fallbackImporter)) {
      if (this.fallbackImporter.length > 0) {
        this.fallbackNth(uri, prev, 0, done, noFallback);
      } else {
        noFallback.call(this.context);
      }
    } else if (isPresent(this.fallbackImporter)) {
      this.fallbackImporter.call(this.context, uri, prev, (result: ImporterReturnType) => {
        if (result === this.sass.NULL || !result) {
          noFallback.call(this.context);
        } else {
          done(result);
        }
      });
    } else {
      noFallback.call(this.context);
    }
  }
  fallbackNth(uri: string, prev: string, index: number, done: (result: ImporterReturnType) => void, noFallback:  (this: ImportContext) => void): void {
    if (!Array.isArray(this.fallbackImporter)) {
      return done(new Error("[internal error] fallbackNth can only be called for a list of fallbacks."));
    }
    let fallbackImporter = this.fallbackImporter[index];

    // TODO (test) - how do we get into this condition? needs a test case
    if (!fallbackImporter) {
      noFallback.call(this.context);
    } else {
      fallbackImporter.call(this.context, uri, prev, (result: ImporterReturnType) => {
        if (result === this.sass.NULL || !result) {
          this.fallbackNth(uri, prev, index + 1, done, noFallback);
        } else {
          done(result);
        }
      });
    }
  }
}

