import * as fs from "fs";
import * as debug from "../util/debug";
import { URI } from "../util/URI";
import merge from "lodash.merge";
import type { ImporterReturnType, AsyncImporter, AsyncContext } from "node-sass";
import { IEyeglass } from "../IEyeglass";
import { SassImplementation } from "../util/SassImplementation";
import { Config } from "../util/Options";
import { isPresent, Dict } from "../util/typescriptUtils";
import { ImportedFile, ImportContents } from "./ImporterFactory";
import heimdall = require("heimdalljs");

const TIME_IMPORTS = !!(process.env.EYEGLASS_PERF_DEBUGGING);

type ImportContext = AsyncContext & {eyeglass: {imported: Dict<boolean>}};
export type LazyString = () => string;

export type LazyImportedFile = {
  contents: string | LazyString;
  file: string;
};

function hasContents(data: ImportedFile | ImporterReturnType): data is ImportContents {
  return typeof data === "object" && data !== null && typeof (<ImportContents>data).contents === "string";
}

function resolveLazyImport(data: LazyImportedFile): ImportedFile {
  let file = data.file;
  let contents = typeof data.contents === "function" ? data.contents() : data.contents;
  return {file, contents};
}

class ImportSchema {
  uri: string;
  constructor() {
    this.uri = "";
  }
}

export default class ImportUtilities {
  private _isDartSass: boolean;
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
    this._isDartSass = /dart-sass/.test(sass.info);
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
  importOnce(data: {file: string; contents: string | LazyString}, done: (data: ImporterReturnType) => void): void {
    if (this.options.eyeglass.enableImportOnce && this.context.eyeglass.imported[data.file]) {
      // log that we've already imported this file
      /* istanbul ignore next - don't test debug */
      debug.importer("%s was already imported", data.file);
      done(this._adaptResult({contents: "", file: "already-imported:" + data.file}));
    } else {
      this.context.eyeglass.imported[data.file] = true;
      done(this._adaptResult(resolveLazyImport(data)));
    }
  }
  private _adaptResult(data: ImportedFile | ImporterReturnType): ImporterReturnType {
    let result: ImporterReturnType;
    if (hasContents(data)) {
      if (data.file) {
        // Work around for dart-sass incompatibility: https://github.com/sass/dart-sass/issues/975
        if (this._isDartSass && !fs.existsSync(data.file)) {
          // If the file doesn't exist we can't supply the filename or else
          // dart-sass will try to read the file causing an import error.
          result = {contents: data.contents};
        } else {
          // If this is dart-sass:
          //   If the file does exist we supply the filename.
          //   In the short term, this means that sass will read the file again.
          //   Once the bug is fixed the duplicate read won't happen anymore.
          //   In the interim, the duplicate read is required because otherwise
          //   dart-sass won't know the absolute path to the file (this causes
          //   downstream issues in asset imports.)
          // If this isn't dart-sass:
          //   It's fine to pass the filename whether or not the file exists.
          result = {contents: data.contents, file: data.file};
        }
      } else {
        // There's no file, so we don't set the key.
        result = {contents: data.contents};
      }
    } else {
      // All other values are ok to pass through unaltered.
      result = data;
    }
    return result;
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
        if (result === this.sass.types.Null.NULL || !result) {
          noFallback.call(this.context);
        } else {
          done(this._adaptResult(result));
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
        if (result === this.sass.types.Null.NULL || !result) {
          this.fallbackNth(uri, prev, index + 1, done, noFallback);
        } else {
          done(this._adaptResult(result));
        }
      });
    }
  }
}

