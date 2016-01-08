"use strict";

var fs = require("fs");
var path = require("path");
var efs = require("./util/files");
var ImportUtilities = require("./import_utils");


function readFile(file, options, callback) {
  setImmediate(function() {
    var data;
    var err;

    try {
      data = fs.readFileSync(file, options);
    } catch (e) {
      err = e;
    }
    callback(err, data);
  });
};

/*
 * Asynchronously walks the file list until a match is found. If
 * no matches are found, calls the callback with an error
 */
function readFirstFile(uri, possibleNames, filenames, cb) {
  var filename = filenames.shift();
  readFile(filename, "utf8", function(err, data) {
    if (err) {
      if (filenames.length) {
        readFirstFile(uri, possibleNames, filenames, cb);
      } else {
        cb(new Error("Could not import " + uri +
                     " from any of the following locations:\n  " +
                     possibleNames.join("\n  ")));
      }
    } else {
      cb(null, {
        contents: data.toString(),
        file: filename
      });
    }
  });
}

// This is a bootstrap function for calling readFirstFile.
function readAbstractFile(uri, origin, location, includePaths, cb) {
  var possibleNames = efs.expandFileName(uri, origin, location);

  // Useful for further extension/debugging of the algorithm:
  // console.log("Note: uri, origin, location: ", uri, origin, location);

  includePaths.forEach(function(includePath) {
    var includeLocation = path.resolve(location, includePath);
    possibleNames = possibleNames.concat(efs.expandFileName(uri, origin, includeLocation));
  });

  readFirstFile(uri, possibleNames.concat(), possibleNames, cb);
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

  /*eslint-disable */
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

    if (sassDir) {
      // read uri from location. pass no includePaths as this is an eyeglass module
      readAbstractFile(uri, prev, sassDir, [], function(err, data) {
        if (err) {
          importUtils.fallback(uri, prev, done, function() {
            done(new Error(err.toString()));
          });
        } else {
          importUtils.importOnce(data, done);
        }
      });
    } else if (isRealFile) {
      // relative file import, potentially relative to the previous import
      readAbstractFile(uri, prev, path.dirname(prev), includePaths, function(err, data) {
        if (err) {
          importUtils.fallback(uri, prev, done, function() {
            done(err);
          });
        } else {
          importUtils.importOnce(data, done);
        }
      });
    } else {
      readAbstractFile(uri, prev, root, includePaths, function(err, data) {
        if (err) {
          importUtils.fallback(uri, prev, done, function() {
            done(new Error("Could not import " + uri + " from " + prev));
          });
        } else {
          importUtils.importOnce(data, done);
        }
      });
    }
  };
  /*eslint-enable */
}

module.exports = makeImporter;
