"use strict";

var assert = require("assert");
var sass = require("node-sass");
var path = require("path");
var fs = require("fs");
var eyeglass = require("../lib/options_decorator");

function fixtureDirectory(subpath) {
  return path.join(__dirname, "fixtures", subpath);
}

describe("sass version function", function () {
 it("should return the eyeglass version", function (done) {
   var eyeglassVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"))).version;
    sass.render(eyeglass({
      data: "/* Eyeglass version is #{eyeglass-version()} */",
      success: function(result) {
        assert.equal("/* Eyeglass version is " + eyeglassVersion + " */", result.css);
        done();
      }
    }));
 });
 it("should return a module's version", function (done) {
    sass.render(eyeglass({
      root: fixtureDirectory("basic_modules"),
      data: "/* module_a version is #{eyeglass-version('module_a')} */",
      success: function(result) {
        assert.equal("/* module_a version is 1.0.1 */", result.css);
        done();
      }
    }));
 });
});
