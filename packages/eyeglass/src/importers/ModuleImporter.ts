import {readFileSync} from "fs";
import { existsSync } from "../util/perf";
import * as path from "path";
import { NameExpander } from "../util/NameExpander";
import ImportUtilities from "./ImportUtilities";
import { ImporterFactory, ImportedFile } from "./ImporterFactory";
import { unreachable } from "../util/assertions";
import type { ImporterReturnType, AsyncImporter } from "node-sass";
import { isPresent } from "../util/typescriptUtils";
import errorFor from "../util/errorFor";
import { BuildCache } from "../util/Options";

const MODULE_PARSER = /^((?:@[^/]+\/[^/]+)|(?:[^/]+))\/?(.*)/;

type ImportResultCallback =
  (err: Error | null, data?: ImportedFile) => void;

/*
 * Walks the file list until a match is found. If
 * no matches are found, calls the callback with an error
 */
function readFirstFile(buildCache: BuildCache, uri: string, possibleFiles: Array<string>, callback: ImportResultCallback): void {
  for (let nextFile of possibleFiles) {
    try {
      // We only read from the cache here, we do not set it.
      // the set will occur for common imports by the calling context
      let data = buildCache.get(`fs.readFileSync(${nextFile})`)
      data = data || readFileSync(nextFile, "utf8");
      // if it didn't fail, we found the first file so return it
      callback(null, {
        contents: data.toString(),
        file: nextFile
      });
      return;
    } catch {
      // pass
    }
  }
  let errorMsg = [
    `\`${uri}\` was not found in any of the following locations:`
  ].concat(...possibleFiles).join("\n  ");
  callback(new Error(errorMsg));
  return;
}

/**
 * The goal of this cache method is to cache the files that are commonly
 * imported. If we see the same import lookups more than once we can
 * assume the import is part of a commonly accessed library and put it into cache.
 * In many cases, this cache ignores the entry point file to a library from
 * outside the library because the first files looked for are relative to the
 * current file (the exception would be if several fils in the same directory
 * import the shared import).
 */
function readFirstFileCached(buildCache: BuildCache, uri: string, files: Array<string>, callback: ImportResultCallback): void {
  let readCacheKey = files.join(";");
  let countKey = `readAbstractFile(${readCacheKey})-count`;
  let invocationCount = buildCache.get(countKey) as number | undefined;
  if (typeof invocationCount === "undefined") { invocationCount = 0; }
  invocationCount += 1;
  buildCache.set(countKey, invocationCount);
  if (invocationCount === 1) {
    readFirstFile(buildCache, uri, files, callback);
  } else {
    let fileKey = `readAbstractFile(${readCacheKey})-file`;
    let file = buildCache.get(fileKey) as string | undefined;
    let contents: string | undefined;
    let contentsKey: string | undefined;
    if (file) {
      contentsKey = `fs.readFileSync(${file})`;
      contents = buildCache.get(contentsKey) as string | undefined;
    }
    if (file && contents) {
      callback(null, {file, contents});
    } else {
      readFirstFile(buildCache, uri, files, (err, data) => {
        if (data && !err) {
          buildCache.set(fileKey, data.file);
          contentsKey = `fs.readFileSync(${data.file})`;
          buildCache.set(contentsKey, data.contents);
        }
        callback(err, data);
      });
    }
  }
}

// This is a bootstrap function for calling readFirstFile.
function readAbstractFile(originalUri: string, uri: string, location: string, includePaths: Array<string> | null, moduleName: string | null, buildCache: BuildCache, callback: ImportResultCallback): void {
  // start a name expander to get the names of possible file locations
  let nameExpander = new NameExpander(uri);

  // add the current location to the name expander
  nameExpander.addLocation(location);

  // if we have a module name, add it as an additional location
  if (moduleName) {
    nameExpander.addLocation(path.join(location, moduleName));
  }

  // if we have includePaths...
  if (includePaths) {
    // add each of includePaths to the name expander
    includePaths.forEach(function(includePath) {
      nameExpander.addLocation(path.resolve(location, includePath));
    });
  }

  let files = new Array(...nameExpander.files);
  readFirstFileCached(buildCache, originalUri, files, callback);
}

