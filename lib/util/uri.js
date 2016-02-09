"use strict";

var URI = require("urijs");
var path = require("path");

var stdSep = "/";
var rAllPathSep = /[\/\\]+/g;
var rIsRelative = /^\.{1,2}/;

function join() {
  var fragments = Array.prototype.slice.call(arguments);
  var uri = new URI(fragments.filter(function(fragment) {
    if (fragment) {
      return fragment;
    }
  }).join("/"));
  return uri.normalizePath().toString();
}

function convertSeparator(uri, sep) {
  return uri.replace(rAllPathSep, sep);
}

function normalize(uri, sep) {
  // normalize the path to a standard separator first
  uri = new URI({
    path: convertSeparator(uri, stdSep)
  });
  // then normlize the path
  uri = uri.normalizePath().toString();

  return convertSeparator(uri, sep || path.sep);
}

// convenience method for normalizing system paths
normalize.system = function(uri) {
  return normalize(uri, path.sep);
};

// convenience method for normalizing web paths
normalize.web = function(uri) {
  return normalize(uri, "/");
};

function isRelative(uri) {
  return rIsRelative.test(uri);
}

module.exports = {
  join: join,
  normalize: normalize,
  isRelative: isRelative,
  URI: URI
};
