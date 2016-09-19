"use strict";

var path = require("path");
var validExtensions = [".scss", ".sass", ".css"];
var partialPrefix = "_";

/**
  * provides an interface for expanding a given URI to valid import locations
  *
  * @constructor
  * @param   {String} uri - the base URI to be expanded
  */
function NameExpander(uri) {
  // normalize the uri
  this.uri = normalizeURI(uri);
  // the collection of possible files
  this.files = new Set();
}

/**
  * given a location, expands the collection of possible file imports
  *
  * @param   {String} location - the location path the expand the URI against
  */
NameExpander.prototype.addLocation = function(location) {
  /* istanbul ignore else - defensive conditional, don't care about else-case */
  if (location && location !== "stdin") {
    // get the full path to the uri
    var fullLocation = path.join(location, this.uri);

    // expand the possible variants for the file itself...
    //  path/to/foo.scss:
    //    - path/to/foo.scss
    //    - path/to/_foo.scss
    //  path/to/foo:
    //    - path/to/foo.scss
    //    - path/to/foo.sass
    //    - path/to/foo.css
    //    - path/to/_foo.scss
    //    - path/to/_foo.sass
    //    - path/to/_foo.css
    withFileVariants(path.basename(fullLocation), function (name) {
      var dir = path.dirname(fullLocation);
      this.files.add(path.join(dir, name));
    }.bind(this));

    // if the full location does not contain a valid extension...
    if (!hasValidImportExtension(fullLocation)) {
      // then expand out the `index` variants in order...
      //  path/to/foo:
      //   - path/to/foo/index.scss
      //   - path/to/foo/index.sass
      //   - path/to/foo/index.css
      //   - path/to/foo/_index.scss
      //   - path/to/foo/_index.sass
      //   - path/to/foo/_index.css
      withFileVariants("index", function (name) {
        this.files.add(path.join(fullLocation, name));
      }.bind(this));
    }
  }
};

/**
  * normalizes the URI path
  * @param    {String} uri - the URI to normalize
  * @returns  {String} the normalized URI
  */
function normalizeURI(uri) {
  // update the separator to use the OS separator
  return uri.replace(/\//g, path.sep);
}

/**
  * iterates through the possible import names
  * @param    {String} name - the import base name
  * @param    {Function} callback - the callback to invoke with the given named variant
  */
function withFileVariants(name, callback) {
  // decide whether or not we need to append an extension to the name
  var hasExtension = hasValidImportExtension(name);

  var names = [name];
  // if it's not already a partial, add a partial name
  if (name[0] !== partialPrefix) {
    names.push(partialPrefix + name);
  }

  // with each possible name...
  names.forEach(function(name) {
    // if we need to append an extension...
    if (!hasExtension) {
      // and each possible extension...
      validExtensions.forEach(function(extension) {
        // hand back the permutation
        callback(name + extension);
      });
    } else {
      // otherwise just hand back the name
      callback(name);
    }
  });
}

/**
  * whether or not a given file has a "valid" import extension (.css, .scss, or .sass)
  * @param    {String} file - the file basename
  * @returns  {Boolean} if the file extensions is a valid import
  */
function hasValidImportExtension(file) {
  var extension = path.extname(file);
  return (validExtensions.indexOf(extension) !== -1);
}

module.exports = NameExpander;
