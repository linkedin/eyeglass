"use strict";

var path = require("path");
var stringUtils = require("./strings");

var stdSep = "/";
var rAllPathSep = /[\/\\]+/g;
var rIsRelative = /^\.{1,2}/;
var rUriFragments =  /^([^\?#]+)(\?[^#]*)?(#.*)?/;
var rSearchDelim = /^[\?\&]*/;

// TODO - doc
function URI(uri, sep) {
  this.sep = sep || stdSep;
  this.path = "";
  this.search = "";
  this.hash = "";

  var uriFragments = rUriFragments.exec(uri);
  this.setPath(uriFragments[1]);
  this.setQuery(uriFragments[2]);
  this.setHash(uriFragments[3]);
}

// TODO - doc
URI.prototype.setPath = function(pathname) {
  // convert the path separator to standard system paths
  pathname = convertSeparator(pathname, path.sep);
  // then normalize the path
  pathname = path.normalize(pathname);
  // then set it using the specified path
  this.path = convertSeparator(pathname, this.sep);
};

// TODO - doc
URI.prototype.getPath = function(sep, relativeTo) {
  var pathname = this.path;
  if (relativeTo) {
    pathname = convertSeparator(pathname, path.sep);
    relativeTo = convertSeparator(relativeTo, path.sep);
    pathname = path.relative(relativeTo, pathname);
  }
  return convertSeparator(pathname, sep || this.sep);
};

// TODO - doc
URI.prototype.addQuery = function(search) {
  if (!search) {
    return;
  }
  // append the new search string
  // ensuring the leading character is the appropriate delimiter
  this.search += search.replace(rSearchDelim, this.search ? "&" : "?");
};

// TODO - doc
URI.prototype.setQuery = function(search) {
  // reset the search
  this.search = "";
  // then add the new one
  this.addQuery(search);
};

// TODO - doc
URI.prototype.setHash = function(hash) {
  this.hash = hash === undefined ? "" : hash;
};

// TODO - doc
URI.prototype.toString = function(sep) {
  return this.path + this.search + this.hash;
};

// TODO - doc
URI.join = function() {
  var fragments = Array.prototype.slice.call(arguments);
  // join all the non-empty paths
  var uri = new URI(fragments.filter(function(fragment) {
    if (fragment) {
      return fragment;
    }
  }).join(stdSep));
  return uri.getPath();
};

// TODO - doc
URI.isRelative = function(uri) {
  return rIsRelative.test(uri);
};

// TODO - doc
URI.web = function(uri) {
  uri = new URI(uri);
  return uri.toString();
};

// TODO - doc
URI.system = function(uri) {
  uri = new URI(uri);
  return uri.getPath(path.sep);
};

// TODO - doc
URI.sass = function(uri) {
  // escape all backslashes for Sass string and quote it
  //  "C:\foo\bar.png" -> "C:\\foo\\bar.png"
  // actual backslash, for real this time http://www.xkcd.com/1638/
  return stringUtils.quote(uri.replace(/\\/g, "\\\\"));
};

function convertSeparator(uri, sep) {
  return uri.replace(rAllPathSep, sep);
}

module.exports = URI;
