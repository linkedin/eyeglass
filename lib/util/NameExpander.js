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

    // if the fullLocation is already a valid extension, just add it
    if (hasValidExtension(fullLocation)) {
      this.files.add(fullLocation);
    } else {
      // otherwise, add all the possible variants in order...
      //   path/to/foo.scss
      //   path/to/foo.sass
      //   path/to/foo.css
      //   path/to/_foo.scss
      //   path/to/_foo.sass
      //   path/to/_foo.css
      withFileVariants(path.basename(fullLocation), function (name) {
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
      withFileVariants("index", function (name) {
        this.files.add(path.join(fullLocation, name));
      }.bind(this));
    }
  }
};

function getOsUri(uri) {
  return uri.replace(/\//g, path.sep);
}

// iterates through the possible import names
function withFileVariants(name, callback) {
  var names = [name];
  // if it's not already a partial, add a partial name
  if (name[0] !== partialPrefix) {
    names.push(partialPrefix + name);
  }

  // with each possible name...
  names.forEach(function(name) {
    // and each possible extension...
    validExtensions.forEach(function(extension) {
      // hand back the permutation
      callback(name + extension);
    });
  });
}

function hasValidExtension(file) {
  var extension = path.extname(file);
  return (validExtensions.indexOf(extension) !== -1);
}

module.exports = NameExpander;
