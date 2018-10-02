/* Copyright 2016 LinkedIn Corp. Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy of
 * the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.
 */

"use strict";

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const rimraf = require("rimraf");
const fixturify = require("fixturify");
const broccoli = require("broccoli");
const RSVP = require("rsvp");
const glob = require("glob");
const EyeglassCompiler = require("../lib/index");
const SyncDiskCache = require("sync-disk-cache");
const walkSync = require("walk-sync");
const EOL = require("os").EOL;

function allFilesAreSymlinks(root) {
  walkSync(root, {directories: false}).forEach(filepath => {
    fs.readlinkSync(root + "/" + filepath); // throws if the file is not a link
  });

  assert(true, "all files are symlinks");
}

function fixtureDir(name) {
  return path.resolve(__dirname, "fixtures", name);
}

function fixtureSourceDir(name) {
  return path.resolve(fixtureDir(name), "input");
}

function fixtureOutputDir(name) {
  return path.resolve(fixtureDir(name), "output");
}

let fixtureDirCount = 0;

function makeFixtures(name, files) {
  fixtureDirCount = fixtureDirCount + 1;
  let dirname = fixtureDir(name + fixtureDirCount + ".tmp");
  fs.mkdirSync(dirname);
  fixturify.writeSync(dirname, files);
  return dirname;
}



function build(builder) {
  return RSVP.Promise.resolve()
    .then(() => builder.build())
    .then(() => builder.tree.outputPath);
}

