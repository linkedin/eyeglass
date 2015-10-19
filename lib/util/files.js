"use strict";

var path = require("path");
var uniq = require("lodash.uniq");

function namify(cb) {
  ["", "_"].forEach(function(prefix) {
    [".scss", ".sass", ".css"].forEach(function(ext) {
      cb(prefix, ext);
    });
  });
}

// This is a helpful debugging function when you are tracing the generation
// of the names[] array. Group the `token` items together to see related
// permutations in the console.
// function printLast(n, token) {
//   token = token || "";
//   console.log(n[n.length - 1], token);
// }

/*
 * Sass imports are usually in an abstract form in that
 * they leave off the partial prefix and the suffix.
 * This code creates the possible extensions.
 *
 * IMPORTANT ORDERING NOTES:
 * We should be checking in the following order:
 * 1. relative paths (based on the origin if set)
 *   a. if the path has an extension, use as-is
 *   b. if needed, create underscore + index + ext permutations
 * 2. node_module expansion (remove the first segment of @import as the module name)
 *   a. if the path has an extension, use as-is
 *   b. if needed, create the expanded path + underscore + index + ext permutations
 *   c. if needed, create the expanded path + subdirectory + underscore + index + ext permutations
 **/
function expandFileName(uri, origin, location) {
  var names = [];

  // normalize uri for our current OS (e.g., foo\bar on Windows)
  var osUri = uri.split("/").join(path.sep);

  // e.g., for osUri "foo\bar\baz", this becomes "bar\baz"
  var osUriSubpath = osUri.split(path.sep).slice(1).join(path.sep);

  // relative paths (based on origin)
  // attempt to build a new location by taking the dirname(origin) as the
  // starting directory, and creating a new location by attaching the uri
  if (origin && origin !== "stdin") {
    namify(function(prefix, ext) {
      var originDir = path.dirname(origin);
      var fullLocation = path.join(originDir, osUri);
      var dir = path.dirname(fullLocation);
      var name = path.basename(fullLocation);

      names.push(fullLocation);
      if (!path.extname(fullLocation).match(/css|scss|sass/)) {
        names.push(path.join(dir, prefix + name + ext));
        names.push(path.join(fullLocation, prefix + "index" + ext));
      }
    });
  }

  // treat the first segment of the uri as the node module name and build
  // a new location string, directory, and filename
  namify(function(prefix, ext) {
    var fullLocation = path.join(location, osUriSubpath);
    var dir = path.dirname(fullLocation);
    var name = path.basename(fullLocation);

    names.push(fullLocation);

    // always add the fullLocation + prefix + index + ext combination
    names.push(path.join(fullLocation, prefix + "index" + ext));

    // if, after removing the node module name from the uri, if there is still
    // path information in the uriSubpath, the `dir` value is meaningful
    // and needs to be checked
    // by adding this test, we avoid printing out and checking the
    // <sassDir>.css variants
    if (osUriSubpath && osUri !== osUriSubpath) {
      names.push(path.join(dir, prefix + name + ext));

      // but also, we want this to work for sass modules, so we need to check
      // against osUri, not just osUriSubpath

      fullLocation = path.join(location, osUri);
      dir = path.dirname(fullLocation);
      name = path.basename(fullLocation);

      names.push(fullLocation);
      names.push(path.join(fullLocation, prefix + "index" + ext));
      names.push(path.join(dir, prefix + name + ext));
    }
  });

  // if the module uri has no slashes, we need to check for location/<moduleName>
  // #37 @import "susy" => <path/to/susy/sassDir/>_susy.scss
  if (uri.indexOf("/") === -1) {
    namify(function(prefix, ext) {
      names.push(path.join(location, prefix + uri + ext));
    });
  }

  return uniq(names);
}

module.exports.expandFileName = expandFileName;
