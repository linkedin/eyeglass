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
                  "  app-assets: \"images/foo.png\", \"fonts/foo.woff\";\n" +
                  "  mod-assets: \"mod-one/mod-one.jpg\", \"mod-one/subdir/sub.png\"; }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     file: path.join(rootDir, "sass", "uses_mod_1.scss")
   }, sass);

   // asset-url("images/foo.png") => url(public/assets/images/foo.png);
   eg.assets.addSource(rootDir, {pattern: "images/**/*"});
   // asset-url("fonts/foo.ttf") => url(public/assets/fonts/foo.ttf);
   eg.assets.addSource(rootDir, {pattern: "fonts/**/*"});

   testutils.assertCompiles(eg, expected, done);
 });

 it("should allow httpPrefix for app assets", function (done) {
   var expected = ".test {\n" +
                  "  background: url(/assets/images/foo.png);\n" +
                  "  background: url(/assets/fonts/foo.woff); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     file: path.join(rootDir, "sass", "app_assets.scss")
   }, sass);

   // asset-url("images/foo.png") => url(public/assets/images/foo.png);
   eg.assets.addSource(rootDir, {pattern: "images/**/*", httpPrefix: "assets"});
   // asset-url("fonts/foo.ttf") => url(public/assets/fonts/foo.ttf);
   eg.assets.addSource(rootDir, {pattern: "fonts/**/*", httpPrefix: "assets"});

   testutils.assertCompiles(eg, expected, done);
 });

 it("should allow a global httpPrefix for all assets", function (done) {
   var expected = ".test {\n" +
                  "  background: url(/assets/images/foo.png);\n" +
                  "  background: url(/assets/fonts/foo.woff);\n" +
                  "  background: url(/assets/mod-one/mod-one.jpg);\n" +
                  "  background: url(/assets/mod-one/subdir/sub.png); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     assetsHttpPrefix: "assets",
     file: path.join(rootDir, "sass", "both_assets.scss")
   }, sass);

   // asset-url("images/foo.png") => url(public/assets/images/foo.png);
   eg.assets.addSource(rootDir, {pattern: "images/**/*"});
   // asset-url("fonts/foo.ttf") => url(public/assets/fonts/foo.ttf);
   eg.assets.addSource(rootDir, {pattern: "fonts/**/*"});

   testutils.assertCompiles(eg, expected, done);
 });

 it("should nest a asset path entry http prefix inside the global httpPrefix", function (done) {
   var expected = ".test {\n" +
                  "  background: url(/assets/whoa/images/foo.png);\n" +
                  "  background: url(/assets/fonts/foo.woff);\n" +
                  "  background: url(/assets/mod-one/mod-one.jpg);\n" +
                  "  background: url(/assets/mod-one/subdir/sub.png); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     assetsHttpPrefix: "assets",
     file: path.join(rootDir, "sass", "both_assets.scss")
   }, sass);

   // asset-url("images/foo.png") => url(public/assets/images/foo.png);
   eg.assets.addSource(rootDir, {pattern: "images/**/*", httpPrefix: "whoa"});
   // asset-url("fonts/foo.ttf") => url(public/assets/fonts/foo.ttf);
   eg.assets.addSource(rootDir, {pattern: "fonts/**/*"});

   testutils.assertCompiles(eg, expected, done);
 });

 it("register-asset() works", function (done) {
   var input = "@import 'eyeglass/assets';" +
              "@include register-asset(module-a, 'foo/bar.png', 'images/foo/bar.png', $uri: 'assets/foo/bar.png');" +
              ".test { foo: inspect($eg-registered-assets); }";
   var expected = '.test {\n  foo: (module-a: ("foo/bar.png": (filepath: "images/foo/bar.png", uri: "assets/foo/bar.png"))); }\n';
   var rootDir = testutils.fixtureDirectory("app_assets");
   var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     data: input
   }, sass);

   testutils.assertCompiles(eg, expected, done);
 });

 it("allows url mangling", function (done) {
   var expected = ".test {\n" +
                  "  background: url(/assets/images/foo.png);\n" +
                  "  background: url(/assets/fonts/foo.woff);\n" +
                  "  background: url(/assets/mod-one/mod-one.jpg?12345678);\n" +
                  "  background: url(/assets/mod-one/subdir/sub.png?12345678); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     assetsHttpPrefix: "assets",
     file: path.join(rootDir, "sass", "both_assets.scss")
   }, sass);

   eg.assets.addSource(rootDir, {pattern: "images/**/*"});
   eg.assets.addSource(rootDir, {pattern: "fonts/**/*"});

   eg.assets.resolver(function(assetFile, assetUri, oldResolver, finished) {
     if (assetUri.indexOf("mod-one") > 0) {
       finished(null, {
         path: assetUri,
         query: "12345678"
       });
     } else {
       oldResolver(assetFile, assetUri, finished);
     }
   });

   testutils.assertCompiles(eg, expected, done);
 });

});
