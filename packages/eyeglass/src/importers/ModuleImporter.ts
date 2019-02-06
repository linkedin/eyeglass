import {readFileSync, existsSync} from "fs";
import * as path from "path";
import { NameExpander } from "../util/NameExpander";
import ImportUtilities from "./ImportUtilities";
import { ImporterFactory, ImportedFile } from "./ImporterFactory";

type ImportResultCallback =
  (err: Error | null, data?: ImportedFile) => void;

/*
 * Walks the file list until a match is found. If
 * no matches are found, calls the callback with an error
 */
function readFirstFile(uri: string, possibleFiles: Set<string>, callback: ImportResultCallback) {
  for (let nextFile of possibleFiles) {
    try {
      let data = readFileSync(nextFile, "utf8");
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
    "Could not import " + uri + " from any of the following locations:"
  ].concat(...possibleFiles).join("\n  ");
  callback(new Error(errorMsg));
  return;
}

// This is a bootstrap function for calling readFirstFile.
function readAbstractFile(originalUri: string, uri: string, location: string, includePaths: Array<string>, moduleName: string, callback: ImportResultCallback) {
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


  readFirstFile(originalUri, nameExpander.files, callback);
}

/*
 * Returns an importer suitable for passing to node-sass.
 * options are the eyeglass/node-sass options.
 * fallback importer is the importer that was specified
 * in the node-sass options if one was there.
 */
const ModuleImporter: ImporterFactory = function (eyeglass, sass, options, fallbackImporter) {
  let includePaths = options.includePaths;
  let root = options.eyeglass.root;

  const MODULE_PARSER = /^((?:@[^/]+\/[^/]+)|(?:[^/]+))\/?(.*)/;

  return ImportUtilities.createImporter(function(uri, prev, done) {
    let importUtils = new ImportUtilities(eyeglass, sass, options, fallbackImporter, this);
    let isRealFile = existsSync(prev);
    // pattern to match moduleName/relativePath
    // $1 = moduleName (foo or @scope/foo)
    // $2 = relativePath
    let match = MODULE_PARSER.exec(uri);
    let moduleName = match && match[1];
    let relativePath = match && match[2];
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

    let sassDir: string;

    if (mod) {
      sassDir = mod.sassDir;

      if (!sassDir && !isRealFile) {
        // No sass directory, give an error
        importUtils.fallback(uri, prev, done, function() {
          let missingMessage = "sassDir is not specified in " + mod.name + "'s package.json";
          if (mod.mainPath) {
            missingMessage += " or " + mod.mainPath;
          }
          done(new Error(missingMessage));
        });
        return;
      }
    }

    function createHandler(errorHandler?: (err: Error | string) => void): ImportResultCallback {
      errorHandler = errorHandler || function(err) {
        if (!(err instanceof Error)) {
          err = new Error(err.toString());
        }
        done(err);
      };
      return function(err, data) {
        if (err) {
          importUtils.fallback(uri, prev, done, function() {
            errorHandler(err);
          });
        } else {
          importUtils.importOnce(data, done);
        }
      };
    }

    function handleRelativeImports(includePaths: Array<string>) {
      if (isRealFile) {
        // relative file import, potentially relative to the previous import
        readAbstractFile(uri, uri, path.dirname(prev), includePaths, null, createHandler());
      } else {
        readAbstractFile(uri, uri, root, includePaths, null, createHandler(function() {
          done(new Error("Could not import " + uri + " from " + prev));
        }));
      }
    }

    if (sassDir) {
      // read uri from location. pass no includePaths as this is an eyeglass module
      readAbstractFile(uri, relativePath, sassDir, null, moduleName, createHandler(
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
export default ModuleImporter;