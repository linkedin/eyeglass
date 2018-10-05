"use strict";

var path = require("path");
var ImportUtilities = require("./ImportUtilities");
var fileUtils = require("../util/files");

function FSImporter(eyeglass, sass, options, fallbackImporter) {
  var fsURI = /^fs\(([-_a-zA-Z][-_a-zA-Z0-9]+)\)$/;

  return ImportUtilities.createImporter(function(uri, prev, done) {
    var importUtils = new ImportUtilities(eyeglass, sass, options, fallbackImporter, this);
    var match = uri.match(fsURI);
    if (match) {
      var identifier = match[1];
      var absolutePath = null;
      if (identifier === "root") {
        absolutePath = options.eyeglass.root;
      } else if (!fileUtils.existsSync(prev)) {
        absolutePath = path.resolve(".");
      } else {
        absolutePath = path.resolve(path.dirname(prev));
      }
      /* istanbul ignore else - TODO: revisit this */
      if (absolutePath) {
        var sassContents = '@import "eyeglass/fs"; @include fs-register-path('
                         + identifier + ', "' + absolutePath + '");';
        var data = {
          contents: sassContents,
          file: "fs:" + identifier + ":" + absolutePath
        };
        importUtils.importOnce(data, done);
      } else {
        // TODO (test) - how do we get here? needs test case
        done(new Error("Cannot resolve filesystem location of " + prev));
      }
    } else {
      importUtils.fallback(uri, prev, done, function() {
        done(sass.NULL);
      });
    }
  });
}

module.exports = FSImporter;
