"use strict";

var path = require("path");

/*
 * Sass imports are usually in an abstract form in that
 * they leave off the partial prefix and the suffix.
 * This code creates the possible extensions, whether it is a partial
 * and whether it is a directory index file having those
 * same possible variations. If the import contains an extension,
 * then it is left alone.
 * */
function getFileNames(abstractName) {
  var names = [];
  if (path.extname(abstractName)) {
    names.push(abstractName);
  } else {
    var directory = path.dirname(abstractName);
    var basename = path.basename(abstractName);

    ["", "_"].forEach(function(prefix) {
      [".scss", ".sass"].forEach(function(ext) {
        names.push(path.join(directory, prefix + basename + ext));
      });
    });

    // can avoid these if we check if the path is a directory first.
    ["", "_"].forEach(function(prefix) {
      [".scss", ".sass"].forEach(function(ext) {
        names.push(path.join(abstractName, prefix + "index" + ext));
      });
    });
  }
  return names;
}

module.exports.getFileNames = getFileNames;
