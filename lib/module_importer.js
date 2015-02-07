'use strict';

var fs = require("fs"),
    path = require("path"),
    resolve = require("resolve"),
    Sass = require('node-sass');

var import_path_to_fs_path = function(import_path) {
  var fs_path = import_path;
  if (path.sep != "/") {
    fs_path = fs_path.replace(/\//, path.sep);
  }
  return fs_path;
}

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
    ["", "_"].forEach(function(prefix) {
      [".scss", ".sass"].forEach(function(ext) {
        names.push(path.join(abstract_filename, prefix + "index" + ext));
      });
    });
  }
  return names;
}

var read_sass_contents = function(uri, abstract_filename, cb) {
  find_first_sass_contents(uri, concrete_filenames(abstract_filename), [], cb);
}

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
var make_eyeglass_importer = function(options, fallback_importer) {
  var root = options.root;
  return function(uri, prev, done) {
    var in_real_file = fs.existsSync(prev);
    var match = uri.match(eyeglass_import_regex)
    if (match) {
      var module_name   = match[1],
          relative_path = match[2];


      try {
        var js_file = resolve.sync(module_name, {
          basedir: in_real_file ? path.dirname(prev) : root });
      } catch (e) {
        console.error(e);
        done({});
        return
      }
      var sass_dir = require(js_file)({}, Sass).sass_dir;
      var abstract_filename_segments = [sass_dir];

      if (relative_path) {
        relative_path = import_path_to_fs_path(relative_path);
        abstract_filename_segments.push(relative_path);
      }

      var abstract_filename = path.join.apply(path, abstract_filename_segments);

      read_sass_contents(uri, abstract_filename, function(err, data) {
        if (err) {
          // TODO: better error handling?
          console.log(err.toString());
          done({});
        } else {
          done(data);
        }
      });

    } else if (prev.indexOf("node_modules") > 0 && in_real_file) {
      var f = path.resolve(path.dirname(prev), import_path_to_fs_path(uri));
      read_sass_contents(uri, f, function(err, data) {
        if (err) {
          // TODO: better error handling?
          console.log(err.toString());
          done({});
        } else {
          done(data);
        }
      });
    } else if (fallback_importer) {
      fallback_importer(uri, prev, done);
    } else {
      done({});
    }
  }
}

module.exports = make_eyeglass_importer;
