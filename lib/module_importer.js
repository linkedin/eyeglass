"use strict";

var path = require("path");
var NameExpander = require("./util/NameExpander");
var fileUtils = require("./util/files");
var ImportUtilities = require("./import_utils");

/*
 * Asynchronously walks the file list until a match is found. If
 * no matches are found, calls the callback with an error
 */
function readFirstFile(uri, possibleFiles, callback) {
  // we'll keep track of the files we've tried for error handling
  var triedFiles = [];

  // iterates through the possibleFiles until one is successfully read
  // errors if none are readable
  function tryNextFile() {
    // get the next file
    var nextFile = possibleFiles.next().value;
    // if there is a next file...
    if (nextFile) {
      // keep track of it
      triedFiles.push(nextFile);
      // and try to read it
      fileUtils.readFile(nextFile, "utf8", function(err, data) {
        // if it failed, keep trying
        if (err) {
          tryNextFile();
        } else {
          // if it didn't fail, we found the first file so return it
          callback(null, {
            contents: data.toString(),
            file: nextFile
          });
        }
      });
    } else {
      // could not read any of the possible files, so raise an error
      var errorMsg = [
        "Could not import " + uri + " from any of the following locations:"
      ].concat(triedFiles).join("\n  ");
      callback(new Error(errorMsg));
    }
  }

  // try the next (first) file
  tryNextFile();
}

// This is a bootstrap function for calling readFirstFile.
function readAbstractFile(originalUri, uri, location, includePaths, moduleName, callback) {
  // start a name expander to get the names of possible file locations
  var nameExpander = new NameExpander(uri);

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

  var possibleFiles = nameExpander.files.values();

  readFirstFile(originalUri, possibleFiles, callback);
}

/*
 * Returns an importer suitable for passing to node-sass.
 * options are the eyeglass/node-sass options.
 * fallback importer is the importer that was specified
 * in the node-sass options if one was there.
 */
function makeImporter(eyeglass, sass, options, fallbackImporter) {
  var includePaths = options.includePaths;
  var root = options.eyeglass.root;

  return function(uri, prev, done) {
    var importUtils = new ImportUtilities(eyeglass, sass, options, fallbackImporter, this);
    var isRealFile = importUtils.existsSync(prev);
    var fragments = uri.split("/");
    var moduleName = fragments[0];
    var relativePath = fragments.slice(1).join("/");
    var mod = eyeglass.modules.access(moduleName, isRealFile ? prev : root);
    var sassDir;

    if (mod) {
      sassDir = mod.sassDir;

      if (!sassDir && !isRealFile) {
        // No sass directory, give an error
        importUtils.fallback(uri, prev, done, function() {
          var missingMessage = "sassDir is not specified in " + mod.name + "'s package.json";
          if (mod.mainPath) {
            missingMessage += " or " + mod.mainPath;
          }
          done(new Error(missingMessage));
        });
        return;
      }
    }

    function createHandler(errorHandler) {
      errorHandler = errorHandler || function(err) {
        done(new Error(err.toString()));
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

    function handleRelativeImports(includePaths) {
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
  };
}

module.exports = makeImporter;
