"use strict";

var sass = require("node-sass");
var Eyeglass = require("../lib").Eyeglass;
var assert = require("assert");

describe("TODO", function () {
  it("should normalize includePaths", function () {
    var includePaths = ["path/one", "path/two", "path/three"];
    var eyeglass = new Eyeglass({
      includePaths: includePaths.join(":")
    });
    var options = eyeglass.sassOptions();
    assert(options);
    assert.deepEqual(options.includePaths, includePaths);
  });
});
