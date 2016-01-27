"use strict";

var NameExpander = require("../lib/util/NameExpander");
var assert = require("assert");
var path = require("path");

describe("NameExpander", function () {
  it("should expand to the correct file names", function() {
    var nameExpander = new NameExpander("test-uri");
    nameExpander.addLocation(__dirname);

    var expectedFiles = adjustPaths([
      "test-uri",
      "test-uri.scss",
      "test-uri.sass",
      "test-uri.css",
      "_test-uri.scss",
      "_test-uri.sass",
      "_test-uri.css",
      "test-uri/index.scss",
      "test-uri/index.sass",
      "test-uri/index.css",
      "test-uri/_index.scss",
      "test-uri/_index.sass",
      "test-uri/_index.css"
    ]);

    assert.deepEqual(setToArray(nameExpander.files), expectedFiles);
  });


  it("should expand to the correct file names with extension", function() {
    var nameExpander = new NameExpander("test-uri.css");
    nameExpander.addLocation(__dirname);

    var expectedFiles = adjustPaths([
      "test-uri.css",
      "test-uri.css.scss",
      "test-uri.css.sass",
      "test-uri.css.css",
      "_test-uri.css.scss",
      "_test-uri.css.sass",
      "_test-uri.css.css",
      "test-uri.css/index.scss",
      "test-uri.css/index.sass",
      "test-uri.css/index.css",
      "test-uri.css/_index.scss",
      "test-uri.css/_index.sass",
      "test-uri.css/_index.css"
    ]);

    assert.deepEqual(setToArray(nameExpander.files), expectedFiles);
  });
});

function adjustPaths(paths) {
  return paths.map(function(file) {
    return path.join(__dirname, file);
  });
}

function setToArray(set) {
  var array = [];
  set.forEach(function(item) {
    array.push(item);
  });
  return array;
}
