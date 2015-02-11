"use strict";

var fs = require("fs");
var path = require("path");
var resolve = require("./util/resolve");
var efs = require("./util/files");

var IMPORT_REGEX = /^<([^>]+)>(?:\/(.+))?$/;

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
  fs.readFile(filename, function(err, data) {
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

/*
 * Returns an importer suitable for passing to node-sass.
 * options are the eyeglass/node-sass options.
 * fallback importer is the importer that was specified
 * in the node-sass options if one was there.
 */
function makeImporter(eyeglass, sass, options, fallbackImporter) {
  var importedFiles = {};
  var root = options.root;

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
    var match = uri.match(IMPORT_REGEX);

    if (match) {
      // This is an import of the form "<node_module>/some/file"
      var moduleName = match[1];
      var relativePath = match[2];
      var jsFile;

      try {
        jsFile = (isRealFile) ?
                      resolve(moduleName, prev, path.dirname(prev)) :
                      resolve(moduleName, root, root);
      } catch (e) {
        // TODO: https://github.com/sass-eyeglass/eyeglass/issues/2
        console.error(e);
        done({});
        return;
      }
      var sassDir = require(jsFile)(eyeglass, sass).sass;
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

    } else if (prev.indexOf("node_modules") > 0 && isRealFile) {
      // This is a sass file that is potentially relative to the
      // previous import.
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
