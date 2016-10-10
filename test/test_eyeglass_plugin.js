/* Copyright 2016 LinkedIn Corp. Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.  You may obtain a copy of
 * the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.
 */

"use strict";

var assert = require("assert");
var path = require("path");
var fs = require("fs");
var rimraf = require("rimraf");
var fixturify = require("fixturify");
var broccoli = require("broccoli");
var RSVP = require("rsvp");
var glob = require("glob");
var EyeglassCompiler = require("../lib/index");
var AsyncDiskCache = require("async-disk-cache");

function fixtureDir(name) {
  return path.resolve(__dirname, "fixtures", name);
}

function fixtureSourceDir(name) {
  return path.resolve(fixtureDir(name), "input");
}

function fixtureOutputDir(name) {
  return path.resolve(fixtureDir(name), "output");
}

var fixtureDirCount = 0;
function makeFixtures(name, files) {
  fixtureDirCount = fixtureDirCount + 1;
  var dirname = fixtureDir(name + fixtureDirCount + ".tmp");
  fs.mkdirSync(dirname);
  fixturify.writeSync(dirname, files);
  return dirname;
}


function build(builder) {
  return RSVP.Promise.resolve()
    .then(function() {
      return builder.build();
    })
    .then(function(hash) {
      return builder.tree.outputPath;
    });
}

function assertEqualDirs(actualDir, expectedDir) {
  var actualFiles = glob.sync("**/*", {cwd: actualDir}).sort();
  var expectedFiles = glob.sync("**/*", {cwd: expectedDir}).sort();

  assert.deepEqual(actualFiles, expectedFiles);

  actualFiles.forEach(function(file) {
    var actualPath = path.join(actualDir, file);
    var expectedPath = path.join(expectedDir, file);
    var stats = fs.statSync(actualPath);
    if (stats.isFile()) {
      assert.equal(fs.readFileSync(actualPath).toString(),
        fs.readFileSync(expectedPath).toString());
    }
  });
}

function svg(contents) {
  return '<svg xmlns="http://www.w3.org/2000/svg"\n' +
         '     xmlns:xlink="http://www.w3.org/1999/xlink">\n' +
         contents +
         "</svg>\n";
}

var rectangleSVG = svg(
  '  <rect x="10" y="10" height="100" width="100"\n' +
  '        style="stroke:#ff0000; fill: #0000ff"/>\n'
);

var circleSVG = svg(
  '<circle cx="40" cy="40" r="24" style="stroke:#006600; fill:#00cc00"/>'
);

