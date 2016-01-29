"use strict";

var fileUtils = require("./files");
var path = require("path");
var validExtensions = [".scss", ".sass", ".css"];
var partialPrefix = "_";

function NameExpander(uri) {
  this.uri = getOsUri(uri);
  this.files = new Set();
}

NameExpander.prototype.addLocation = function(location) {
  if (location && location !== "stdin" && fileUtils.existsSync(location)) {
    // get the full path to the uri
    var fullLocation = path.join(location, this.uri);
    var ext = getValidExtension(fullLocation);

    // if we already have a valid extension...
    if (ext) {
      // add the variants that match only the current extension
      //  path/to/foo.scss -> [path/to/foo.scss, path/to/_foo.scss]
      withFileVariants(path.basename(fullLocation, ext), [ext], function (name) {
        var dir = path.dirname(fullLocation);
        this.files.add(path.join(dir, name));
      }.bind(this));
    } else {
      // otherwise, add all the possible variants in order...
      //   path/to/foo.scss
      //   path/to/foo.sass
      //   path/to/foo.css
      //   path/to/_foo.scss
      //   path/to/_foo.sass
      //   path/to/_foo.css
      withFileVariants(path.basename(fullLocation), null, function (name) {
        var dir = path.dirname(fullLocation);
        this.files.add(path.join(dir, name));
      }.bind(this));

      // then add the `index` variants in order...
      //   path/to/foo/index.scss
      //   path/to/foo/index.sass
      //   path/to/foo/index.css
      //   path/to/foo/_index.scss
      //   path/to/foo/_index.sass
      //   path/to/foo/_index.css
      withFileVariants("index", null, function (name) {
        this.files.add(path.join(fullLocation, name));
      }.bind(this));
    }
  }
};

function getOsUri(uri) {
  return uri.replace(/\//g, path.sep);
}

// iterates through the possible import names
function withFileVariants(name, extensions, callback) {
  extensions = extensions || validExtensions;
  var names = [name];
  // if it's not already a partial, add a partial name
  if (name[0] !== partialPrefix) {
    names.push(partialPrefix + name);
  }

  // with each possible name...
  names.forEach(function(name) {
    // and each possible extension...
    extensions.forEach(function(extension) {
      // hand back the permutation
      callback(name + extension);
    });
  });
}

function getValidExtension(file) {
  var extension = path.extname(file);
  return (validExtensions.indexOf(extension) !== -1) ? extension : null;
}

module.exports = NameExpander;
