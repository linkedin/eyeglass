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
       data: "@import 'assets'; div { background-image: asset-url('fake.png'); }"
     };
     var expectedError = "error in C function eyeglass-asset-uri: Asset not found: fake.png\n" +
                         "\n" +
                         "Backtrace:\n" +
                         "	eyeglass/assets:36, in function `eyeglass-asset-uri`\n" +
                         "	eyeglass/assets:36, in function `asset-url`\n" +
                         "	stdin:1";
     testutils.assertCompilationError(options, expectedError, function() {
       checkStderr("");
       done();
     });
   });
 });

 it("should let an app refer to it's own assets", function (done) {
   var input = "@import 'assets'; div { background-image: asset-url('images/foo.png');" +
               "font: asset-url('fonts/foo.woff'); }";
   var expected = "div {\n  background-image: url(/images/foo.png);\n" +
                  "  font: url(/fonts/foo.woff); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     data: input
   }, sass);
   // asset-url("images/foo.png") => url(public/assets/images/foo.png);
   eg.assets.addSource(rootDir, {pattern: "images/**/*"});
   // asset-url("fonts/foo.ttf") => url(public/assets/fonts/foo.ttf);
   eg.assets.addSource(rootDir, {pattern: "fonts/**/*"});

   testutils.assertCompiles(eg, expected, done);
 });

 it("should import a module's assets", function (done) {
   var expected = ".test {\n" +
                  "  background: url(/mod-one/mod-one.jpg);\n" +
                  "  background: url(/mod-one/subdir/sub.png); }\n" +
                  "\n" +
                  ".all-assets {\n" +
                  "  mod-assets: \"mod-one/mod-one.jpg\", \"mod-one/subdir/sub.png\"; }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     file: path.join(rootDir, "sass", "uses_mod_1.scss")
   }, sass);

   testutils.assertCompiles(eg, expected, done);
 });
});