/*
 * Returns an importer suitable for passing to node-sass.
 * options are the eyeglass/node-sass options.
 * fallback importer is the importer that was specified
 * in the node-sass options if one was there.
 */
const ModuleImporter: ImporterFactory = function (eyeglass, sass, options, fallbackImporter): AsyncImporter {
  let includePaths = options.includePaths;
  let root = options.eyeglass.root;
  let buildCache = options.eyeglass.buildCache;

  return ImportUtilities.createImporter("module", function(uri, prev, done) {
    let importUtils = new ImportUtilities(eyeglass, sass, options, fallbackImporter, this);
    let isRealFile = existsSync(prev);
    // pattern to match moduleName/relativePath
    // $1 = moduleName (foo or @scope/foo)
    // $2 = relativePath
    let match = MODULE_PARSER.exec(uri);
    if (!match) {
      throw new Error("invalid uri: " + uri);
    }
    let moduleName = match[1];
    let relativePath = match[2];
    let mod = eyeglass.modules.access(moduleName, isRealFile ? prev : root);

    // for back-compat with previous suggestion @see
    // https://github.com/sass-eyeglass/eyeglass/issues/131#issuecomment-210728946
    // if the module was not found and the name starts with `@`...
    if (!mod && moduleName[0] === "@") {
      // reconstruct the moduleName and relativePath the way we would have previously
      let pieces = moduleName.split("/");
      relativePath = pieces[1] + "/" + relativePath;
      moduleName = pieces[0];
      // and try to find it again
      mod = eyeglass.modules.access(moduleName, isRealFile ? prev : root);
    }

    let sassDir: string | undefined;

    if (mod) {
      sassDir = mod.sassDir;

      if (!sassDir && !isRealFile) {
        // No sass directory, give an error
        importUtils.fallback(uri, prev, done, () => {
          if (!mod) { return unreachable(); }
          let missingMessage = "sassDir is not specified in " + mod.name + "'s package.json";
          if (mod.mainPath) {
            missingMessage += " or " + mod.mainPath;
          }
          return done(new Error(missingMessage));
        });
        return;
      }
    }

    function createHandler(errorHandler?: (err: unknown) => void): ImportResultCallback {
      let errHandler: (err: unknown) => void = errorHandler || defaultErrorHandler(done);

      return function(err, data) {
        if (err || !isPresent(data)) {
          importUtils.fallback(uri, prev, done, function() {
            errHandler(err || "[internal error] No data returned.");
          });
        } else {
          importUtils.importOnce(data, done);
        }
      };
    }

    function handleRelativeImports(includePaths: Array<string> | null = null): void {
      if (isRealFile) {
        // relative file import, potentially relative to the previous import
        readAbstractFile(uri, uri, path.dirname(prev), includePaths, null, buildCache, createHandler());
      } else {
        readAbstractFile(uri, uri, root, includePaths, null, buildCache, createHandler(function(err) {
          done(errorFor(err, "Could not import " + uri + " from " + prev));
        }));
      }
    }

    if (sassDir) {
      // read uri from location. pass no includePaths as this is an eyeglass module
      readAbstractFile(uri, relativePath, sassDir, null, moduleName, buildCache, createHandler(
        // if it fails to find a module import,
        //  try to import relative to the current location
        // this handles #37
        handleRelativeImports.bind(null, null)
      ));
    } else {
      handleRelativeImports(includePaths);
    }
  });
}

function defaultErrorHandler(done: (data: ImporterReturnType) => void): (err: unknown) => void {
  return function (err: unknown) {
    done(errorFor(err));
  };
}
export default ModuleImporter;