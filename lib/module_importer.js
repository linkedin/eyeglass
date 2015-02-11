'use strict';

var fs      = require("fs");
var resolve = require('./util/resolve');
var path    = require("path");
var sass    = require('node-sass');
var efs     = require('./util/files');

var IMPORT_REGEX = /^<([^>]+)>(?:\/(.+))?$/;

/*
 * All imports use the forward slash as a directory
 * delimeter. This function converts to the filesystem's
 * delimeter if it uses an alternate.
 */
function makeFsPath(importPath) {
  var fsPath = importPath;
  if (path.sep != "/") {
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
                     examined_filenames.join(", ")));
      }
    } else {
      cb(null, {contents: data, file: filename})
    }
  });
}

/*
 * Returns an importer suitable for passing to node-sass.
 * options are the eyeglass/node-sass options.
 * fallback importer is the importer that was specified
 * in the node-sass options if one was there.
 */
function makeImporter(eyeglass, sass, options, fallback_importer) {
  var root = options.root;
  return function(uri, prev, done) {
    var in_real_file = fs.existsSync(prev);
    var match = uri.match(IMPORT_REGEX)

    if (match) {
      // This is an import of the form "<node_module>/some/file"
      var module_name   = match[1],
          relative_path = match[2];

      try {
        var js_file = (in_real_file) ?
                      resolve(module_name, prev, path.dirname(prev)) :
                      resolve(module_name, root, root);
      } catch (e) {
        // TODO: https://github.com/sass-eyeglass/eyeglass/issues/2
        console.error(e);
        done({});
        return;
      }
      var sass_dir = require(js_file)(eyeglass, sass).sass_dir;
      var abstract_filename_segments = [sass_dir];

      if (relative_path) {
        relative_path = makeFsPath(relative_path);
        abstract_filename_segments.push(relative_path);
      }

      var abstract_filename = path.join.apply(path, abstract_filename_segments);

      readAbstractFile(uri, abstract_filename, function(err, data) {
        if (err) {
          // TODO: https://github.com/sass-eyeglass/eyeglass/issues/2
          console.log(err.toString());
          done({});
        } else {
          done(data);
        }
      });

    } else if (prev.indexOf("node_modules") > 0 && in_real_file) {
      // This is a sass file that is potentially relative to the
      // previous import.
      var f = path.resolve(path.dirname(prev), makeFsPath(uri));
      readAbstractFile(uri, f, function(err, data) {
        if (err) {
          // TODO: https://github.com/sass-eyeglass/eyeglass/issues/2
          console.log(err.toString());
          done({});
        } else {
          done(data);
        }
      });
    } else if (fallback_importer) {
      // Not our import
      fallback_importer(uri, prev, done);
    } else {
      // give up
      done({});
    }
  }
}

module.exports = makeImporter;
