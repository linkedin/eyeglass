"use strict";

var sass = require("node-sass");
var path = require("path");
var tmp = require("tmp");
var Eyeglass = require("../lib");
var testutils = require("./testutils");

describe("assets", function () {

 it("should give an error when an asset is not found", function (done) {
   testutils.assertStderr(function(checkStderr) {
     var options = {
       data: "@import 'eyeglass/assets'; div { background-image: asset-url('fake.png'); }"
     };
     var expectedError = "error in C function eyeglass-asset-uri: Asset not found: fake.png\n" +
                         "\n" +
                         "Backtrace:\n" +
                         "	eyeglass/assets:2, in function `eyeglass-asset-uri`\n" +
                         "	eyeglass/assets:2, in function `asset-url`\n" +
                         "	stdin:1";
     testutils.assertCompilationError(options, expectedError, function() {
       checkStderr("");
       done();
     });
   });
 });

 it("should let an app refer to it's own assets", function (done) {
   var input = "@import 'eyeglass/assets'; div { background-image: asset-url('foo.png');" +
               "font: asset-url('foo.woff'); }";
   var expected = "div {\n  background-image: url(/assets/images/foo.png);\n" +
                  "  font: url(/assets/fonts/foo.woff); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     data: input
   }, sass);
   eg.assets("images", "/assets/images", path.join(distDir.name, "public", "assets", "images"));
   eg.assets("fonts", "/assets/fonts", path.join(distDir.name, "public", "assets", "fonts"));

   testutils.assertCompiles(eg, expected, done);
 });

});
