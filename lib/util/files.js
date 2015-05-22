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
 * */
function expandFileName(uri, origin, abstractFile) {
  var names = [];
  var osUri = uri.split("/").join(path.sep);
  var uriSubmodule = uri.split("/").slice(1).join(path.sep);
  expand(path.join(path.dirname(abstractFile), osUri), names);
  expand(abstractFile, names);

  // with an origin, check relative paths combined with the uri
  if (origin.indexOf(path.sep) >= 0) {
    expand(path.join(path.dirname(origin), osUri), names);
  }

  // check situations in which we expand the module and then need to resolve
  // the uri relative to the expanded module (loadPaths behavior)
  expand(path.join(abstractFile, osUri), names);
  expand(path.join(abstractFile, uriSubmodule), names);

  return names;
}

module.exports.expandFileName = expandFileName;
