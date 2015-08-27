"use strict";

var sass = require("node-sass");
var path = require("path");
var Eyeglass = require("../lib").Eyeglass;
var testutils = require("./testutils");
var assert = require("assert");
var fse = require("fs-extra");

describe("assets", function () {

 it("should give an error when an asset is not found", function (done) {
   testutils.assertStderr(function(checkStderr) {
     var options = {
       data: "@import 'assets'; div { background-image: asset-url('fake.png'); }"
     };
     var expectedError = "error in C function eyeglass-asset-uri: Asset not found: fake.png\n" +
                         "\n" +
                         "Backtrace:\n" +
                         "	eyeglass/assets:53, in function `eyeglass-asset-uri`\n" +
                         "	eyeglass/assets:53, in function `asset-url`\n" +
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

 it("asset importer should delegate to custom importer", function (done) {
   var input = "@import 'custom';";
   var expected = ".custom {\n" +
                  "  importer: invoked; }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   var eg = new Eyeglass({
     root: rootDir,
     data: input,
     importer: function(uri, prev, importerDone) {
       if (uri === "custom") {
         importerDone({
           contents: ".custom { importer: invoked; }",
           file: "custom"
         });
       }
     }
   }, sass);

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

 it("should allow a relative URLs", function (done) {
   var expected = ".test {\n" +
                  "  background: url(../images/foo.png);\n" +
                  "  background: url(../fonts/foo.woff);\n" +
                  "  background: url(../mod-one/mod-one.jpg);\n" +
                  "  background: url(../mod-one/subdir/sub.png); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     assetsHttpPrefix: "assets",
     file: path.join(rootDir, "sass", "both_assets.scss"),
     assetsRelativeTo: "/assets/subdir"
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
              "@include asset-register(module-a, 'foo/bar.png', 'images/foo/bar.png', " +
              "$uri: 'assets/foo/bar.png');" +
              ".test { foo: inspect($eg-registered-assets); }";
   var expected = '.test {\n  foo: (module-a: ("foo/bar.png": (filepath: "images/foo/bar.png", ' +
                  'uri: "assets/foo/bar.png"))); }\n';
   var rootDir = testutils.fixtureDirectory("app_assets");
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

 it("allows installing assets", function (done) {
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

   var installedAssets = [];

   eg.assets.installer(function(assetFile, assetUri, oldInstaller, finished) {
    testutils.assertFileExists(assetFile);
    installedAssets[assetUri] = true;
    finished(null, assetFile);
   });

   testutils.assertCompiles(eg, expected, function() {
    assert(installedAssets["/assets/images/foo.png"]);
    assert(installedAssets["/assets/fonts/foo.woff"]);
    assert(installedAssets["/assets/mod-one/mod-one.jpg"]);
    assert(installedAssets["/assets/mod-one/subdir/sub.png"]);
    done();
   });
 });

 it("allows installing assets", function (done) {
   var expected = ".test {\n" +
                  "  background: url(/assets/images/foo.png);\n" +
                  "  background: url(/assets/fonts/foo.woff);\n" +
                  "  background: url(/assets/mod-one/mod-one.jpg?12345678);\n" +
                  "  background: url(/assets/mod-one/subdir/sub.png?12345678); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     buildDir: path.join(rootDir, "dist"),
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

   testutils.assertCompiles(eg, expected, function() {
    try {
      testutils.assertFileExists(path.join(rootDir, "dist/assets/images/foo.png"));
      testutils.assertFileExists(path.join(rootDir, "dist/assets/fonts/foo.woff"));
      testutils.assertFileExists(path.join(rootDir, "dist/assets/mod-one/mod-one.jpg"));
      testutils.assertFileExists(path.join(rootDir, "dist/assets/mod-one/subdir/sub.png"));
    } finally {
      fse.remove(path.join(rootDir, "dist"), function(error) {
        done();
      });
    }
   });
 });

 it("Doesn't install into the httpRoot", function (done) {
   var expected = ".test {\n" +
                  "  background: url(/my-app/assets/images/foo.png);\n" +
                  "  background: url(/my-app/assets/fonts/foo.woff);\n" +
                  "  background: url(/my-app/assets/mod-one/mod-one.jpg?12345678);\n" +
                  "  background: url(/my-app/assets/mod-one/subdir/sub.png?12345678); }\n";
   var rootDir = testutils.fixtureDirectory("app_assets");
   //var distDir = tmp.dirSync();
   var eg = new Eyeglass({
     root: rootDir,
     buildDir: path.join(rootDir, "dist"),
     httpRoot: "/my-app",
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

   testutils.assertCompiles(eg, expected, function() {
    try {
      testutils.assertFileExists(path.join(rootDir, "dist/assets/images/foo.png"));
      testutils.assertFileExists(path.join(rootDir, "dist/assets/fonts/foo.woff"));
      testutils.assertFileExists(path.join(rootDir, "dist/assets/mod-one/mod-one.jpg"));
      testutils.assertFileExists(path.join(rootDir, "dist/assets/mod-one/subdir/sub.png"));
    } finally {
      fse.remove(path.join(rootDir, "dist"), function(error) {
        done();
      });
    }
   });
 });

 it("should handle an error in a resolver", function (done) {
   var rootDir = testutils.fixtureDirectory("app_assets");
   var eg = new Eyeglass({
       root: rootDir,
       data: '@import "assets"; .bg { background: asset-url("images/foo.png"); }'
   });

   eg.assets.addSource(rootDir, {pattern: "images/**/*"});

   eg.assets.resolver(function(assetFile, assetUri, oldResolver, finished) {
       finished(new Error("oops I did it again."));
   });

   testutils.assertStderr(function(checkStderr) {
     var expectedError = "error in C function eyeglass-asset-uri: oops I did it again.\n" +
                         "\n" +
                         "Backtrace:\n" +
                         "	eyeglass/assets:53, in function `eyeglass-asset-uri`\n" +
                         "	eyeglass/assets:53, in function `asset-url`\n" +
                         "	stdin:1";
     testutils.assertCompilationError(eg, expectedError, function() {
       checkStderr("");
       done();
     });
   });
 });

 it("should handle a sass error in a resolver", function (done) {
   var rootDir = testutils.fixtureDirectory("app_assets");
   var eg = new Eyeglass({
       root: rootDir,
       data: '@import "assets"; .bg { background: asset-url("images/foo.png"); }'
   });

   eg.assets.addSource(rootDir, {pattern: "images/**/*"});

   eg.assets.resolver(function(assetFile, assetUri, oldResolver, finished) {
       finished(sass.types.Error("oops I did it again."));
   });

   testutils.assertStderr(function(checkStderr) {
     var expectedError = "error in C function eyeglass-asset-uri: oops I did it again.\n" +
                         "\n" +
                         "Backtrace:\n" +
                         "	eyeglass/assets:53, in function `eyeglass-asset-uri`\n" +
                         "	eyeglass/assets:53, in function `asset-url`\n" +
                         "	stdin:1";
     testutils.assertCompilationError(eg, expectedError, function() {
       checkStderr("");
       done();
     });
   });
 });

 it("should give an error when a module does not have assets", function (done) {
   testutils.assertStderr(function(checkStderr) {
     var options = {
       root: testutils.fixtureDirectory("app_assets"),
       data: '@import "non-asset-mod/assets";'
     };
     var expectedError = "No assets specified for eyeglass plugin non-asset-mod";
     testutils.assertCompilationError(options, expectedError, function() {
       checkStderr("");
       done();
     });
   });
 });

 it("should give an error when a module does not exist", function (done) {
   testutils.assertStderr(function(checkStderr) {
     var options = {
       root: testutils.fixtureDirectory("app_assets"),
       data: '@import "no-such-mod/assets";'
     };
     var expectedError = "No eyeglass plugin named: no-such-mod";
     testutils.assertCompilationError(options, expectedError, function() {
       checkStderr("");
       done();
     });
   });
 });

 it("can pretty print an asset path entry", function(done) {
   var rootDir = testutils.fixtureDirectory("app_assets");
   var eyeglass = new Eyeglass({root: rootDir});
   var AssetPathEntry = eyeglass.assets.AssetPathEntry;
   var entry = new AssetPathEntry(rootDir, {
     pattern: "images/**/*"
   });
   assert.equal(entry.toString(), rootDir + "/images/**/*");
   done();
 });

 it("can assign custom glob opts to an asset path entry", function(done) {
   var rootDir = testutils.fixtureDirectory("app_assets");
   var eyeglass = new Eyeglass({root: rootDir});
   var AssetPathEntry = eyeglass.assets.AssetPathEntry;
   var entry = new AssetPathEntry(rootDir, {
     pattern: "images/**/*",
     globOpts: {dot: true}
   });
   assert.equal(entry.globOpts.dot, true);
   done();
 });

 it("asset path entries must be directories", function(done) {
   var rootDir = testutils.fixtureDirectory("app_assets");
   var eyeglass = new Eyeglass({root: rootDir});
   var AssetPathEntry = eyeglass.assets.AssetPathEntry;
   assert.throws(function() {
     var ape = new AssetPathEntry(path.join(rootDir, "package.json"));
     ape = ape; // TODO: Why is this not returned or used?
   });
   done();
 });
});
