"use strict";

var fs = require("fs");
var path = require("path");
var efs = require("./util/files");
var discover = require("./util/discover");

/*
 * All imports use the forward slash as a directory
 * delimeter. This function converts to the filesystem's
 * delimeter if it uses an alternate.
 */
function makeFsPath(importPath) {
  var fsPath = importPath;
  if (path.sep !== "/") {
    fsPath = fsPath.replace(/\//, path.sep);
  }
  return fsPath;
}

// This is a bootstrap function for calling readFirstFile.
function readAbstractFile(uri, abstractName, cb) {
  readFirstFile(uri, efs.getFileNames(abstractName), cb);
}

/*
 * Asynchronously walks the file list until a match is found. If
 * no matches are found, calls the callback with an error
 */
function readFirstFile(uri, filenames, cb, examinedFiles) {
  var filename = filenames.shift();
  examinedFiles = examinedFiles || [];
  examinedFiles.push(filename);
  fs.readFile(filename, "utf8", function(err, data) {
    if (err) {
      if (filenames.length) {
        readFirstFile(uri, filenames, cb, examinedFiles);
      } else {
        cb(new Error("Could not import " + uri +
                     " from any of the following locations: " +
                     examinedFiles.join(", ")));
      }
    } else {
      cb(null, {
        contents: data,
        file: filename
      });
    }
  });
}

function packageRootDir(dir) {
  if (fs.existsSync(path.join(dir, "package.json"))) {
    return dir;
  } else {
    var parentDir = path.resolve(dir, "..");
    if (parentDir !== dir) {
      return packageRootDir(parentDir);
    }
  }
}

/*
 * Returns an importer suitable for passing to node-sass.
 * options are the eyeglass/node-sass options.
 * fallback importer is the importer that was specified
 * in the node-sass options if one was there.
 */
function makeImporter(eyeglass, sass, options, fallbackImporter) {
  var importedFiles = {};
  var root = options.root;
  var allModulesCache = {};

  function eyeglassName(moduleDef) {
   return moduleDef.eyeglass &&
          typeof moduleDef.eyeglass == "object" &&
          moduleDef.eyeglass.name ||
          moduleDef.name;
  }

  function getModuleByName(moduleName, dir) {
    var allModules = allModulesCache[dir];
    if (!allModules) {
      allModules = discover.all(dir, true).modules;
      allModulesCache[dir] = allModules;
    }

    for (var i = 0; i < allModules.length; i++) {
      if (moduleName === eyeglassName(allModules[i])) {
        return allModules[i].main;
      }
    }
  }

  function importOnce(data, done) {
    if (importedFiles[data.file]) {
      done({contents: "", filename: "already-imported:" + data.file});
    } else {
      importedFiles[data.file] = true;
      done(data);
    }
  }

  return function(uri, prev, done) {
    var isRealFile = fs.existsSync(prev);
    var fragments = uri.split("/");
    var moduleName = fragments[0];
    var relativePath = fragments.slice(1).join("/");
    var pkgRootDir = isRealFile ? packageRootDir(path.dirname(prev)) : root;
    var jsFile = getModuleByName(moduleName, pkgRootDir);

    if (jsFile) {
      // is eyeglass module
      var sassDir = require(jsFile)(eyeglass, sass).sassDir;
      if (!sassDir) {
        throw new Error("sassDir is not specified in " + jsFile);
      }

      var filenameSegments = [sassDir];

      if (relativePath) {
        relativePath = makeFsPath(relativePath);
        filenameSegments.push(relativePath);
      }

      var abstractName = path.join.apply(path, filenameSegments);

      readAbstractFile(uri, abstractName, function(err, data) {
        if (err) {
          // TODO: https://github.com/sass-eyeglass/eyeglass/issues/2
          console.log(err.toString());
          done({});
        } else {
          importOnce(data, done);
        }
      });
    } else if (isRealFile) {
      // relative file import, potentially relative to the previous import
      var f = path.resolve(path.dirname(prev), makeFsPath(uri));
      readAbstractFile(uri, f, function(err, data) {
        if (err) {
          // TODO: https://github.com/sass-eyeglass/eyeglass/issues/2
          console.log(err.toString());
          done({});
        } else {
          importOnce(data, done);
        }
      });
    } else if (fallbackImporter) {
      // Not our import
      fallbackImporter(uri, prev, done);
    } else {
      // give up
      done({});
    }
  };
}

module.exports = makeImporter;
