"use strict";

var path = require("path");

function namify(cb) {
  ["", "_"].forEach(function(prefix) {
    [".scss", ".sass", ".css"].forEach(function(ext) {
      cb(prefix, ext);
    });
  });
}

function expand(source, onto) {
  if (path.extname(source)) {
    onto.push(source);
    return;
  }

  // underscored versions
  // foo/bar/baz => foo/bar/_baz.scss
  namify(function(prefix, ext) {
    var dir = path.dirname(source);
    var name = path.basename(source);
    onto.push(path.join(dir, prefix + name + ext));
  });

  // indexed versions
  // foo/bar/baz => foo/bar/baz/_index.scss
  namify(function(prefix, ext) {
    onto.push(path.join(source, prefix + "index" + ext));
  });
}

/*
 * Sass imports are usually in an abstract form in that
 * they leave off the partial prefix and the suffix.
 * This code creates the possible extensions, whether it is a partial
 * and whether it is a directory index file having those
 * same possible variations. If the import contains an extension,
 * then it is left alone.
 *
 * IMPORTANT ORDERING NOTES:
 * We should be checking in the following order:
 * 1. the abstractFile with extension
 * 2. the abstractFile/uri             (and its permutations)
 * 3. the abstractFile/uriSub          (and its permutations)
 * 4. the dirname(abstractFile)/uri    (and its permutations)
 * 5. the dirname(abstractFile)/uriSub (and its permutations)
 * 6. the dirname(origin)/uri          (and its permutations)
 * 7. the abstractFile by itself       (and its permutations)
 *
 * uriSub is the original uri, minus the first segment (assumed to be the) node
 * module
 *
 * the permutations are all the possible name variants allowed in Sass load
 * paths, including an optional underscore "_" before the name, treating the
 * uri as a directory and searching for "index", and including the ".sass",
 * ".scss", and ".css" extensions
 **/
function expandFileName(uri, origin, abstractFile) {
  var names = [];
  var osUri = uri.split("/").join(path.sep);
  var uriSubmodule = uri.split("/").slice(1).join(path.sep);
  var abstractDir = path.dirname(abstractFile);
  var originDir = path.dirname(origin);

  if (path.extname(abstractFile)) {
    names.push(abstractFile);
  }

  expand(path.join(abstractFile, osUri), names);
  expand(path.join(abstractFile, uriSubmodule), names);
  expand(path.join(abstractDir, osUri), names);
  expand(path.join(abstractDir, uriSubmodule), names);
  expand(path.join(originDir, osUri), names);
  expand(abstractFile, names);

  return names;
}

module.exports.expandFileName = expandFileName;
