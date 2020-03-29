"use strict";

var path = require("path");
var testutils = require("./testutils");
var assert = require("assert");
var fse = require("fs-extra");
var glob = require("glob");

var Eyeglass = require("../lib");
var AssetsSource = require("../lib/assets/AssetsSource").default;
var AssetsCollection = require("../lib/assets/AssetsCollection").default;

function escapeBackslash(str) {
  return str.replace(/\\/g, "\\\\");
}

describe("assets", function () {
  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    describe(`with ${sassName}`, function () {
      // run assets.install with both installWithSymlinks enabled and disabled:
      [true, false].forEach(function (installWithSymlinks) {
        describe("installWithSymlinks: " + installWithSymlinks, function () {
          it("should give an error when an asset is not found", function (done) {
            testutils.assertStderr(function (checkStderr) {
              var options = {
                data: "@import 'assets'; div { background-image: asset-url('fake.png'); }"
              };
              var expectedError = { message: "Asset not found: fake.png" };
              sassTestUtils.assertCompilationError(options, expectedError, function () {
                checkStderr("");
                done();
              });
            });
          });

          it("should let an app refer to it's own assets", function (done) {
            var input = "@import 'assets'; div { background-image: asset-url('images/foo.png');" +
              "font: asset-url('fonts/foo.woff'); }";
            var expected = "div {\n  background-image: url(\"/images/foo.png\");\n" +
              "  font: url(\"/fonts/foo.woff\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              data: input,
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                engines: {
                  sass: sass
                }
              }
            });
            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            // asset-url("fonts/foo.ttf") => url("public/assets/fonts/foo.ttf");
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("asset importer should delegate to custom importer", function (done) {
            var input = "@import 'custom';";
            var expected = ".custom {\n" +
              "  importer: invoked;\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              data: input,
              importer: function (uri, prev, importerDone) {
                if (uri === "custom") {
                  importerDone({
                    contents: ".custom { importer: invoked; }",
                    file: "custom"
                  });
                } else {
                  importerDone(null);
                }
              },
              eyeglass: {
                installWithSymlinks: installWithSymlinks,
                root: rootDir,
                engines: {
                  sass: sass
                }
              }
            });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should import a module's assets", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"/mod-one/mod-one.jpg\");\n" +
              "  background: url(\"/mod-one/subdir/sub.png\");\n}\n" +
              "\n" +
              ".all-assets {\n" +
              "  app-assets: \"images/foo.png\", \"fonts/foo.woff\";\n" +
              "  mod-assets: \"mod-one/mod-one.jpg\", \"mod-one/subdir/sub.png\";\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "uses_mod_1.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                engines: {
                  sass: sass
                }
              }
            });

            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            // asset-url("fonts/foo.ttf") => url("public/assets/fonts/foo.ttf");
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should import own assets from within a module", function (done) {
            var expected = [
              "/* index */",
              ".test {",
              "  background: url(\"/mod-one/mod-one.jpg\");",
              "  background: url(\"/mod-one/subdir/sub.png\");\n}\n",
              ".all-assets {",
              "  mod-assets: \"mod-one/mod-one.jpg\", \"mod-one/subdir/sub.png\";\n}\n"
            ].join("\n");
            var root = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              data: "@import 'mod-one';",
              eyeglass: {
                root,
                installWithSymlinks,
                engines: {
                  sass
                }
              }
            });

            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(root, { pattern: "images/**/*" });
            // asset-url("fonts/foo.ttf") => url("public/assets/fonts/foo.ttf");
            eg.assets.addSource(root, { pattern: "fonts/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should allow httpPrefix for app assets", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"/assets/images/foo.png\");\n" +
              "  background: url(\"/assets/fonts/foo.woff\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "app_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                engines: {
                  sass: sass
                }
              }
            });

            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*", httpPrefix: "assets" });
            // asset-url("fonts/foo.ttf") => url("public/assets/fonts/foo.ttf");
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*", httpPrefix: "assets" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should allow a global httpPrefix for all assets", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"/assets/images/foo.png\");\n" +
              "  background: url(\"/assets/fonts/foo.woff\");\n" +
              "  background: url(\"/assets/mod-one/mod-one.jpg\");\n" +
              "  background: url(\"/assets/mod-one/subdir/sub.png\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  httpPrefix: "assets"
                },
                engines: {
                  sass: sass
                }
              }
            });

            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            // asset-url("fonts/foo.ttf") => url("public/assets/fonts/foo.ttf");
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should allow a relative URLs", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"../images/foo.png\");\n" +
              "  background: url(\"../fonts/foo.woff\");\n" +
              "  background: url(\"../mod-one/mod-one.jpg\");\n" +
              "  background: url(\"../mod-one/subdir/sub.png\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  httpPrefix: "assets",
                  relativeTo: "/assets/subdir",
                },
                engines: {
                  sass: sass
                }
              }
            });

            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            // asset-url("fonts/foo.ttf") => url("public/assets/fonts/foo.ttf");
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should allow a relative URLs when httpRoot is set", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"../images/foo.png\");\n" +
              "  background: url(\"../fonts/foo.woff\");\n" +
              "  background: url(\"../mod-one/mod-one.jpg\");\n" +
              "  background: url(\"../mod-one/subdir/sub.png\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                httpRoot: "/foo/",
                assets: {
                  httpPrefix: "assets",
                  relativeTo: "/assets/subdir",
                },
                engines: {
                  sass: sass
                }
              }
            });

            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            // asset-url("fonts/foo.ttf") => url("public/assets/fonts/foo.ttf");
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should nest a asset path entry http prefix inside the global httpPrefix", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"/assets/whoa/images/foo.png\");\n" +
              "  background: url(\"/assets/fonts/foo.woff\");\n" +
              "  background: url(\"/assets/mod-one/mod-one.jpg\");\n" +
              "  background: url(\"/assets/mod-one/subdir/sub.png\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              installWithSymlinks: installWithSymlinks,
              eyeglass: {
                root: rootDir,
                assets: {
                  httpPrefix: "assets"
                },
                engines: {
                  sass: sass
                }
              }
            });

            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*", httpPrefix: "whoa" });
            // asset-url("fonts/foo.ttf") => url("public/assets/fonts/foo.ttf");
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("register-asset() works", function (done) {
            var input = "@import 'eyeglass/assets';" +
              "@include asset-register(module-a, 'foo/bar.png', 'images/foo/bar.png', " +
              "$uri: 'assets/foo/bar.png');" +
              ".test { foo: inspect(map-get(map-get($eg-registered-assets, module-a), 'foo/bar.png')); }";
            var filepath = path.join("images", "foo", "bar.png").replace(/\\/g, "\\\\");
            var expected = '.test {\n  foo: (filepath: "' + filepath + '", ' +
              'uri: "assets/foo/bar.png");\n}\n';
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              data: input,
              eyeglass: {
                installWithSymlinks: installWithSymlinks,
                root: rootDir,
                engines: {
                  sass: sass
                }
              }
            });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("allows url mangling", function (done) {
            var expected = [
              "/assets/images/foo.png",
              "/assets/fonts/foo.woff",
              "/assets/mod-one/mod-one.jpg?12345678",
              "/assets/mod-one/subdir/sub.png?12345678",
              "/assets/mod-one/subdir/sub.png?q=true&12345678#hash"
            ].map(function (uri) {
              return "  background: url(\"" + uri + "\");";
            });
            expected = ".test {\n" + expected.join("\n") + "\n}\n";

            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets_with_url_fragments.scss"),
              eyeglass: {
                installWithSymlinks: installWithSymlinks,
                root: rootDir,
                assets: {
                  httpPrefix: "assets"
                },
                engines: {
                  sass: sass
                }
              }
            });

            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            eg.assets.resolver(function (assetFile, assetUri, oldResolver, finished) {
              if (assetUri.indexOf("mod-one") > 0) {
                finished(null, {
                  path: assetUri,
                  query: "12345678"
                });
              } else {
                oldResolver(assetFile, assetUri, finished);
              }
            });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("allows installing assets", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"/assets/images/foo.png\");\n" +
              "  background: url(\"/assets/fonts/foo.woff\");\n" +
              "  background: url(\"/assets/mod-one/mod-one.jpg?12345678\");\n" +
              "  background: url(\"/assets/mod-one/subdir/sub.png?12345678\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  httpPrefix: "assets"
                },
                engines: {
                  sass: sass
                }
              }
            });

            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            eg.assets.resolver(function (assetFile, assetUri, oldResolver, finished) {
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

            eg.assets.installer(function (assetFile, assetUri, oldInstaller, finished) {
              testutils.assertFileExists(assetFile);
              installedAssets[assetUri] = true;
              finished(null, assetFile);
            });

            sassTestUtils.assertCompiles(eg, expected, function () {
              assert(installedAssets["/assets/images/foo.png"]);
              assert(installedAssets["/assets/fonts/foo.woff"]);
              assert(installedAssets["/assets/mod-one/mod-one.jpg"]);
              assert(installedAssets["/assets/mod-one/subdir/sub.png"]);
              done();
            });
          });

          it("allows installing assets", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"/assets/images/foo.png\");\n" +
              "  background: url(\"/assets/fonts/foo.woff\");\n" +
              "  background: url(\"/assets/mod-one/mod-one.jpg?12345678\");\n" +
              "  background: url(\"/assets/mod-one/subdir/sub.png?12345678\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                buildDir: path.join(rootDir, "dist"),
                assets: {
                  httpPrefix: "assets"
                },
                engines: {
                  sass: sass
                }
              }
            });

            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            eg.assets.resolver(function (assetFile, assetUri, oldResolver, finished) {
              if (assetUri.indexOf("mod-one") > 0) {
                finished(null, {
                  path: assetUri,
                  query: "12345678"
                });
              } else {
                oldResolver(assetFile, assetUri, finished);
              }
            });

            sassTestUtils.assertCompiles(eg, expected, function () {
              try {
                testutils.assertFileExists(path.join(rootDir, "dist/assets/images/foo.png"));
                testutils.assertFileExists(path.join(rootDir, "dist/assets/fonts/foo.woff"));
                testutils.assertFileExists(path.join(rootDir, "dist/assets/mod-one/mod-one.jpg"));
                testutils.assertFileExists(path.join(rootDir, "dist/assets/mod-one/subdir/sub.png"));
              } finally {
                fse.remove(path.join(rootDir, "dist"), function (error) {
                  done();
                });
              }
            });
          });

          it("handles asset installer errors", function (done) {
            var errorMessage = "throws installer error";
            var expectedError = {
              message: "Unable to install asset: " + errorMessage
            };

            var rootDir = testutils.fixtureDirectory("app_assets");
            var eyeglass = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  sources: [
                    { directory: rootDir, pattern: "images/**/*" },
                    { directory: rootDir, pattern: "fonts/**/*" }
                  ]
                },
                engines: {
                  sass: sass
                }
              }
            });

            testutils.assertStderr(function (checkStderr) {
              // simulate an installer error
              eyeglass.assets.installer(function (assetFile, assetUri, oldInstaller, finished) {
                finished(new Error(errorMessage));
              });
              checkStderr("");
              sassTestUtils.assertCompilationError(eyeglass, expectedError, function () {
                done();
              });
            });
          });

          it("should not install into the httpRoot", function (done) {
            var expected = ".test {\n" +
              "  background: url(\"/my-app/assets/images/foo.png\");\n" +
              "  background: url(\"/my-app/assets/fonts/foo.woff\");\n" +
              "  background: url(\"/my-app/assets/mod-one/mod-one.jpg?12345678\");\n" +
              "  background: url(\"/my-app/assets/mod-one/subdir/sub.png?12345678\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                buildDir: path.join(rootDir, "dist"),
                httpRoot: "/my-app",
                assets: {
                  httpPrefix: "assets"
                },
                engines: {
                  sass: sass
                }
              }
            });

            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            eg.assets.resolver(function (assetFile, assetUri, oldResolver, finished) {
              if (assetUri.indexOf("mod-one") > 0) {
                finished(null, {
                  path: assetUri,
                  query: "12345678"
                });
              } else {
                oldResolver(assetFile, assetUri, finished);
              }
            });

            sassTestUtils.assertCompiles(eg, expected, function () {
              try {
                testutils.assertFileExists(path.join(rootDir, "dist/assets/images/foo.png"));
                testutils.assertFileExists(path.join(rootDir, "dist/assets/fonts/foo.woff"));
                testutils.assertFileExists(path.join(rootDir, "dist/assets/mod-one/mod-one.jpg"));
                testutils.assertFileExists(path.join(rootDir, "dist/assets/mod-one/subdir/sub.png"));
              } finally {
                fse.remove(path.join(rootDir, "dist"), function (error) {
                  done();
                });
              }
            });
          });

          it("should manually install assets", function (done) {
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eyeglass = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                buildDir: path.join(rootDir, "dist"),
                httpRoot: "/my-app",
                assets: {
                  httpPrefix: "assets"
                },
                engines: {
                  sass: sass
                }
              }
            });

            eyeglass.assets.addSource(rootDir, { pattern: "images/**/*" });

            var assetPath = "images/foo.png";
            var filePath = path.join(rootDir, assetPath);
            eyeglass.assets.install(filePath, assetPath, function (error, file) {
              try {
                testutils.assertFileExists(path.join(rootDir, "dist", assetPath));
              } finally {
                fse.remove(path.join(rootDir, "dist"), function () {
                  done();
                });
              }
            });
          });

          it("should handle an installer error", function (done) {
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eyeglass = new Eyeglass({
              file: path.join(rootDir, "sass", "both_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                buildDir: path.join(rootDir, "dist"),
                engines: {
                  sass: sass
                }
              }
            });

            var assetUri = path.join("file", "does", "not", "exist.png");
            eyeglass.assets.install(assetUri, assetUri, function (error, file) {
              assert(error, "Failed to install asset " + assetUri + "'");
              fse.remove(path.join(rootDir, "dist"), function (error) {
                done();
              });
            });
          });

          it("should handle undefined file being passed to install", function (done) {
            var rootDir = testutils.fixtureDirectory("app_assets");
            var expected = ".test {\n" +
              "  background: url(\"/images/foo.png\");\n" +
              "  background: url(\"/fonts/foo.woff\");\n}\n";
            var eyeglass = new Eyeglass({
              file: path.join(rootDir, "sass", "app_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  sources: [
                    { directory: rootDir, pattern: "images/**/*" },
                    { directory: rootDir, pattern: "fonts/**/*" }
                  ]
                },
                engines: {
                  sass: sass
                }
              }
            });

            eyeglass.assets.installer(function (assetFile, assetUri, oldInstaller, finished) {
              finished(null, undefined);
            });
            sassTestUtils.assertCompiles(eyeglass, expected, done);
          });

          it("should handle an error in a resolver", function (done) {
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "app_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  sources: [
                    { directory: rootDir, pattern: "images/**/*" },
                    { directory: rootDir, pattern: "fonts/**/*" }
                  ]
                },
                engines: {
                  sass: sass
                }
              }
            });

            eg.assets.resolver(function (assetFile, assetUri, oldResolver, finished) {
              finished(new Error("oops I did it again."));
            });

            testutils.assertStderr(function (checkStderr) {
              var expectedError = { message: "Unable to resolve asset: oops I did it again." };
              sassTestUtils.assertCompilationError(eg, expectedError, function () {
                checkStderr("");
                done();
              });
            });
          });

          it("should give an error when a module does not have assets", function (done) {
            testutils.assertStderr(function (checkStderr) {
              var options = {
                data: '@import "non-asset-mod/assets";',
                eyeglass: {
                  root: testutils.fixtureDirectory("app_assets")
                }
              };
              var expectedError = {message: "No assets specified for eyeglass plugin non-asset-mod"};
              sassTestUtils.assertCompilationError(options, expectedError, function () {
                checkStderr("");
                done();
              });
            });
          });

          it("should give an error when a module does not exist", function (done) {
            testutils.assertStderr(function (checkStderr) {
              var options = {
                data: '@import "no-such-mod/assets";',
                eyeglass: {
                  root: testutils.fixtureDirectory("app_assets")
                }
              };
              var expectedError = {message: "No eyeglass plugin named: no-such-mod"};
              sassTestUtils.assertCompilationError(options, expectedError, function () {
                checkStderr("");
                done();
              });
            });
          });

          it("can pretty print an asset path entry", function (done) {
            var rootDir = testutils.fixtureDirectory("app_assets");

            var entry = new AssetsSource(rootDir, {
              pattern: "images/**/*"
            });
            assert.equal(entry.toString(), rootDir + "/images/**/*");
            done();
          });

          it("can assign custom glob opts to an asset path entry", function (done) {
            var rootDir = testutils.fixtureDirectory("app_assets");

            var entry = new AssetsSource(rootDir, {
              pattern: "images/**/*",
              globOpts: { dot: true }
            });
            assert.equal(entry.globOpts.dot, true);
            done();
          });

          it("asset path entries must be directories", function (done) {
            var rootDir = testutils.fixtureDirectory("app_assets");

            assert.throws(function () {
              var ape = new AssetsSource(path.join(rootDir, "package.json"));
              ape = ape; // TODO: Why is this not returned or used?
            });
            done();
          });

          it("should allow uri fragments", function (done) {
            var input = "@import 'assets'; div { background-image: asset-url('images/foo.png?q=true');" +
              "background-image: asset-url('images/foo.png#foo'); }";
            var expected = "div {\n  background-image: url(\"/images/foo.png?q=true\");\n" +
              "  background-image: url(\"/images/foo.png#foo\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              data: input,
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                engines: {
                  sass: sass
                }
              }
            });
            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("asset-uri should return the uri only, not wrapped in url()", function (done) {
            var input = "@import 'assets'; div { uri: asset-uri('images/foo.png'); }";
            var expected = "div {\n  uri: \"/images/foo.png\";\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              data: input,
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                engines: {
                  sass: sass
                }
              }
            });
            // asset-url("images/foo.png") => url("public/assets/images/foo.png");
            eg.assets.addSource(rootDir, { pattern: "images/**/*" });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("support assets specified via options", function (done) {
            var expected = ".test {\n  background: url(\"/images/foo.png\");\n" +
              "  background: url(\"/fonts/foo.woff\");\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "app_assets.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  sources: [
                    { directory: rootDir, pattern: "images/**/*" },
                    { directory: rootDir, pattern: "fonts/**/*" }
                  ]
                },
                engines: {
                  sass
                }
              }
            });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should normalize URI directory traversal", function (done) {
            var input = "@import 'assets'; /* #{asset-url('images/bar/../foo.png')} */";
            var expected = "/* url(\"/images/foo.png\") */\n";
            var rootDir = testutils.fixtureDirectory("app_assets");
            var eg = new Eyeglass({
              data: input,
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  sources: [{
                    directory: rootDir,
                    pattern: "images/**/*"
                  }]
                },
                engines: {
                  sass: sass
                }
              }
            });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should support odd character in file names", function (done) {
            process.env.EYEGLASS_NORMALIZE_PATHS = "true";
            var rootDir = testutils.fixtureDirectory("app_assets_odd_names");
            var rootDirNormalized = rootDir.replace(/\\/g, "/");
            var images = glob.sync(path.join(rootDir, "images/**/*"));

            // if the file system path is not a backslash...
            if (path.sep !== "\\") {
              // add an extra test case for a file with a backslash in the name
              var backslashImage = path.join(rootDir, "images/foo\\bar.gitignore.png");
              fse.copySync(images[0], backslashImage);
              images.push(backslashImage);
            }

            var input = "@import 'assets';";
            var expected = "@charset \"UTF-8\";\n";
            images.forEach(function (image) {
              var imagePath = escapeBackslash(image.replace(rootDirNormalized, "").replace(/^\//, ""));
              input += "/* #{asset-url('" + imagePath + "')} */\n";
              expected += "/* url(\"/" + imagePath + "\") */\n";
            });
            var eg = new Eyeglass({
              data: input,
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                assets: {
                  sources: [
                    { directory: rootDir, pattern: "images/**/*" },
                  ]
                },
                engines: {
                  sass: sass
                }
              }
            });

            sassTestUtils.assertCompiles(eg, expected, done);
          });

          it("should keep track of module collections", function () {
            var rootDir = testutils.fixtureDirectory("app_assets");

            var egMod = new Eyeglass({
              // file containing '@import "mod-one/assets"'
              file: path.join(rootDir, "sass", "uses_mod_1.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                engines: {
                  sass: sass
                }
              }
            });

            assert.ok(egMod.assets.moduleCollections !== undefined);
            assert.ok(Array.isArray(egMod.assets.moduleCollections));
            assert.equal(egMod.assets.moduleCollections.length, 1);
          });

          it("should cache asset import code with assetsCache()", function () {
            var expected = ".test {\n" +
              "  background: url(\"/mod-one/mod-one.jpg\");\n" +
              "  background: url(\"/mod-one/subdir/sub.png\");\n}\n" +
              "\n" +
              ".all-assets {\n" +
              "  app-assets: \"images/foo.png\", \"fonts/foo.woff\";\n" +
              "  mod-assets: \"mod-one/mod-one.jpg\", \"mod-one/subdir/sub.png\";\n}\n";
            var rootDir = testutils.fixtureDirectory("app_assets");
            var testCache = {};
            var cacheHits = 0;
            var cacheMisses = 0;

            function assetsCache(key, getValue) {
              if (testCache[key]) {
                cacheHits += 1;
                return testCache[key];
              }
              cacheMisses += 1;
              return testCache[key] = getValue();
            }

            var eg = new Eyeglass({
              file: path.join(rootDir, "sass", "uses_mod_1.scss"),
              eyeglass: {
                root: rootDir,
                installWithSymlinks: installWithSymlinks,
                engines: {
                  sass: sass
                }
              },
              assetsCache: assetsCache,
            });

            eg.assets.addSource(rootDir, { pattern: "images/**/*" });
            eg.assets.addSource(rootDir, { pattern: "fonts/**/*" });

            return new Promise(function (resolve) {
              sassTestUtils.assertCompiles(eg, expected, resolve);
            }).then(function () {
              // the first time this is compiled no cache hits
              assert.equal(cacheMisses, 2);
              assert.equal(cacheHits, 0);

              return new Promise(function (resolve) {
                sassTestUtils.assertCompiles(eg, expected, resolve);
              });
            }).then(function () {
              // the second time, both should hit the cache
              assert.equal(cacheMisses, 2);
              assert.equal(cacheHits, 2);
            });
          });

          describe("path separator normalization", function () {
            var originalEnv = process.env.EYEGLASS_NORMALIZE_PATHS;
            var merge = require("lodash.merge");
            var uriFragments = ["images", "bar", "foo.png"];
            var stdSep = "/";
            var otherSep = path.sep === stdSep ? "\\" : stdSep;
            var otherUri = uriFragments.join(otherSep);
            var otherUriEscaped = escapeBackslash(otherUri);
            var normalizedUri = uriFragments.join(stdSep);
            var input = "@import 'assets'; /* #{eyeglass-normalize-uri('" + otherUriEscaped + "')} */";
            var rootDir = testutils.fixtureDirectory("app_assets");

            function resetEnv() {
              process.env.EYEGLASS_NORMALIZE_PATHS = originalEnv;
            }

            function test(options, shouldNormalize, done) {
              var expected = "/* "
                + (shouldNormalize ? normalizedUri : otherUri)
                + " */\n";

              options = merge({
                data: input,
                eyeglass: {
                  root: rootDir,
                  assets: {
                    sources: [{
                      directory: rootDir,
                      pattern: "images/**/*"
                    }]
                  },
                  engines: {
                    sass: sass
                  }
                }
              }, options);

              sassTestUtils.assertCompiles(options, expected, done);
            }

            beforeEach(resetEnv);
            afterEach(resetEnv);

            // TODO - collapse the following next 2 tests when default is changed
            it("should normalize platform separators (via env)", function (done) {
              // currently defaults to disabled, so we explicitly enable via env var
              // TODO - when default is enabled, remove this
              process.env.EYEGLASS_NORMALIZE_PATHS = "true";

              // no options, should normalize
              test(null, true, done);
            });

            it("should normalize platform separators (via option)", function (done) {
              // enabled via options, should normalize
              test({
                eyeglass: {
                  normalizePaths: true
                }
              }, true, done);
            });

            it("should not normalize platform separators when disabled (via env)", function (done) {
              // explicitly disable
              process.env.EYEGLASS_NORMALIZE_PATHS = "false";
              // should not normalize
              test(null, false, done);
            });

            it("should not normalize platform separators when disabled (via option)", function (done) {
              // enabled via options, should not normalize
              test({
                eyeglass: {
                  // explicitly disable path normalization via option
                  normalizePaths: false
                }
              }, false, done);
            });
          });

          describe("cache keys", function () {
            var rootDir = testutils.fixtureDirectory("app_assets");
            var rootDir2 = testutils.fixtureDirectory("app_assets_odd_names");

            it("Assets.cacheKey includes httpPrefix", function () {
              var source1 = new AssetsSource(rootDir, {
                httpPrefix: "foo",
              });
              var source2 = new AssetsSource(rootDir, {
                httpPrefix: "foo",
              });
              var source3 = new AssetsSource(rootDir, {
                httpPrefix: "bar",
              });
              assert.equal(source1.cacheKey(), source2.cacheKey());
              assert.notEqual(source1.cacheKey(), source3.cacheKey());
            });

            it("Assets.cacheKey includes name", function () {
              var source1 = new AssetsSource(rootDir, {
                name: "foo",
              });
              var source2 = new AssetsSource(rootDir, {
                name: "foo",
              });
              var source3 = new AssetsSource(rootDir, {
                name: "bar",
              });
              assert.equal(source1.cacheKey(), source2.cacheKey());
              assert.notEqual(source1.cacheKey(), source3.cacheKey());
            });

            it("Assets.cacheKey includes namespace", function () {
              var source1 = new AssetsSource(rootDir, {});
              var source2 = new AssetsSource(rootDir, {});
              assert.equal(source1.cacheKey("foo"), source2.cacheKey("foo"));
              assert.notEqual(source1.cacheKey("foo"), source2.cacheKey("bar"));
            });

            it("Assets.cacheKey includes srcPath", function () {
              var source1 = new AssetsSource(rootDir, {});
              var source2 = new AssetsSource(rootDir, {});
              var source3 = new AssetsSource(rootDir2, {});
              assert.equal(source1.cacheKey(), source2.cacheKey());
              assert.notEqual(source1.cacheKey(), source3.cacheKey());
            });

            it("Assets.cacheKey includes pattern", function () {
              var source1 = new AssetsSource(rootDir, {
                pattern: "images/**/*",
              });
              var source2 = new AssetsSource(rootDir, {
                pattern: "images/**/*",
              });
              var source3 = new AssetsSource(rootDir, {
                pattern: "images/**/*.jpg",
              });
              assert.equal(source1.cacheKey(), source2.cacheKey());
              assert.notEqual(source1.cacheKey(), source3.cacheKey());
            });

            it("Assets.cacheKey includes globOpts", function () {
              var source1 = new AssetsSource(rootDir, {});
              var source2 = new AssetsSource(rootDir, {});
              var source3 = new AssetsSource(rootDir, {
                globOpts: {
                  dot: true
                }
              });
              assert.equal(source1.cacheKey(), source2.cacheKey());
              assert.notEqual(source1.cacheKey(), source3.cacheKey());
            });

            it("Assets.cacheKey ignores globOpts that are overridden", function () {
              var source1 = new AssetsSource(rootDir, {});
              var source2 = new AssetsSource(rootDir, {
                globOpts: {
                  nonegate: false
                }
              });
              var source3 = new AssetsSource(rootDir, {
                globOpts: {
                  nonegate: true
                }
              });
              assert.equal(source1.cacheKey(), source2.cacheKey());
              assert.equal(source1.cacheKey(), source3.cacheKey());
            });

            it("Assets.cacheKey globOpts order doesn't matter", function () {
              var source1 = new AssetsSource(rootDir, {
                globOpts: {
                  dot: true,
                  nonull: true
                }
              });
              var source2 = new AssetsSource(rootDir, {
                globOpts: {
                  nonull: true,
                  dot: true
                }
              });
              assert.equal(source1.cacheKey(), source2.cacheKey());
            });

            it("AssetsCollection.cacheKey includes collection sources", function () {
              var collection1 = new AssetsCollection({ eyeglass: { engines: { sass } } });
              var collection2 = new AssetsCollection({ eyeglass: { engines: { sass } } });
              var collection3 = new AssetsCollection({ eyeglass: { engines: { sass } } });
              var collection4 = new AssetsCollection({ eyeglass: { engines: { sass } } });

              collection1.addSource(rootDir);
              collection2.addSource(rootDir);
              collection3.addSource(rootDir2);
              collection4.addSource(rootDir);
              collection4.addSource(rootDir2);

              assert.equal(collection1.cacheKey(), collection2.cacheKey());
              assert.notEqual(collection1.cacheKey(), collection3.cacheKey());
              assert.notEqual(collection1.cacheKey(), collection4.cacheKey());
            });

            it("AssetsCollection.cacheKey source order doesn't matter", function () {
              var collection1 = new AssetsCollection({ eyeglass: { engines: { sass } } });
              var collection2 = new AssetsCollection({ eyeglass: { engines: { sass } } });

              collection1.addSource(rootDir);
              collection1.addSource(rootDir2);

              collection2.addSource(rootDir2);
              collection2.addSource(rootDir);

              assert.equal(collection1.cacheKey(), collection2.cacheKey());
            });

          });
        });
      });
    });
  });
});