describe("EyeglassCompiler", function () {
  it("can be instantiated", function () {
    var optimizer = new EyeglassCompiler(fixtureSourceDir("basicProject"), {
      cssDir: "."
    });
    assert(optimizer instanceof EyeglassCompiler);
  });

  it("compiles sass files", function () {
    var optimizer = new EyeglassCompiler(fixtureSourceDir("basicProject"), {
      cssDir: "."
    });

    var builder = new broccoli.Builder(optimizer);

    return build(builder)
      .then(function(outputDir) {
        assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
      });
  });

  it("passes unknown options to eyeglass", function() {
    var optimizer = new EyeglassCompiler(fixtureSourceDir("basicProject"), {
      cssDir: ".",
      foo: true
    });
    assert.equal(undefined, optimizer.options.cssDir);
    assert.equal(".", optimizer.cssDir);
    assert.equal(optimizer.options.foo, true);
  });

  it("forbids the file option", function() {
    assert.throws(
      function() {
        new EyeglassCompiler(fixtureSourceDir("basicProject"), {
          cssDir: ".",
          file: "asdf"
        });
      },
      /The node-sass option 'file' cannot be set explicitly\./
    );
  });

  it("forbids the data option", function() {
    assert.throws(
      function() {
        new EyeglassCompiler(fixtureSourceDir("basicProject"), {
          cssDir: ".",
          data: "asdf"
        });
      },
      /The node-sass option 'data' cannot be set explicitly\./
    );
  });

  it("forbids the outFile option", function() {
    assert.throws(
      function() {
        new EyeglassCompiler(fixtureSourceDir("basicProject"), {
          cssDir: ".",
          outFile: "asdf"
        });
      },
      /The node-sass option 'outFile' cannot be set explicitly\./
    );
  });

  it("outputs exceptions when the fullException option is set", function() {
    var optimizer = new EyeglassCompiler(fixtureSourceDir("errorProject"), {
      cssDir: ".",
      fullException: true
    });

    var builder = new broccoli.Builder(optimizer);

    return build(builder)
      .then(function(outputDir) {
        assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
      }, function(error) {
        assert.equal("property \"asdf\" must be followed by a ':'", error.message.split("\n")[0]);
      });
  });

  it("supports manual modules", function() {
    var optimizer = new EyeglassCompiler(fixtureSourceDir("usesManualModule"), {
      cssDir: ".",
      fullException: true,
      eyeglass: {
        modules: [
          {path: fixtureDir("manualModule")}
        ]
      }
    });

    var builder = new broccoli.Builder(optimizer);

    return build(builder)
      .then(function(outputDir) {
        assertEqualDirs(outputDir, fixtureOutputDir("usesManualModule"));
      });
  });

  function cleanupTempDirs() {
    var tmpDirs = glob.sync(path.join(path.resolve(__dirname, "fixtures"),"**", "*.tmp"));
    tmpDirs.forEach(function(tmpDir) {
      rimraf.sync(tmpDir);
    });
  }

  describe("caching", function() {
    afterEach(cleanupTempDirs);

    it("caches when an unrelated file changes", function() {
      var sourceDir = fixtureSourceDir("basicProject");
      var unusedSourceFile = path.join(sourceDir, "styles", "_unused.scss");
      var compiledFiles = [];
      var compiler = new EyeglassCompiler(sourceDir, {
        cssDir: ".",
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      fs.writeFileSync(unusedSourceFile, "// this isn't used.");

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
          assert.equal(1, compiledFiles.length);

          fs.writeFileSync(unusedSourceFile, "// changed but still not used.");
          return build(builder).then(function(outputDir2) {
            assert.equal(outputDir, outputDir2);
            assert.equal(1, compiledFiles.length);
          });
        });
    });

    it("doesn't cache when there's a change", function() {
      var sourceDir = fixtureSourceDir("basicProject");
      var compiledFiles = [];
      var compiler = new EyeglassCompiler(sourceDir, {
        cssDir: ".",
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
          assert.equal(1, compiledFiles.length);

          var sourceFile = path.join(sourceDir, "styles", "foo.scss");
          var originalSource = fs.readFileSync(sourceFile);
          var newSource = "@import \"used\";\n" +
                          "$color: blue;\n" +
                          ".foo {\n" +
                          "  color: $color;\n" +
                          "}\n";

          var newExpectedOutput = ".foo {\n" +
                                  "  color: blue; }\n";

          fs.writeFileSync(sourceFile, newSource);
          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              var outputFile = path.join(outputDir2, "styles", "foo.css");
              assert.equal(newExpectedOutput, fs.readFileSync(outputFile));
              assert.equal(2, compiledFiles.length);
            })
            .finally(function() {
              fs.writeFileSync(sourceFile, originalSource);
            });
        });
    });

    it("caches on the 3rd build", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "external";',
        "_unrelated.scss": "/* This is unrelated to anything. */"
      });
      var includeDir = makeFixtures("includeDir", {
        "external.scss": ".external { float: left; }"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".external {\n  float: left; }\n"
      });

      var compiledFiles = [];
      var compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        includePaths: [includeDir],
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(projectDir, {
            "_unrelated.scss": "/* This is very unrelated to anything. */"
          });

          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
              compiledFiles = [];
              fixturify.writeSync(projectDir, {
                "_unrelated.scss": "/* This is quite unrelated to anything. */"
              });

              return build(builder)
                .then(function(outputDir2) {
                  assert.equal(outputDir, outputDir2);
                  assert.equal(compiledFiles.length, 0);
                  assertEqualDirs(outputDir2, expectedOutputDir);
                });
            });
        });
    });

    it("busts cache when file reached via includePaths changes", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "external";'
      });
      var includeDir = makeFixtures("includeDir", {
        "external.scss": ".external { float: left; }"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".external {\n  float: left; }\n"
      });

      var compiledFiles = [];
      var compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        includePaths: [includeDir],
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(includeDir, {
            "external.scss": ".external { float: right; }"
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css": ".external {\n  float: right; }\n"
          });

          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("busts cache when file mode changes", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "external";'
      });
      var includeDir = makeFixtures("includeDir", {
        "external.scss": ".external { float: left; }"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".external {\n  float: left; }\n"
      });

      var compiledFiles = [];
      var compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        includePaths: [includeDir],
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fs.chmodSync(path.join(includeDir, "external.scss"), parseInt("755", 8));

          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("busts cache when an eyeglass module is upgraded", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "eyeglass-module";'
      });
      var eyeglassModDir = makeFixtures("eyeglassmod", {
        "package.json": "{\n" +
                        '  "name": "is_a_module",\n' +
                        '  "keywords": ["eyeglass-module"],\n' +
                        '  "private": true,\n' +
                        '  "eyeglass": {\n' +
                        '    "exports": false,\n' +
                        '    "name": "eyeglass-module",\n' +
                        '    "sassDir": "sass",\n' +
                        '    "needs": "*"\n' +
                        "  }\n" +
                        "}",
        "sass": {
          "index.scss": ".eyeglass-mod { content: eyeglass }"
        }
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".eyeglass-mod {\n  content: eyeglass; }\n"
      });

      var compiledFiles = [];
      var compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        },
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(eyeglassModDir, {
            "sass": {
              "index.scss": ".eyeglass-mod { content: eyeglass-changed }"
            }
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css": ".eyeglass-mod {\n  content: eyeglass-changed; }\n"
          });

          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("busts cache when an eyeglass asset changes", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss":
          '@import "eyeglass-module/assets";\n' +
          '.rectangle { background: asset-url("eyeglass-module/shape.svg"); }\n'
      });
      var eyeglassModDir = makeFixtures("eyeglassmod2", {
        "package.json": "{\n" +
                        '  "name": "is_a_module",\n' +
                        '  "keywords": ["eyeglass-module"],\n' +
                        '  "main": "eyeglass-exports.js",\n' +
                        '  "private": true,\n' +
                        '  "eyeglass": {\n' +
                        '    "name": "eyeglass-module",\n' +
                        '    "needs": "*"\n' +
                        "  }\n" +
                        "}",
        "eyeglass-exports.js":
          'var path = require("path");\n' +
          "module.exports = function(eyeglass, sass) {\n" +
          "  return {\n" +
          "    sassDir: __dirname, // directory where the sass files are.\n" +
          '    assets: eyeglass.assets.export(path.join(__dirname, "images"))\n' +
          "  };\n" +
          "};",
        "sass": {
          "index.scss": ".eyeglass-mod { content: eyeglass }"
        },
        "images": {
          "shape.svg": rectangleSVG
        }
      });

      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "eyeglass-module": {
          "shape.svg": rectangleSVG
        },
        "project.css": '.rectangle {\n  background: url("/eyeglass-module/shape.svg"); }\n'
      });

      var compiledFiles = [];
      var compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        },
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(eyeglassModDir, {
            "images": {
              "shape.svg": circleSVG
            }
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css":
              '.rectangle {\n  background: url("/eyeglass-module/shape.svg"); }\n',
            "eyeglass-module": {
              "shape.svg": circleSVG
            }
          });

          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("busts cache when file reached via ../ outside the load path changes", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "external";'
      });
      var relativeIncludeDir = makeFixtures("relativeIncludeDir", {
        "relative.scss": ".external { float: left; }"
      });
      var includeDir = makeFixtures("includeDir", {
        "external.scss": '@import "../relativeIncludeDir' + fixtureDirCount + '.tmp/relative";'
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".external {\n  float: left; }\n"
      });

      var compiledFiles = [];
      var compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        includePaths: [includeDir],
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(relativeIncludeDir, {
            "relative.scss": ".external { float: right; }"
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css": ".external {\n  float: right; }\n"
          });

          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("removes a css file when the corresponding sass file is removed", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": "/* project */"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* project */\n"
      });

      var compiledFiles = [];
      var compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(projectDir, {
            "project.scss": null
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css": null
          });

          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("removes an asset file when the corresponding sass file is removed", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss":
          '@import "eyeglass-module/assets";\n' +
          '.rectangle { background: asset-url("eyeglass-module/shape.svg"); }\n'
      });
      var eyeglassModDir = makeFixtures("eyeglassmod", {
        "package.json": "{\n" +
                        '  "name": "is_a_module",\n' +
                        '  "keywords": ["eyeglass-module"],\n' +
                        '  "main": "eyeglass-exports.js",\n' +
                        '  "private": true,\n' +
                        '  "eyeglass": {\n' +
                        '    "name": "eyeglass-module",\n' +
                        '    "needs": "*"\n' +
                        "  }\n" +
                        "}",
        "eyeglass-exports.js":
          'var path = require("path");\n' +
          "module.exports = function(eyeglass, sass) {\n" +
          "  return {\n" +
          "    sassDir: __dirname, // directory where the sass files are.\n" +
          '    assets: eyeglass.assets.export(path.join(__dirname, "images"))\n' +
          "  };\n" +
          "};",
        "sass": {
          "index.scss": ".eyeglass-mod { content: eyeglass }"
        },
        "images": {
          "shape.svg": rectangleSVG
        }
      });

      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "eyeglass-module": {
          "shape.svg": rectangleSVG
        },
        "project.css": '.rectangle {\n  background: url("/eyeglass-module/shape.svg"); }\n'
      });

      var compiledFiles = [];
      var compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        },
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      });

      var builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(projectDir, {
            "project.scss": null
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css": null,
            "eyeglass-module": {
              "shape.svg": null
            }
          });

          return build(builder)
            .then(function(outputDir2) {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("doesn't remove an asset unless no files are using it anymore");
  });


  describe("warm caching", function() {
    afterEach(function() {
      var cache = new AsyncDiskCache("test");
      return cache.clear();
    });

    function warmBuilders(count, dir, options, compilationListener) {
      var builders = [];
      for (var i = 0; i < count; i++) {
        var compiler = new EyeglassCompiler(dir, options);
        compiler.events.on("compiled", compilationListener);
        var builder = new broccoli.Builder(compiler);
        builder.compiler = compiler;
        builders.push(builder);
      }
      return builders;
    }

    afterEach(cleanupTempDirs);

    it("preserves cache across builder instances", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      var compiledFiles = [];
      var builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("invalidates when a dependent file changes.", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      var compiledFiles = [];
      var builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(projectDir, {
            "_related.scss": "/* something related changed */"
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css": "/* something related changed */\n"
          });

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("restored side-effect outputs when cached.", function() {
      var projectDir = makeFixtures("projectDir", {
        "sass": {
          "project.scss": '@import "assets";\n' +
                          '.shape { content: asset-url("shape.svg"); }',
        },
        "assets": {
          "shape.svg": rectangleSVG
        }
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": '.shape {\n  content: url("/shape.svg"); }\n',
        "shape.svg": rectangleSVG
      });

      var compiledFiles = [];
      var builders = warmBuilders(2, projectDir, {
        sassDir: "sass",
        assets: "assets",
        cssDir: ".",
        persistentCache: "test",
        eyeglass: {
          root: projectDir
        }
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("invalidates when non-sass file dependencies change.", function() {
      var projectDir = makeFixtures("projectDir", {
        "sass": {
          "project.scss": '@import "assets";\n' +
                          '.shape { content: asset-url("shape.svg"); }',
        },
        "assets": {
          "shape.svg": rectangleSVG
        }
      });

      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": '.shape {\n  content: url("/shape.svg"); }\n',
        "shape.svg": rectangleSVG
      });

      var compiledFiles = [];
      var builders = warmBuilders(2, projectDir, {
        sassDir: "sass",
        assets: "assets",
        cssDir: ".",
        persistentCache: "test",
        eyeglass: {
          root: projectDir
        }
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(projectDir, {
            "assets": {
              "shape.svg": circleSVG
            }
          });

          fixturify.writeSync(expectedOutputDir, {
            "shape.svg": circleSVG
          });

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("invalidates when eyeglass modules javascript files changes.", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss":
          ".foo { content: foo(); }\n"
      });
      var eyeglassModDir = makeFixtures("eyeglassmod", {
        "package.json": "{\n" +
                        '  "name": "is_a_module",\n' +
                        '  "keywords": ["eyeglass-module"],\n' +
                        '  "main": "eyeglass-exports.js",\n' +
                        '  "private": true,\n' +
                        '  "files": ["eyeglass-exports.js", "sass", "lib", "images"],' +
                        '  "eyeglass": {\n' +
                        '    "name": "eyeglass-module",\n' +
                        '    "needs": "*"\n' +
                        "  }\n" +
                        "}",
        "eyeglass-exports.js":
          'var path = require("path");\n' +
          'var foo = require("./lib/foo");\n' +
          "module.exports = function(eyeglass, sass) {\n" +
          "  return {\n" +
          "    inDevelopment: true,\n" +
          "    sassDir: path.join(__dirname, 'sass'), // directory where the sass files are.\n" +
          '    assets: eyeglass.assets.export(path.join(__dirname, "images")),\n' +
          "    functions: {\n" +
          '      "foo()": function() { return sass.types.String(foo); }\n' +
          "    }\n" +
          "  };\n" +
          "};",
        "sass": {
          "index.scss": ".eyeglass-mod { content: eyeglass }"
        },
        "lib": {
          "foo.js": "module.exports = 'foo';\n"
        },
        "images": {
          "shape.svg": rectangleSVG
        }
      });

      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".foo {\n  content: foo; }\n"
      });

      var compiledFiles = [];

      var builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test",
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });


      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(eyeglassModDir, {
            "lib": {
              "foo.js": "module.exports = 'changed-foo';\n"
            }
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css": ".foo {\n  content: changed-foo; }\n"
          });

          delete require.cache[path.join(eyeglassModDir, "eyeglass-exports.js")];
          delete require.cache[path.join(eyeglassModDir, "lib", "foo.js")];

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("invalidates when eyeglass modules javascript files changes (package.json).", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss":
          ".foo { content: foo(); }\n"
      });
      var eyeglassModDir = makeFixtures("eyeglassmod3", {
        "package.json": "{\n" +
                        '  "name": "is_a_module",\n' +
                        '  "keywords": ["eyeglass-module"],\n' +
                        '  "main": "eyeglass-exports.js",\n' +
                        '  "private": true,\n' +
                        '  "files": ["eyeglass-exports.js", "sass", "lib", "images"],' +
                        '  "eyeglass": {\n' +
                        '    "inDevelopment": true,\n' +
                        '    "name": "eyeglass-module",\n' +
                        '    "needs": "*"\n' +
                        "  }\n" +
                        "}",
        "eyeglass-exports.js":
          'var path = require("path");\n' +
          'var foo = require("./lib/foo");\n' +
          "module.exports = function(eyeglass, sass) {\n" +
          "  return {\n" +
          "    sassDir: path.join(__dirname, 'sass'), // directory where the sass files are.\n" +
          '    assets: eyeglass.assets.export(path.join(__dirname, "images")),\n' +
          "    functions: {\n" +
          '      "foo()": function() { return sass.types.String(foo); }\n' +
          "    }\n" +
          "  };\n" +
          "};",
        "sass": {
          "index.scss": ".eyeglass-mod { content: eyeglass }"
        },
        "lib": {
          "foo.js": "module.exports = 'foo';\n"
        },
        "images": {
          "shape.svg": rectangleSVG
        }
      });

      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".foo {\n  content: foo; }\n"
      });

      var compiledFiles = [];

      var builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test",
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });


      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(eyeglassModDir, {
            "lib": {
              "foo.js": "module.exports = 'changed-foo';\n"
            }
          });

          fixturify.writeSync(expectedOutputDir, {
            "project.css": ".foo {\n  content: changed-foo; }\n"
          });

          delete require.cache[path.join(eyeglassModDir, "eyeglass-exports.js")];
          delete require.cache[path.join(eyeglassModDir, "lib", "foo.js")];

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("can force invalidate the persistent cache", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      var compiledFiles = [];
      var builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          process.env["BROCCOLI_EYEGLASS"] = "forceInvalidateCache";

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(1, compiledFiles.length);
              assertEqualDirs(outputDir2, expectedOutputDir);
            })
            .finally(function() {
              delete process.env["BROCCOLI_EYEGLASS"];
            });
        });
    });

    it("busts cache when options used for compilation are different", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      var compiledFiles = [];
      var builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          builders[1].compiler.options.foo = "bar";

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("can use the rebuild cache after restoring from the persistent cache.", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      var compiledFiles = [];
      var hotCompiledFiles = [];
      var builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test",
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          hotCompiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          assert.equal(1, hotCompiledFiles.length);
          compiledFiles = [];
          hotCompiledFiles = [];

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assert.equal(hotCompiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);

              compiledFiles = [];
              hotCompiledFiles = [];

              return build(builders[1])
                .then(function(outputDir2) {
                  assert.notEqual(outputDir, outputDir2);
                  assert.equal(compiledFiles.length, 0);
                  assert.equal(hotCompiledFiles.length, 0);
                  assertEqualDirs(outputDir2, expectedOutputDir);
                });
            });
        });
    });

    it("busts the rebuild cache after restoring from the persistent cache.", function() {
      var projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      var expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      var compiledFiles = [];
      var hotCompiledFiles = [];
      var builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test",
        optionsGenerator: function(sassFile, cssFile, options, cb) {
          hotCompiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      }, function(details) {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(function(outputDir) {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          assert.equal(1, hotCompiledFiles.length);
          compiledFiles = [];
          hotCompiledFiles = [];

          return build(builders[1])
            .then(function(outputDir2) {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assert.equal(hotCompiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);

              compiledFiles = [];
              hotCompiledFiles = [];

              fixturify.writeSync(projectDir, {
                "project.scss": '@import "related"; .something { color: red; }'
              });

              fixturify.writeSync(expectedOutputDir, {
                "project.css": "/* This is related to something. */\n.something {\n  color: red; }\n"
              });

              return build(builders[1])
                .then(function(outputDir2) {
                  assert.notEqual(outputDir, outputDir2);
                  assert.equal(compiledFiles.length, 1);
                  assert.equal(hotCompiledFiles.length, 1);
                  assertEqualDirs(outputDir2, expectedOutputDir);
                });
            });
        });
    });

    it("doesn't check the persistent cache when doing a rebuild in the same instance.");
    it("busts cache when a file higher in the load path order is added");
  });
});
