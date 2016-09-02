"use strict";

var path = require("path");
var stringUtils = require("./strings");

var stdSep = "/";
var rAllPathSep = /[\/\\]+/g;
var rIsRelative = /^\.{1,2}/;
var rUriFragments =  /^([^\?#]+)(\?[^#]*)?(#.*)?/;
var rSearchDelim = /^[\?\&]*/;

/**
  * Provides an interface for working with URIs
  *
  * @constructor
  * @param    {String} uri - the original URI
  * @param    {String} sep - the target separator to use when representing the pathname
  */
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

/**
  * sets the new pathname for the URI
  * @param    {String} pathname - the new pathname to set
  */
URI.prototype.setPath = function(pathname) {
  // convert the path separator to standard system paths
  pathname = convertSeparator(pathname, path.sep);
  // then normalize the path
  pathname = path.normalize(pathname);
  // then set it using the specified path
  this.path = convertSeparator(pathname, this.sep);
};

/**
  * gets the pathname of the URI
  * @param    {String} [sep] - the separator to use to represent the pathname
  * @param    {String} [relativeTo] - if set, returns the pathname relative to this base path
  */
URI.prototype.getPath = function(sep, relativeTo) {
  var pathname = this.path;
  if (relativeTo) {
    pathname = convertSeparator(pathname, path.sep);
    relativeTo = convertSeparator(relativeTo, path.sep);
    if (pathname.indexOf(relativeTo) === 0) {
      pathname = path.relative(relativeTo, pathname);
    }
  }
  return convertSeparator(pathname, sep || this.sep);
};

/**
  * adds a query string to the URI
  * @param    {String} search - the query string to append
  */
URI.prototype.addQuery = function(search) {
  if (!search) {
    return;
  }
  // append the new search string
  // ensuring the leading character is the appropriate delimiter
  this.search += search.replace(rSearchDelim, this.search ? "&" : "?");
};

/**
  * replaces the query string on the URI
  * @param    {String} search - the query string to set
  */
URI.prototype.setQuery = function(search) {
  // reset the search
  this.search = "";
  // then add the new one
  this.addQuery(search);
};

/**
  * replaces the hash string on the URI
  * @param    {String} hash - the hash string to set
  */
URI.prototype.setHash = function(hash) {
  this.hash = hash === undefined ? "" : hash;
};

/**
  * returns the URI as a string
  * @returns  {String} the full URI
  */
URI.prototype.toString = function(sep) {
  return this.path + this.search + this.hash;
};

/**
  * given any number of path fragments, joins the non-empty fragments
  * @returns  {String} the joined fragments
  */
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

/**
  * whether or not a given URI is relative
  * @param    {String} uri - the URI to check
  * @returns  {Boolean} whether or not the URI is relative like
  */
URI.isRelative = function(uri) {
  return rIsRelative.test(uri);
};

/**
  * normalizes the URI for use as a web URI
  * @param    {String} uri - the URI to normalize
  * @returns  {String} the normalized URI
  */
URI.web = function(uri) {
  uri = new URI(uri);
  return uri.toString();
};

/**
  * normalizes the URI for use as a system path
  * @param    {String} uri - the URI to normalize
  * @returns  {String} the normalized URI
  */
URI.system = function(uri) {
  uri = new URI(uri);
  return uri.getPath(path.sep);
};

/**
  * ensures that the URI is able to be cleanly exported to a SassString
  * @param    {String} uri - the URI to normalize
  * @returns  {String} the normalized URI
  */
URI.sass = function(uri) {
  // escape all backslashes for Sass string and quote it
  //  "C:\foo\bar.png" -> "C:\\foo\\bar.png"
  // actual backslash, for real this time http://www.xkcd.com/1638/
  return stringUtils.quote(uri.replace(/\\/g, "\\\\"));
};

/**
  * decorates a URI to preserve special characters
  * @param    {String} uri - the URI to decorate
  * @returns  {String} the decorated URI
  */
URI.preserve = function(uri) {
  return uri.replace(/\\/g, "<BACKSLASH>");
};

/**
  * restores a URI to restore special characters (oposite of URI.preserve)
  * @param    {String} uri - the URI to restore
  * @returns  {String} the restored URI
  */
URI.restore = function(uri) {
  return uri.replace(/<BACKSLASH>/g, "\\");
};

function convertSeparator(uri, sep) {
  return shouldNormalizePathSep() ? uri.replace(rAllPathSep, sep) : uri;
}

function shouldNormalizePathSep() {
  // normalize if the path separator is a backslash or we haven't explicitly disabled normalization
  return path.sep === "\\" || process.env.EYEGLASS_NORMALIZE_PATHS !== "false";
}

module.exports = URI;