function assertEqualDirs(actualDir, expectedDir) {
  let actualFiles = glob.sync("**/*", {cwd: actualDir}).sort();
  let expectedFiles = glob.sync("**/*", {cwd: expectedDir}).sort();

  assert.deepEqual(actualFiles, expectedFiles);

  actualFiles.forEach(file => {
    let actualPath = path.join(actualDir, file);
    let expectedPath = path.join(expectedDir, file);
    let stats = fs.statSync(actualPath);

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

const rectangleSVG = svg(
  '  <rect x="10" y="10" height="100" width="100"\n' +
  '        style="stroke:#ff0000; fill: #0000ff"/>\n'
);

const circleSVG = svg(
  '<circle cx="40" cy="40" r="24" style="stroke:#006600; fill:#00cc00"/>'
);

describe("EyeglassCompiler", function () {
  const hasCIValue = ("CI" in process.env);
  const CI_VALUE = process.env.CI;

  beforeEach(function() {
    delete process.env.CI;
  });

  afterEach(function() {
    if (hasCIValue) {
      process.env.CI = CI_VALUE;
    } else {
      delete process.env.CI;
    }

  });

  it("can be instantiated", function () {
    let optimizer = new EyeglassCompiler(fixtureSourceDir("basicProject"), {
      cssDir: "."
    });
    assert(optimizer instanceof EyeglassCompiler);
  });

  it("compiles sass files with the minimal options", function () {
    let optimizer = new EyeglassCompiler(fixtureSourceDir("basicProject"), {
      cssDir: "."
    });

    let builder = new broccoli.Builder(optimizer);

    return build(builder)
      .then(outputDir => {
        assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
      });
  });

  it("compiles sass files with option.relativeAssets set", function () {
    let optimizer = new EyeglassCompiler(fixtureSourceDir("basicProject"), {
      cssDir: ".",
      relativeAssets: true
    });

    let builder = new broccoli.Builder(optimizer);

    return build(builder)
      .then(outputDir => {
        assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
      });
  });

  it("passes unknown options to eyeglass", function() {
    let optimizer = new EyeglassCompiler(fixtureSourceDir("basicProject"), {
      cssDir: ".",
      foo: true
    });
    assert.equal(undefined, optimizer.options.cssDir);
    assert.equal(".", optimizer.cssDir);
    assert.equal(optimizer.options.foo, true);
  });

  it("forbids the file option", function() {
    assert.throws(
      () => {
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
      () => {
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
      () => {
        new EyeglassCompiler(fixtureSourceDir("basicProject"), {
          cssDir: ".",
          outFile: "asdf"
        });
      },
      /The node-sass option 'outFile' cannot be set explicitly\./
    );
  });

  it("outputs exceptions when the fullException option is set", function() {
    let optimizer = new EyeglassCompiler(fixtureSourceDir("errorProject"), {
      cssDir: ".",
      fullException: true
    });

    let builder = new broccoli.Builder(optimizer);

    return build(builder)
      .then(outputDir => {
        assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
      }, error => {
        assert.equal("property \"asdf\" must be followed by a ':'", error.message.split("\n")[0]);
      });
  });

  it("supports manual modules", function() {
    let optimizer = new EyeglassCompiler(fixtureSourceDir("usesManualModule"), {
      cssDir: ".",
      fullException: true,
      eyeglass: {
        modules: [
          {path: fixtureDir("manualModule")}
        ]
      }
    });

    let builder = new broccoli.Builder(optimizer);

    return build(builder)
      .then(outputDir => {
        assertEqualDirs(outputDir, fixtureOutputDir("usesManualModule"));
      });
  });

  function cleanupTempDirs() {
    let tmpDirs = glob.sync(path.join(path.resolve(__dirname, "fixtures"),"**", "*.tmp"));

    tmpDirs.forEach(tmpDir => rimraf.sync(tmpDir));
  }

  describe("optionsGenerator", function() {
    it("allow outputFile names to be safely overwritten", function() {
      let sourceDir = fixtureSourceDir("assetsProject");
      let compiler = new EyeglassCompiler(sourceDir, {
        cssDir: ".",
        optionsGenerator(sassFile, cssFile, options, cb) {
          // 1 cssFile, but two `cb()` with different names, should result in
          // two seperate outputfiles
          cb("first.css", options);
          cb("second.css", options);
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
          let first = fs.readlinkSync(outputDir + "/first.css");
          let second = fs.readlinkSync(outputDir + "/second.css");

          assert.notEqual(first, second);
          assert.equal(path.basename(first), "first.css");
          assert.equal(path.basename(second), "second.css");
        });
    });
  });

  describe("caching", function() {
    afterEach(cleanupTempDirs);

    it("caches when an unrelated file changes", function() {
      let sourceDir = fixtureSourceDir("basicProject");
      let unusedSourceFile = path.join(sourceDir, "styles", "_unused.scss");
      let compiledFiles = [];
      let compiler = new EyeglassCompiler(sourceDir, {
        cssDir: ".",
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      fs.writeFileSync(unusedSourceFile, "// this isn't used.");

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
          assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
          assert.equal(1, compiledFiles.length);

          fs.writeFileSync(unusedSourceFile, "// changed but still not used.");
          return build(builder).then(outputDir2 => {
            assert.equal(outputDir, outputDir2);
            assert.equal(1, compiledFiles.length);
          });
        });
    });

    it("doesn't cache when there's a change", function() {
      let sourceDir = fixtureSourceDir("basicProject");
      let compiledFiles = [];
      let compiler = new EyeglassCompiler(sourceDir, {
        cssDir: ".",
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
          assertEqualDirs(outputDir, fixtureOutputDir("basicProject"));
          assert.equal(1, compiledFiles.length);

          let sourceFile = path.join(sourceDir, "styles", "foo.scss");
          let originalSource = fs.readFileSync(sourceFile);
          let newSource = "@import \"used\";\n" +
                          "$color: blue;\n" +
                          ".foo {\n" +
                          "  color: $color;\n" +
                          "}\n";

          let newExpectedOutput = ".foo {\n" +
                                  "  color: blue; }\n";

          fs.writeFileSync(sourceFile, newSource);

          return build(builder)
            .then(outputDir2 => {
              assert.equal(outputDir, outputDir2);
              let outputFile = path.join(outputDir2, "styles", "foo.css");
              assert.equal(newExpectedOutput, fs.readFileSync(outputFile));
              assert.equal(2, compiledFiles.length);
            })
            .finally(() => {
              fs.writeFileSync(sourceFile, originalSource);
            });
        });
    });

    it("caches on the 3rd build", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "external";',
        "_unrelated.scss": "/* This is unrelated to anything. */"
      });
      let includeDir = makeFixtures("includeDir", {
        "external.scss": ".external { float: left; }"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".external {\n  float: left; }\n"
      });

      let compiledFiles = [];
      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        includePaths: [includeDir],
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fixturify.writeSync(projectDir, {
            "_unrelated.scss": "/* This is very unrelated to anything. */"
          });

          return build(builder)
            .then(outputDir2 => {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
              compiledFiles = [];
              fixturify.writeSync(projectDir, {
                "_unrelated.scss": "/* This is quite unrelated to anything. */"
              });

              return build(builder)
                .then(outputDir2 => {
                  assert.equal(outputDir, outputDir2);
                  assert.equal(compiledFiles.length, 0);
                  assertEqualDirs(outputDir2, expectedOutputDir);
                });
            });
        });
    });

    it("busts cache when file reached via includePaths changes", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "external";'
      });
      let includeDir = makeFixtures("includeDir", {
        "external.scss": ".external { float: left; }"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".external {\n  float: left; }\n"
      });

      let compiledFiles = [];
      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        includePaths: [includeDir],
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
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
            .then(outputDir2 => {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("busts cache when file mode changes", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "external";'
      });
      let includeDir = makeFixtures("includeDir", {
        "external.scss": ".external { float: left; }"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".external {\n  float: left; }\n"
      });

      let compiledFiles = [];
      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        includePaths: [includeDir],
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          fs.chmodSync(path.join(includeDir, "external.scss"), parseInt("755", 8));

          return build(builder)
            .then(outputDir2 => {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("busts cache when an eyeglass module is upgraded", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "eyeglass-module";'
      });
      let eyeglassModDir = makeFixtures("eyeglassmod", {
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
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".eyeglass-mod {\n  content: eyeglass; }\n"
      });

      let compiledFiles = [];
      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        },
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
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
            .then(outputDir2 => {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("busts cache when an eyeglass asset changes", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss":
          '@import "eyeglass-module/assets";\n' +
          '.rectangle { background: asset-url("eyeglass-module/shape.svg"); }\n'
      });
      let eyeglassModDir = makeFixtures("eyeglassmod2", {
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

      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "eyeglass-module": {
          "shape.svg": rectangleSVG
        },
        "project.css": '.rectangle {\n  background: url("/eyeglass-module/shape.svg"); }\n'
      });

      let compiledFiles = [];
      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        },
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
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
            .then(outputDir2 => {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("busts cache when file reached via ../ outside the load path changes", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "external";'
      });
      let relativeIncludeDir = makeFixtures("relativeIncludeDir", {
        "relative.scss": ".external { float: left; }"
      });
      let includeDir = makeFixtures("includeDir", {
        "external.scss": '@import "../relativeIncludeDir' + fixtureDirCount + '.tmp/relative";'
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".external {\n  float: left; }\n"
      });

      let compiledFiles = [];
      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        includePaths: [includeDir],
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
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
            .then(outputDir2 => {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("removes a css file when the corresponding sass file is removed", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": "/* project */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* project */\n"
      });

      let compiledFiles = [];
      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
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
            .then(outputDir2 => {
              assert.equal(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("removes an asset file when the corresponding sass file is removed", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss":
          '@import "eyeglass-module/assets";\n' +
          '.rectangle { background: asset-url("eyeglass-module/shape.svg"); }\n'
      });
      let eyeglassModDir = makeFixtures("eyeglassmod", {
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

      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "eyeglass-module": {
          "shape.svg": rectangleSVG
        },
        "project.css": '.rectangle {\n  background: url("/eyeglass-module/shape.svg"); }\n'
      });

      let compiledFiles = [];
      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        optionsGenerator(sassFile, cssFile, options, cb) {
          compiledFiles.push(sassFile);
          cb(cssFile, options);
        },
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      });

      let builder = new broccoli.Builder(compiler);

      return build(builder)
        .then(outputDir => {
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
            .then(outputDir2 => {
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
      let cache = new SyncDiskCache("test");
      return cache.clear();
    });

    function warmBuilders(count, dir, options, compilationListener) {
      let builders = [];

      for (var i = 0; i < count; i++) {
        let compiler = new EyeglassCompiler(dir, options);
        compiler.events.on("compiled", compilationListener);
        let builder = new broccoli.Builder(compiler);
        builder.compiler = compiler;
        builders.push(builder);
      }
      return builders;
    }

    afterEach(cleanupTempDirs);
    it("output files are symlinks", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      let compiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles.length = 0;

          allFilesAreSymlinks(outputDir);

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);

              allFilesAreSymlinks(outputDir2);
            });
        });
    });

    it("DOES NOT preserve cache if process.env.CI is set", function() {
      process.env.CI = true;

      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      let compiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles.length = 0;

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("preserves cache across builder instances", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      let compiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles.length = 0;

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("invalidates when a dependent file changes.", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      let compiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
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
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("restored side-effect outputs when cached.", function() {
      let projectDir = makeFixtures("projectDir", {
        "sass": {
          "project.scss": '@import "assets";\n' +
                          '.shape { content: asset-url("shape.svg"); }',
        },
        "assets": {
          "shape.svg": rectangleSVG
        }
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": '.shape {\n  content: url("/shape.svg"); }\n',
        "shape.svg": rectangleSVG
      });

      let compiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        sassDir: "sass",
        assets: "assets",
        cssDir: ".",
        persistentCache: "test",
        eyeglass: {
          root: projectDir
        }
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("invalidates when non-sass file dependencies change.", function() {
      let projectDir = makeFixtures("projectDir", {
        "sass": {
          "project.scss": '@import "assets";\n' +
                          '.shape { content: asset-url("shape.svg"); }',
        },
        "assets": {
          "shape.svg": rectangleSVG
        }
      });

      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": '.shape {\n  content: url("/shape.svg"); }\n',
        "shape.svg": rectangleSVG
      });

      let compiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        sassDir: "sass",
        assets: "assets",
        cssDir: ".",
        persistentCache: "test",
        eyeglass: {
          root: projectDir
        }
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
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
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("invalidates when eyeglass modules javascript files changes.", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss":
          ".foo { content: foo(); }\n"
      });
      let eyeglassModDir = makeFixtures("eyeglassmod", {
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

      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".foo {\n  content: foo; }\n"
      });

      let compiledFiles = [];

      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test",
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });


      return build(builders[0])
        .then(outputDir => {
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

          require("hash-for-dep")._resetCache();
          delete require.cache[path.join(eyeglassModDir, "eyeglass-exports.js")];
          delete require.cache[path.join(eyeglassModDir, "lib", "foo.js")];

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("invalidates when eyeglass modules javascript files changes (package.json).", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss":
          ".foo { content: foo(); }\n"
      });
      let eyeglassModDir = makeFixtures("eyeglassmod3", {
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

      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": ".foo {\n  content: foo; }\n"
      });

      let compiledFiles = [];

      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test",
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });


      return build(builders[0])
        .then(outputDir => {
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

          require("hash-for-dep")._resetCache();
          delete require.cache[path.join(eyeglassModDir, "eyeglass-exports.js")];
          delete require.cache[path.join(eyeglassModDir, "lib", "foo.js")];

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("caches main asset import scss", function() {
      let projectDir = makeFixtures("projectDir", {
        "file1.scss": '@import "assets";\n',
        "file2.scss": '@import "assets";\n',
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "file1.css": "",
        "file2.css": "",
      });

      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
      });
      let builder = new broccoli.Builder(compiler);

      // cache should start empty
      assert.deepEqual(compiler._assetImportCache, {});

      return build(builder)
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          // cache should have one entry
          assert.notDeepEqual(compiler._assetImportCache, {});
          assert.equal(Object.keys(compiler._assetImportCache).length, 1);
          // first file should be a miss, 2nd should return from cache
          assert.equal(compiler._assetImportCacheStats.misses, 1);
          assert.equal(compiler._assetImportCacheStats.hits, 1);
        });
    });

    it("caches module asset import scss", function() {
      let projectDir = makeFixtures("projectDir", {
        "file1.scss": '@import "eyeglass-module/assets";\n',
        "file2.scss": '@import "eyeglass-module/assets";\n',
      });
      let eyeglassModDir = makeFixtures("eyeglassmod", {
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
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "file1.css": "",
        "file2.css": ""
      });

      let compiler = new EyeglassCompiler(projectDir, {
        cssDir: ".",
        eyeglass: {
          modules: [
            {path: eyeglassModDir}
          ]
        }
      });
      let builder = new broccoli.Builder(compiler);

      // cache should start empty
      assert.deepEqual(compiler._assetImportCache, {});

      return build(builder)
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          // cache should have one entry
          assert.notDeepEqual(compiler._assetImportCache, {});
          assert.equal(Object.keys(compiler._assetImportCache).length, 1);
          // first file should be a miss, 2nd should return from cache
          assert.equal(compiler._assetImportCacheStats.misses, 1);
          assert.equal(compiler._assetImportCacheStats.hits, 1);
        });
    });

    it("can force invalidate the persistent cache", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      let compiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          process.env["BROCCOLI_EYEGLASS"] = "forceInvalidateCache";

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(1, compiledFiles.length);
              assertEqualDirs(outputDir2, expectedOutputDir);
            })
            .finally(() => {
              delete process.env["BROCCOLI_EYEGLASS"];
            });
        });
    });

    it("busts cache when options used for compilation are different", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      let compiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test"
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          compiledFiles = [];

          builders[1].compiler.options.foo = "bar";

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);
            });
        });
    });

    it("can use the rebuild cache after restoring from the persistent cache.", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      let compiledFiles = [];
      let hotCompiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test",
        optionsGenerator(sassFile, cssFile, options, cb) {
          hotCompiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          assert.equal(1, hotCompiledFiles.length);
          compiledFiles = [];
          hotCompiledFiles = [];

          return build(builders[1])
            .then(outputDir2 => {
              assert.notEqual(outputDir, outputDir2);
              assert.equal(compiledFiles.length, 0);
              assert.equal(hotCompiledFiles.length, 1);
              assertEqualDirs(outputDir2, expectedOutputDir);

              compiledFiles = [];
              hotCompiledFiles = [];

              return build(builders[1])
                .then(outputDir2 => {
                  assert.notEqual(outputDir, outputDir2);
                  assert.equal(compiledFiles.length, 0);
                  assert.equal(hotCompiledFiles.length, 0);
                  assertEqualDirs(outputDir2, expectedOutputDir);
                });
            });
        });
    });

    it("busts the rebuild cache after restoring from the persistent cache.", function() {
      let projectDir = makeFixtures("projectDir", {
        "project.scss": '@import "related";',
        "_related.scss": "/* This is related to something. */"
      });
      let expectedOutputDir = makeFixtures("expectedOutputDir", {
        "project.css": "/* This is related to something. */\n"
      });

      let compiledFiles = [];
      let hotCompiledFiles = [];
      let builders = warmBuilders(2, projectDir, {
        cssDir: ".",
        persistentCache: "test",
        optionsGenerator(sassFile, cssFile, options, cb) {
          hotCompiledFiles.push(sassFile);
          cb(cssFile, options);
        }
      }, details => {
        compiledFiles.push(details.fullSassFilename);
      });

      return build(builders[0])
        .then(outputDir => {
          assertEqualDirs(outputDir, expectedOutputDir);
          assert.equal(1, compiledFiles.length);
          assert.equal(1, hotCompiledFiles.length);
          compiledFiles = [];
          hotCompiledFiles = [];

          return build(builders[1])
            .then(outputDir2 => {
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
                "project.css": "/* This is related to something. */\n" +
                ".something {\n  color: red; }\n"
              });

              return build(builders[1])
                .then(outputDir2 => {
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

  describe("rebuild error handling", function() {
    const helper = require("broccoli-test-helper");
    const co = require("co");
    const expect = require("chai").expect;
    const createBuilder = helper.createBuilder;
    const createTempDir = helper.createTempDir;
    let input, output;

    beforeEach(co.wrap(function* () {
      input = yield createTempDir();
    }));

    afterEach(function() {
      if (input) {
        input.dispose();
      }
      if (output) {
        output.dispose();
      }
    });

    it("blows away state, so mid-build errors can be recoverable", co.wrap(function* () {
      const subject = new EyeglassCompiler(input.path(), {
        cssDir: "."
      });
      output = createBuilder(subject);

      input.write({
        "omg.scss": ".valid-1 { display: block; }"
      });

      yield output.build();

      expect(output.read()).to.eql({
        "omg.css": ".valid-1 {" + EOL + "  display: block; }" + EOL
      });

      input.write({
        "omg.scss": "invalid"
      });

      try {
        yield output.build();
        expect(true).to.eql(false);
      } catch (e) {
        expect(e.name).to.eql("BuildError");
      }
      expect(output.read()).to.eql({ });

      input.write({
        "omg.scss": ".valid-2 { display: block }"
      });

      yield output.build();

      expect(output.read()).to.eql({
        "omg.css": ".valid-2 {" + EOL + "  display: block; }" + EOL
      });
    }));
  });
});
