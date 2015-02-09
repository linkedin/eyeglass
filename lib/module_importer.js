'use strict';

var fs = require("fs"),
    Module = require('module'),
    path = require("path"),
    sass = require('node-sass');

/*
 * Resolves a node module into a path. This uses
 * the node.js internals from the Module API, but the
 * API is marked "5 - Locked" and shouldn't change
 * from here on out. This was done to remove the dependency on
 * node-resolve.
 * API docs: http://nodejs.org/api/modules.html
 * node.js code: https://sourcegraph.com/github.com/joyent/node/
 *   .CommonJSPackage/node/.def/commonjs/lib/module.js/-/_resolveFilename
 */
var resolve = function(id, parent, parentDir) {
  return Module._resolveFilename(id, {
    paths: Module._nodeModulePaths(parentDir),
    filename: parent,
    id: parent
  });
};

/*
 * All imports use the forward slash as a directory
 * delimeter. This function converts to the filesystem's
 * delimeter if it uses an alternate.
 */
var import_path_to_fs_path = function(import_path) {
  var fs_path = import_path;
  if (path.sep != "/") {
    fs_path = fs_path.replace(/\//, path.sep);
  }
  return fs_path;
}

/*
 * Sass imports are usually in an abstract form in that
 * they leave off the partial prefix and the suffix.
 * This code creates the possible extensions, whether it is a partial
 * and whether it is a directory index file having those
 * same possible variations. If the import contains an extension,
 * then it is left alone.
 * */
var concrete_filenames = function(abstract_filename) {
  var names = [];
  if (path.extname(abstract_filename)) {
    names.push(abstract_filename);
  } else {
    var directory = path.dirname(abstract_filename),
        basename  = path.basename(abstract_filename);
    ["", "_"].forEach(function(prefix) {
      [".scss", ".sass"].forEach(function(ext) {
        names.push(path.join(directory, prefix + basename + ext));
      });
    });
    // can avoid these if we check if the path is a directory first.
    ["", "_"].forEach(function(prefix) {
      [".scss", ".sass"].forEach(function(ext) {
        names.push(path.join(abstract_filename, prefix + "index" + ext));
      });
    });
  }
  return names;
}

// This is a bootstrap function for calling find_first_sass_contents.
var read_sass_contents = function(uri, abstract_filename, cb) {
  find_first_sass_contents(uri, concrete_filenames(abstract_filename), [], cb);
}

// returns the sass contents of the first file it find from the list of
// filenames given.
var find_first_sass_contents = function(uri, filenames, examined_filenames, cb) {
  var filename = filenames.shift();
  examined_filenames.push(filename);
  fs.readFile(filename, function(err, data) {
    if (err) {
      if (filenames.length) {
        find_first_sass_contents(uri, filenames, examined_filenames, cb);
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

var eyeglass_import_regex = /^<([^>]+)>(?:\/(.+))?$/;

/*
 * Returns an importer suitable for passing to node-sass.
 * options are the eyeglass/node-sass options.
 * fallback importer is the importer that was specified
 * in the node-sass options if one was there.
 */
var make_eyeglass_importer = function(options, fallback_importer) {
  var root = options.root;
  return function(uri, prev, done) {
    var in_real_file = fs.existsSync(prev);
    var match = uri.match(eyeglass_import_regex)

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
      var sass_dir = require(js_file)({}, sass).sass_dir;
      var abstract_filename_segments = [sass_dir];

      if (relative_path) {
        relative_path = import_path_to_fs_path(relative_path);
        abstract_filename_segments.push(relative_path);
      }

      var abstract_filename = path.join.apply(path, abstract_filename_segments);

      read_sass_contents(uri, abstract_filename, function(err, data) {
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
      var f = path.resolve(path.dirname(prev), import_path_to_fs_path(uri));
      read_sass_contents(uri, f, function(err, data) {
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

module.exports = make_eyeglass_importer;
