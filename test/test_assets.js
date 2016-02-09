"use strict";

var sass = require("node-sass");
var path = require("path");
var testutils = require("./testutils");
var assert = require("assert");
var fse = require("fs-extra");

var Eyeglass = require("../lib");
var AssetsSource = require("../lib/assets/AssetsSource");

describe("assets", function () {

  it("should give an error when an asset is not found", function (done) {
    testutils.assertStderr(function(checkStderr) {
      var options = {
        data: "@import 'assets'; div { background-image: asset-url('fake.png'); }"
      };
      var expectedError = {message: "Asset not found: fake.png"};
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
      data: input,
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      }
    });
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
      data: input,
      importer: function(uri, prev, importerDone) {
        if (uri === "custom") {
          importerDone({
            contents: ".custom { importer: invoked; }",
            file: "custom"
          });
        }
      },
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      }
    });

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
      file: path.join(rootDir, "sass", "uses_mod_1.scss"),
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      }
    });

    // asset-url("images/foo.png") => url(public/assets/images/foo.png);
    eg.assets.addSource(rootDir, {pattern: "images/**/*"});
    // asset-url("fonts/foo.ttf") => url(public/assets/fonts/foo.ttf);
    eg.assets.addSource(rootDir, {pattern: "fonts/**/*"});

    testutils.assertCompiles(eg, expected, done);
  });

  it("should import own assets from within a module", function (done) {
    var expected = [
      "/* index */",
      ".test {",
      "  background: url(/mod-one/mod-one.jpg);",
      "  background: url(/mod-one/subdir/sub.png); }\n",
      ".all-assets {",
      "  mod-assets: \"mod-one/mod-one.jpg\", \"mod-one/subdir/sub.png\"; }\n"
    ].join("\n");
    var rootDir = testutils.fixtureDirectory("app_assets");
    var eg = new Eyeglass({
      data: "@import 'mod-one';",
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      }
    });

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
      file: path.join(rootDir, "sass", "app_assets.scss"),
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      }
    });

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
      file: path.join(rootDir, "sass", "both_assets.scss"),
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
      file: path.join(rootDir, "sass", "both_assets.scss"),
      eyeglass: {
        root: rootDir,
        assets: {
          httpPrefix: "assets",
          relativeTo: "/assets/subdir",
        },
        engines: {
          sass: sass
        }
      }
    });

    // asset-url("images/foo.png") => url(public/assets/images/foo.png);
    eg.assets.addSource(rootDir, {pattern: "images/**/*"});
    // asset-url("fonts/foo.ttf") => url(public/assets/fonts/foo.ttf);
    eg.assets.addSource(rootDir, {pattern: "fonts/**/*"});

    testutils.assertCompiles(eg, expected, done);
  });

  it("should allow a relative URLs when httpRoot is set", function (done) {
    var expected = ".test {\n" +
                   "  background: url(../images/foo.png);\n" +
                   "  background: url(../fonts/foo.woff);\n" +
                   "  background: url(../mod-one/mod-one.jpg);\n" +
                   "  background: url(../mod-one/subdir/sub.png); }\n";
    var rootDir = testutils.fixtureDirectory("app_assets");
    //var distDir = tmp.dirSync();
    var eg = new Eyeglass({
      file: path.join(rootDir, "sass", "both_assets.scss"),
      eyeglass: {
        root: rootDir,
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
      file: path.join(rootDir, "sass", "both_assets.scss"),
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
      data: input,
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      }
    });

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
      file: path.join(rootDir, "sass", "both_assets.scss"),
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
      file: path.join(rootDir, "sass", "both_assets.scss"),
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
      file: path.join(rootDir, "sass", "both_assets.scss"),
      eyeglass: {
        root: rootDir,
        buildDir: path.join(rootDir, "dist"),
        assets: {
          httpPrefix: "assets"
        },
        engines: {
          sass: sass
        }
      }
    });

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
      file: path.join(rootDir, "sass", "both_assets.scss"),
      eyeglass: {
        root: rootDir,
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
      data: '@import "assets"; .bg { background: asset-url("images/foo.png"); }',
      eyeglass: {
        root: rootDir
      }
    });

    eg.assets.addSource(rootDir, {pattern: "images/**/*"});

    eg.assets.resolver(function(assetFile, assetUri, oldResolver, finished) {
        finished(new Error("oops I did it again."));
    });

    testutils.assertStderr(function(checkStderr) {
      var expectedError = {message: "oops I did it again."};
      testutils.assertCompilationError(eg, expectedError, function() {
        checkStderr("");
        done();
      });
    });
  });

  it("should handle a sass error in a resolver", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");
    var eg = new Eyeglass({
      data: '@import "assets"; .bg { background: asset-url("images/foo.png"); }',
      eyeglass: {
        root: rootDir
      }
    });

    eg.assets.addSource(rootDir, {pattern: "images/**/*"});

    eg.assets.resolver(function(assetFile, assetUri, oldResolver, finished) {
        finished(sass.types.Error("oops I did it again."));
    });

    testutils.assertStderr(function(checkStderr) {
      var expectedError = {message: "oops I did it again."};
      testutils.assertCompilationError(eg, expectedError, function() {
        checkStderr("");
        done();
      });
    });
  });

  it("should give an error when a module does not have assets", function (done) {
    testutils.assertStderr(function(checkStderr) {
      var options = {
        data: '@import "non-asset-mod/assets";',
        eyeglass: {
          root: testutils.fixtureDirectory("app_assets")
        }
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
        data: '@import "no-such-mod/assets";',
        eyeglass: {
          root: testutils.fixtureDirectory("app_assets")
        }
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

    var entry = new AssetsSource(rootDir, {
      pattern: "images/**/*"
    });
    assert.equal(entry.toString(), rootDir + "/images/**/*");
    done();
  });

  it("can assign custom glob opts to an asset path entry", function(done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var entry = new AssetsSource(rootDir, {
      pattern: "images/**/*",
      globOpts: {dot: true}
    });
    assert.equal(entry.globOpts.dot, true);
    done();
  });

  it("asset path entries must be directories", function(done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    assert.throws(function() {
      var ape = new AssetsSource(path.join(rootDir, "package.json"));
      ape = ape; // TODO: Why is this not returned or used?
    });
    done();
  });

  it("should allow uri fragments", function (done) {
    var input = "@import 'assets'; div { background-image: asset-url('images/foo.png?q=true');" +
                "background-image: asset-url('images/foo.png#foo'); }";
    var expected = "div {\n  background-image: url(/images/foo.png?q=true);\n" +
                   "  background-image: url(/images/foo.png#foo); }\n";
    var rootDir = testutils.fixtureDirectory("app_assets");
    var eg = new Eyeglass({
      data: input,
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      }
    });
    // asset-url("images/foo.png") => url(public/assets/images/foo.png);
    eg.assets.addSource(rootDir, {pattern: "images/**/*"});

    testutils.assertCompiles(eg, expected, done);
  });

  it("asset-uri should return the uri only, not wrapped in url()", function (done) {
    var input = "@import 'assets'; div { uri: asset-uri('images/foo.png'); }";
    var expected = "div {\n  uri: /images/foo.png; }\n";
    var rootDir = testutils.fixtureDirectory("app_assets");
    var eg = new Eyeglass({
      data: input,
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      }
    });
    // asset-url("images/foo.png") => url(public/assets/images/foo.png);
    eg.assets.addSource(rootDir, {pattern: "images/**/*"});

    testutils.assertCompiles(eg, expected, done);
  });

  it("support assets specified via options", function (done) {
    var input = "@import 'assets'; div { background-image: asset-url('images/foo.png');" +
                "font: asset-url('fonts/foo.woff'); }";
    var expected = "div {\n  background-image: url(/images/foo.png);\n" +
                   "  font: url(/fonts/foo.woff); }\n";
    var rootDir = testutils.fixtureDirectory("app_assets");
    var eg = new Eyeglass({
      data: input,
      eyeglass: {
        root: rootDir,
        assets: {
          sources: [
            {directory: rootDir, pattern: "images/**/*"},
            {directory: rootDir, pattern: "fonts/**/*"}
          ]
        }
      }
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("should normalize platform separators as well as directory traversal", function (done) {
    var input = "@import 'assets'; div { background-image: asset-url('images\\\\foo.png');" +
                "background-image: asset-url('images/bar/../foo.png'); }";
    var expected = "div {\n  background-image: url(/images/foo.png);\n" +
                   "  background-image: url(/images/foo.png); }\n";
    var rootDir = testutils.fixtureDirectory("app_assets");
    var eg = new Eyeglass({
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
    });

    testutils.assertCompiles(eg, expected, done);
  });
});
