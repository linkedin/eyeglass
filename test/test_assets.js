"use strict";

var assert = require("assert");
var sass = require("node-sass");
var path = require("path");
var tmp = require("tmp");
var eyeglass = require("../lib/options_decorator");
var Eyeglass = require("../lib");
var capture = require("../lib/util/capture");

function fixtureDirectory(subpath) {
  return path.join(__dirname, "fixtures", subpath);
}

function assertMultilineEqual(string1, string2) {
  var lines1 = string1.split("\n");
  var lines2 = string2.split("\n");
  assert.equal(lines1.length, lines2.length, "Number of lines differ.");
  for (var lineNumber = 0; lineNumber < lines1.length; lineNumber++) {
    assert.equal(lines1[lineNumber], lines2[lineNumber], "Line #" + lineNumber + "differs.");
  }
}

describe("assets", function () {

 it("should give an error when an asset is not found", function (done) {
   var output = "";
   var release = capture(function(string) {
     output = output + string;
   }, "stderr");
    sass.render(eyeglass({
      data: "@import '<eyeglass>/assets'; div { background-image: asset-url('fake.png'); }",
      success: function(result) {
        release();
        assert(false, "should not have compiled to: " + result.css);
        done();
      },
      error: function(error) {
        var expected_error_message = "error in C function eyeglass-asset-uri: Asset not found: fake.png\n" +
                                     "Backtrace:\n" +
                                     "	sass/assets.scss:2, in function `eyeglass-asset-uri`\n" +
                                     "	sass/assets.scss:2, in function `asset-url`\n" +
                                     "	stdin:1";
        assertMultilineEqual(expected_error_message, error.message);
        done();
      }
    }));
 });

 it("should let an app refer to it's own assets", function (done) {
   var input = "@import '<eyeglass>/assets'; div { background-image: asset-url('foo.png'); font: asset-url('foo.woff'); }";
   var expected = "div {\n  background-image: url(/assets/images/foo.png);\n  font: url(/assets/fonts/foo.woff); }\n";
   var rootDir = fixtureDirectory("app_assets");
   var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     data: input,
     success: function(result) {
       assert.equal(expected, result.css);
       done();
     }
   }, sass);
   eg.assets("images", "/assets/images", path.join(distDir.name, "public", "assets", "images"));
   eg.assets("fonts", "/assets/fonts", path.join(distDir.name, "public", "assets", "fonts"));
   sass.render(eg.sassOptions());
 });

});
