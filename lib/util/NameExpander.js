"use strict";

var fileUtils = require("./files");
var path = require("path");
var rIgnoredExtensions = /^(?:css|scss|sass)$/;

function NameExpander(uri) {
  this.uri = getOsUri(uri);
  this.files = new Set();
}

NameExpander.prototype.getFilesAsArray = function() {
  /* istanbul ignore next - Array.from is node4+ */
  if (Array.from) {
    return Array.from(this.files.values());
  } else {
    var files = [];
    this.files.forEach(function(file) {
      files.push(file);
    });
    return files;
  }
};

NameExpander.prototype.addLocation = function(location, uri) {
  if (location && location !== "stdin" && fileUtils.existsSync(location)) {
    // get the full path to the uri
    var fullLocation = path.join(location, this.uri);

    // always all the full path
    //   path/to/
    this.files.add(fullLocation);

    // if the path to the URI does not end with a valid extension...
    if (!rIgnoredExtensions.test(path.extname(this.uri))) {
      var basename = path.basename(fullLocation);
      // add the variants in order...
      //   path/to/foo.scss
      //   path/to/foo.sass
      //   path/to/foo.css
      //   path/to/_foo.scss
      //   path/to/_foo.sass
      //   path/to/_foo.css
      withVariants(basename, function (variantName) {
        var dir = path.dirname(fullLocation);
        if (dir && variantName) {
          this.files.add(path.join(dir, variantName));
        }
      }.bind(this));

      // then add the `index` variants in order...
      //   path/to/foo/index.scss
      //   path/to/foo/index.sass
      //   path/to/foo/index.css
      //   path/to/foo/_index.scss
      //   path/to/foo/_index.sass
      //   path/to/foo/_index.css
      withVariants("index", function (variantName) {
        this.files.add(path.join(fullLocation, variantName));
      }.bind(this));
    }
  }
};

function getOsUri(uri) {
  return uri.replace(/\//g, path.sep);
}

function withVariants(name, callback) {
  ["", "_"].forEach(function(prefix) {
    // this check ensures we don't prepend `_foo` to `__foo`
    if (name && name[0] !== prefix) {
      [".scss", ".sass", ".css"].forEach(function(suffix) {
        callback(prefix + name + suffix);
      });
    }
  });
}

module.exports = NameExpander;
