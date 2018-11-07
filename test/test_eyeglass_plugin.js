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
const glob = require("glob");
const EyeglassCompiler = require("../lib/index");
const SyncDiskCache = require("sync-disk-cache");
const walkSync = require("walk-sync");
const os = require("os");
const EOL = os.EOL;
const co = require("co");
const { createBuilder, createTempDir, fromDir } = require("broccoli-test-helper");
const expect = require("chai").expect;

const FIXTURES = fromDir(path.join(__dirname, "fixtures"));

function allFilesAreSymlinks(root) {
  walkSync(root, { directories: false }).forEach(filepath => {
    fs.readlinkSync(root + "/" + filepath); // throws if the file is not a link
  });

  assert(true, "all files are symlinks");
}

function svg(contents) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg"\n' +
    '     xmlns:xlink="http://www.w3.org/1999/xlink">\n' +
    contents +
    "</svg>\n"
  );
}

const rectangleSVG = svg(
  '  <rect x="10" y="10" height="100" width="100"\n' +
    '        style="stroke:#ff0000; fill: #0000ff"/>\n'
);

const circleSVG = svg('<circle cx="40" cy="40" r="24" style="stroke:#006600; fill:#00cc00"/>');

describe("EyeglassCompiler", function() {
  let include, input, output, eyeglassModule, assertEqualDirsTempDir;

  const hasCIValue = "CI" in process.env;
  const CI_VALUE = process.env.CI;

  beforeEach(
    co.wrap(function*() {
      input = yield createTempDir();
      include = yield createTempDir();
      eyeglassModule = yield createTempDir();
      assertEqualDirsTempDir = yield createTempDir();

      delete process.env.CI;
    })
  );

  afterEach(function() {
    if (input) {
      input.dispose();
    }
    if (output) {
      output.dispose();
    }
    if (include) {
      include.dispose();
    }
    if (eyeglassModule) {
      eyeglassModule.dispose();
    }
    if (assertEqualDirsTempDir) {
      assertEqualDirsTempDir.dispose();
    }

    if (hasCIValue) {
      process.env.CI = CI_VALUE;
    } else {
      delete process.env.CI;
    }
  });

  function assertEqualDirs(actualDir, _expectedDir) {
    let expectedDir = _expectedDir;

    if (typeof expectedDir !== "string") {
      assertEqualDirsTempDir.write(expectedDir);
      expectedDir = assertEqualDirsTempDir.path();
    }

    let actualFiles = glob.sync("**/*", { cwd: actualDir }).sort();
    let expectedFiles = glob.sync("**/*", { cwd: expectedDir }).sort();

    assert.deepStrictEqual(actualFiles, expectedFiles);

    actualFiles.forEach(file => {
      let actualPath = path.join(actualDir, file);
      let expectedPath = path.join(expectedDir, file);
      let stats = fs.statSync(actualPath);

      if (stats.isFile()) {
        assert.strictEqual(
          fs.readFileSync(actualPath).toString(),
          fs.readFileSync(expectedPath).toString()
        );
      }
    });
  }

  it(
    "compiles sass files with the minimal options",
    co.wrap(function*() {
      input.copy(FIXTURES.path("basicProject/input"));

      let optimizer = new EyeglassCompiler(input.path(), {
        cssDir: ".",
      });

      output = createBuilder(optimizer);

      yield output.build();

      assertEqualDirs(output.path(), FIXTURES.path("basicProject/output"));
    })
  );

  it(
    "compiles sass files with option.relativeAssets set",
    co.wrap(function*() {
      input.copy(FIXTURES.path("basicProject/input"));
      let optimizer = new EyeglassCompiler(input.path(), {
        cssDir: ".",
        relativeAssets: true,
      });

      output = createBuilder(optimizer);

      yield output.build();

      assertEqualDirs(output.path(), FIXTURES.path("basicProject/output"));
    })
  );

  it("passes unknown options to eyeglass", function() {
    input.copy(FIXTURES.path("basicProject/input"));
    let optimizer = new EyeglassCompiler(input.path(), {
      cssDir: ".",
      foo: true,
    });

    assert.strictEqual(undefined, optimizer.options.cssDir);
    assert.strictEqual(".", optimizer.cssDir);
    assert.strictEqual(optimizer.options.foo, true);
  });

  it("forbids the file option", function() {
    assert.throws(() => {
      input.copy(FIXTURES.path("basicProject/input"));
      new EyeglassCompiler(input.path(), {
        cssDir: ".",
        file: "asdf",
      });
    }, /The node-sass option 'file' cannot be set explicitly\./);
  });

  it("forbids the data option", function() {
    assert.throws(() => {
      input.copy(FIXTURES.path("basicProject/input"));
      new EyeglassCompiler(input.path(), {
        cssDir: ".",
        data: "asdf",
      });
    }, /The node-sass option 'data' cannot be set explicitly\./);
  });

  it("forbids the outFile option", function() {
    assert.throws(() => {
      input.copy(FIXTURES.path("basicProject/input"));
      new EyeglassCompiler(input.path(), {
        cssDir: ".",
        outFile: "asdf",
      });
    }, /The node-sass option 'outFile' cannot be set explicitly\./);
  });

  it(
    "outputs exceptions when the fullException option is set",
    co.wrap(function*() {
      input.copy(FIXTURES.path("errorProject/input"));
      let optimizer = new EyeglassCompiler(input.path(), {
        cssDir: ".",
        fullException: true,
      });

      output = createBuilder(optimizer);

      try {
        yield output.build();

        assertEqualDirs(output.path(), FIXTURES.path("basicProject/output"));
      } catch (error) {
        assert.ok(error.message.includes("property \"asdf\" must be followed by a ':'"));
      }
    })
  );

  // TODO: rwjblue -> debug resolution issue
  it.skip(
    "supports manual modules",
    co.wrap(function*() {
      let modules;

      try {
        modules = yield createTempDir();

        modules.copy(FIXTURES.path("manualModule"));
        input.copy(FIXTURES.path("usesManualModule/input"));

        let optimizer = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          fullException: true,
          eyeglass: {
            modules: [{ path: modules.path() }],
          },
        });

        output = createBuilder(optimizer);

        yield output.build();

        assertEqualDirs(output.path(), FIXTURES.path("usesManualModule/output"));
      } finally {
        yield modules.dispose();
      }
    })
  );

  function cleanupTempDirs() {
    let tmpDirs = glob.sync(path.join(path.resolve(__dirname, "fixtures"), "**", "*.tmp"));

    tmpDirs.forEach(tmpDir => rimraf.sync(tmpDir));
  }

  describe("optionsGenerator", function() {
    it(
      "allow outputFile names to be safely overwritten",
      co.wrap(function*() {
        input.copy(FIXTURES.path("assetsProject/input"));
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          optionsGenerator(sassFile, cssFile, options, cb) {
            // 1 cssFile, but two `cb()` with different names, should result in
            // two seperate outputfiles
            cb("first.css", options);
            cb("second.css", options);
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        let first = fs.readlinkSync(output.path("/first.css"));
        let second = fs.readlinkSync(output.path("/second.css"));

        assert.notStrictEqual(first, second);
        assert.strictEqual(path.basename(first), "first.css");
        assert.strictEqual(path.basename(second), "second.css");
      })
    );
  });

  describe("caching", function() {
    afterEach(cleanupTempDirs);

    it(
      "caches when an unrelated file changes",
      co.wrap(function*() {
        input.copy(FIXTURES.path("basicProject/input"));
        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
        });

        input.write({
          styles: {
            "_unused.scss": "// this is not used",
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), FIXTURES.path("basicProject/output"));
        assert.strictEqual(1, compiledFiles.length);

        input.write({
          styles: {
            "_unused.scss": "// changed but still not not used",
          },
        });

        yield output.build();

        assert.deepStrictEqual(output.changes(), {});
      })
    );

    it(
      "doesn't cache when there's a change",
      co.wrap(function*() {
        input.copy(FIXTURES.path("basicProject/input"));
        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), FIXTURES.path("basicProject/output"));
        assert.strictEqual(1, compiledFiles.length);

        input.write({
          styles: {
            "foo.scss":
              '@import "used";\n' + "$color: blue;\n" + ".foo {\n" + "  color: $color;\n" + "}\n",
          },
        });

        yield output.build();

        assert.deepStrictEqual(output.changes(), {
          "styles/foo.css": "change",
        });

        assert.strictEqual(output.readText("styles/foo.css"), ".foo {\n" + "  color: blue; }\n");
      })
    );

    it(
      "caches on the 3rd build",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "external";',
          "_unrelated.scss": "/* This is unrelated to anything. */",
        });

        include.write({
          "external.scss": ".external { float: left; }",
        });

        let expectedOutput = {
          "project.css": ".external {\n  float: left; }\n",
        };

        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          includePaths: [include.path()],
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles = [];

        input.write({
          "_unrelated.scss": "/* This is very unrelated to anything. */",
        });

        yield output.build();

        assert.strictEqual(compiledFiles.length, 0);
        assertEqualDirs(output.path(), expectedOutput);

        compiledFiles = [];
        input.write({
          "_unrelated.scss": "/* This is quite unrelated to anything. */",
        });

        yield output.build();

        assert.strictEqual(compiledFiles.length, 0);
        assertEqualDirs(output.path(), expectedOutput);
      })
    );

    it(
      "busts cache when file reached via includePaths changes",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "external";',
        });

        include.write({
          "external.scss": ".external { float: left; }",
        });

        let expectedOutput = {
          "project.css": ".external {\n  float: left; }\n",
        };

        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          includePaths: [include.path()],
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles = [];

        include.write({
          "external.scss": ".external { float: right; }",
        });

        expectedOutput = {
          "project.css": ".external {\n  float: right; }\n",
        };

        yield output.build();

        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(output.path(), expectedOutput);
      })
    );

    it(
      "busts cache when file mode changes",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "external";',
        });

        include.write({
          "external.scss": ".external { float: left; }",
        });

        let expectedOutput = {
          "project.css": ".external {\n  float: left; }\n",
        };

        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          includePaths: [include.path()],
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles = [];

        fs.chmodSync(path.join(include.path(), "external.scss"), parseInt("755", 8));

        yield output.build();

        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(output.path(), expectedOutput);
      })
    );

    // TODO: rwjblue -> debug resolution issue
    it.skip(
      "busts cache when an eyeglass module is upgraded",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "eyeglass-module";',
        });

        eyeglassModule.write({
          "package.json":
            "{\n" +
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
          sass: {
            "index.scss": ".eyeglass-mod { content: eyeglass }",
          },
        });

        let expectedOutput = {
          "project.css": ".eyeglass-mod {\n  content: eyeglass; }\n",
        };

        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
          eyeglass: {
            modules: [{ path: eyeglassModule.path() }],
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles = [];

        eyeglassModule.write({
          sass: {
            "index.scss": ".eyeglass-mod { content: eyeglass-changed }",
          },
        });

        expectedOutput = {
          "project.css": ".eyeglass-mod {\n  content: eyeglass-changed; }\n",
        };

        yield output.build();

        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(output.path(), expectedOutput);
      })
    );

    // TODO: rwjblue -> debug resolution issue
    it.skip(
      "busts cache when an eyeglass asset changes",
      co.wrap(function*() {
        input.write({
          "project.scss":
            '@import "eyeglass-module/assets";\n' +
            '.rectangle { background: asset-url("eyeglass-module/shape.svg"); }\n',
        });

        eyeglassModule.write({
          "package.json":
            "{\n" +
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
          sass: {
            "index.scss": ".eyeglass-mod { content: eyeglass }",
          },
          images: {
            "shape.svg": rectangleSVG,
          },
        });

        let expectedOutput = {
          "eyeglass-module": {
            "shape.svg": rectangleSVG,
          },
          "project.css": '.rectangle {\n  background: url("/eyeglass-module/shape.svg"); }\n',
        };

        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
          eyeglass: {
            modules: [{ path: eyeglassModule.path() }],
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles = [];

        eyeglassModule.write({
          images: {
            "shape.svg": circleSVG,
          },
        });

        expectedOutput = {
          "project.css": '.rectangle {\n  background: url("/eyeglass-module/shape.svg"); }\n',
          "eyeglass-module": {
            "shape.svg": circleSVG,
          },
        };

        yield output.build();

        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(output.path(), expectedOutput);
      })
    );

    it(
      "busts cache when file reached via ../ outside the load path changes",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "external";',
        });

        include.write({
          relativeIncludeDir: {
            "relative.scss": ".external { float: left; }",
          },
          includeDir: {
            "external.scss": '@import "../relativeIncludeDir/relative";',
          },
        });

        let expectedOutput = {
          "project.css": ".external {\n  float: left; }\n",
        };

        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          includePaths: [include.path("includeDir")],
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles = [];

        include.write({
          relativeIncludeDir: {
            "relative.scss": ".external { float: right; }",
          },
        });

        expectedOutput = {
          "project.css": ".external {\n  float: right; }\n",
        };

        yield output.build();

        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(output.path(), expectedOutput);
      })
    );

    it(
      "removes a css file when the corresponding sass file is removed",
      co.wrap(function*() {
        input.write({
          "project.scss": "/* project */",
        });

        let expectedOutput = {
          "project.css": "/* project */\n",
        };

        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
        });

        output = createBuilder(compiler);

        yield output.build();
        assertEqualDirs(output.path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles = [];

        input.write({
          "project.scss": null,
        });

        expectedOutput = {
          "project.css": null,
        };

        yield output.build();

        assert.strictEqual(compiledFiles.length, 0);
        assertEqualDirs(output.path(), expectedOutput);
      })
    );

    // TODO: rwjblue -> debug resolution issue
    it.skip(
      "removes an asset file when the corresponding sass file is removed",
      co.wrap(function*() {
        input.write({
          "project.scss":
            '@import "eyeglass-module/assets";\n' +
            '.rectangle { background: asset-url("eyeglass-module/shape.svg"); }\n',
        });

        eyeglassModule.write({
          "package.json":
            "{\n" +
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
          sass: {
            "index.scss": ".eyeglass-mod { content: eyeglass }",
          },
          images: {
            "shape.svg": rectangleSVG,
          },
        });

        let expectedOutput = {
          "eyeglass-module": {
            "shape.svg": rectangleSVG,
          },
          "project.css": '.rectangle {\n  background: url("/eyeglass-module/shape.svg"); }\n',
        };

        let compiledFiles = [];
        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          optionsGenerator(sassFile, cssFile, options, cb) {
            compiledFiles.push(sassFile);
            cb(cssFile, options);
          },
          eyeglass: {
            modules: [{ path: eyeglassModule.path() }],
          },
        });

        output = createBuilder(compiler);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles = [];

        input.write({
          "project.scss": null,
        });

        expectedOutput = {
          "project.css": null,
          "eyeglass-module": {
            "shape.svg": null,
          },
        };

        yield output.build();

        assert.strictEqual(compiledFiles.length, 0);
        assertEqualDirs(output.path(), expectedOutput);
      })
    );

    it("doesn't remove an asset unless no files are using it anymore");
  });

  describe("warm caching", function() {
    let builders;

    afterEach(
      co.wrap(function*() {
        let cache = new SyncDiskCache("test");
        cache.clear();

        if (builders) {
          for (let i = 0; i < builders.length; i++) {
            yield builders[i].dispose();
          }
        }

        cleanupTempDirs();
      })
    );

    function warmBuilders(count, dir, options, compilationListener) {
      let builders = [];

      for (var i = 0; i < count; i++) {
        let compiler = new EyeglassCompiler(dir, options);
        compiler.events.on("compiled", compilationListener);

        let output = createBuilder(compiler);
        output.compiler = compiler;

        builders.push(output);
      }

      return builders;
    }

    it(
      "output files are symlinks",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "related";',
          "_related.scss": "/* This is related to something. */",
        });

        let expectedOutput = {
          "project.css": "/* This is related to something. */\n",
        };

        let compiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        allFilesAreSymlinks(builders[0].path());

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 0);
        assertEqualDirs(builders[1].path(), expectedOutput);

        allFilesAreSymlinks(builders[1].path());
      })
    );

    it(
      "DOES NOT preserve cache if process.env.CI is set",
      co.wrap(function*() {
        process.env.CI = true;

        input.write({
          "project.scss": '@import "related";',
          "_related.scss": "/* This is related to something. */",
        });

        let expectedOutput = {
          "project.css": "/* This is related to something. */\n",
        };

        let compiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "preserves cache across builder instances",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "related";',
          "_related.scss": "/* This is related to something. */",
        });

        let expectedOutput = {
          "project.css": "/* This is related to something. */\n",
        };

        let compiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 0);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "invalidates when a dependent file changes.",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "related";',
          "_related.scss": "/* This is related to something. */",
        });

        let expectedOutput = {
          "project.css": "/* This is related to something. */\n",
        };

        let compiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        input.write({
          "_related.scss": "/* something related changed */",
        });

        expectedOutput = {
          "project.css": "/* something related changed */\n",
        };

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "restored side-effect outputs when cached.",
      co.wrap(function*() {
        input.write({
          "package.json": JSON.stringify({}),
          sass: {
            "project.scss": '@import "assets";\n' + '.shape { content: asset-url("shape.svg"); }',
          },
          assets: {
            "shape.svg": rectangleSVG,
          },
        });

        let expectedOutput = {
          "project.css": '.shape {\n  content: url("/shape.svg"); }\n',
          "shape.svg": rectangleSVG,
        };

        let compiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            sassDir: "sass",
            assets: "assets",
            cssDir: ".",
            persistentCache: "test",
            eyeglass: {
              root: input.path(),
            },
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 0);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "invalidates when non-sass file dependencies change.",
      co.wrap(function*() {
        input.write({
          "package.json": JSON.stringify({}),
          sass: {
            "project.scss": '@import "assets";\n' + '.shape { content: asset-url("shape.svg"); }',
          },
          assets: {
            "shape.svg": rectangleSVG,
          },
        });

        let expectedOutput = {
          "project.css": '.shape {\n  content: url("/shape.svg"); }\n',
          "shape.svg": rectangleSVG,
        };

        let compiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            sassDir: "sass",
            assets: "assets",
            cssDir: ".",
            persistentCache: "test",
            eyeglass: {
              root: input.path(),
            },
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        input.write({
          assets: {
            "shape.svg": circleSVG,
          },
        });

        expectedOutput = {
          "shape.svg": circleSVG,
        };

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "invalidates when eyeglass modules javascript files changes.",
      co.wrap(function*() {
        input.write({
          "project.scss": ".foo { content: foo(); }\n",
        });

        eyeglassModule.write({
          "package.json":
            "{\n" +
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
          sass: {
            "index.scss": ".eyeglass-mod { content: eyeglass }",
          },
          lib: {
            "foo.js": "module.exports = 'foo';\n",
          },
          images: {
            "shape.svg": rectangleSVG,
          },
        });

        let expectedOutput = {
          "project.css": ".foo {\n  content: foo; }\n",
        };

        let compiledFiles = [];

        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
            eyeglass: {
              modules: [{ path: eyeglassModule.path() }],
            },
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        eyeglassModule.write({
          lib: {
            "foo.js": "module.exports = 'changed-foo';\n",
          },
        });

        expectedOutput = {
          "project.css": ".foo {\n  content: changed-foo; }\n",
        };

        require("hash-for-dep")._resetCache();
        delete require.cache[fs.realpathSync(eyeglassModule.path("eyeglass-exports.js"))];
        delete require.cache[fs.realpathSync(eyeglassModule.path("lib/foo.js"))];

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "invalidates when eyeglass modules javascript files changes (package.json).",
      co.wrap(function*() {
        input.write({
          "project.scss": ".foo { content: foo(); }\n",
        });

        eyeglassModule.write({
          "package.json":
            "{\n" +
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
          sass: {
            "index.scss": ".eyeglass-mod { content: eyeglass }",
          },
          lib: {
            "foo.js": "module.exports = 'foo';\n",
          },
          images: {
            "shape.svg": rectangleSVG,
          },
        });

        let expectedOutput = {
          "project.css": ".foo {\n  content: foo; }\n",
        };

        let compiledFiles = [];

        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
            eyeglass: {
              modules: [{ path: eyeglassModule.path() }],
            },
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        eyeglassModule.write({
          lib: {
            "foo.js": "module.exports = 'changed-foo';\n",
          },
        });

        expectedOutput = {
          "project.css": ".foo {\n  content: changed-foo; }\n",
        };

        require("hash-for-dep")._resetCache();
        delete require.cache[fs.realpathSync(eyeglassModule.path("eyeglass-exports.js"))];
        delete require.cache[fs.realpathSync(eyeglassModule.path("lib/foo.js"))];

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "caches main asset import scss",
      co.wrap(function*() {
        input.write({
          "file1.scss": '@import "assets";\n',
          "file2.scss": '@import "assets";\n',
        });

        let expectedOutput = {
          "file1.css": "",
          "file2.css": "",
        };

        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
        });

        output = createBuilder(compiler);

        // cache should start empty
        assert.strictEqual(Object.keys(compiler._assetImportCache).length, 0);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);

        // cache should have one entry
        assert.strictEqual(Object.keys(compiler._assetImportCache).length, 1);
        // first file should be a miss, 2nd should return from cache
        assert.strictEqual(compiler._assetImportCacheStats.misses, 1);
        assert.strictEqual(compiler._assetImportCacheStats.hits, 1);
      })
    );

    // TODO: rwjblue -> debug resolution issue
    it.skip(
      "caches module asset import scss",
      co.wrap(function*() {
        input.write({
          "file1.scss": '@import "eyeglass-module/assets";\n',
          "file2.scss": '@import "eyeglass-module/assets";\n',
        });

        eyeglassModule.write({
          "package.json":
            "{\n" +
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

        let expectedOutput = {
          "file1.css": "",
          "file2.css": "",
        };

        let compiler = new EyeglassCompiler(input.path(), {
          cssDir: ".",
          eyeglass: {
            modules: [{ path: eyeglassModule.path() }],
          },
        });

        output = createBuilder(compiler);

        // cache should start empty
        assert.strictEqual(Object.keys(compiler._assetImportCache).length, 0);

        yield output.build();

        assertEqualDirs(output.path(), expectedOutput);
        // cache should have one entry
        assert.strictEqual(Object.keys(compiler._assetImportCache).length, 1);
        // first file should be a miss, 2nd should return from cache
        assert.strictEqual(compiler._assetImportCacheStats.misses, 1);
        assert.strictEqual(compiler._assetImportCacheStats.hits, 1);
      })
    );

    it(
      "can force invalidate the persistent cache",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "related";',
          "_related.scss": "/* This is related to something. */",
        });

        let expectedOutput = {
          "project.css": "/* This is related to something. */\n",
        };

        let compiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        try {
          process.env["BROCCOLI_EYEGLASS"] = "forceInvalidateCache";

          yield builders[1].build();

          assert.notStrictEqual(builders[0].path(), builders[1].path());
          assert.strictEqual(compiledFiles.length, 1);
          assertEqualDirs(builders[1].path(), expectedOutput);
        } finally {
          delete process.env["BROCCOLI_EYEGLASS"];
        }
      })
    );

    it(
      "busts cache when options used for compilation are different",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "related";',
          "_related.scss": "/* This is related to something. */",
        });

        let expectedOutput = {
          "project.css": "/* This is related to something. */\n",
        };

        let compiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        compiledFiles.length = 0;

        builders[1].compiler.options.foo = "bar";

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "can use the rebuild cache after restoring from the persistent cache.",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "related";',
          "_related.scss": "/* This is related to something. */",
        });

        let expectedOutput = {
          "project.css": "/* This is related to something. */\n",
        };

        let compiledFiles = [];
        let hotCompiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
            optionsGenerator(sassFile, cssFile, options, cb) {
              hotCompiledFiles.push(sassFile);
              cb(cssFile, options);
            },
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        assert.strictEqual(1, hotCompiledFiles.length);

        compiledFiles = [];
        hotCompiledFiles = [];

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 0);
        assert.strictEqual(hotCompiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);

        compiledFiles = [];
        hotCompiledFiles = [];

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 0);
        assert.strictEqual(hotCompiledFiles.length, 0);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it(
      "busts the rebuild cache after restoring from the persistent cache.",
      co.wrap(function*() {
        input.write({
          "project.scss": '@import "related";',
          "_related.scss": "/* This is related to something. */",
        });

        let expectedOutput = {
          "project.css": "/* This is related to something. */\n",
        };

        let compiledFiles = [];
        let hotCompiledFiles = [];
        builders = warmBuilders(
          2,
          input.path(),
          {
            cssDir: ".",
            persistentCache: "test",
            optionsGenerator(sassFile, cssFile, options, cb) {
              hotCompiledFiles.push(sassFile);
              cb(cssFile, options);
            },
          },
          details => {
            compiledFiles.push(details.fullSassFilename);
          }
        );

        yield builders[0].build();

        assertEqualDirs(builders[0].path(), expectedOutput);
        assert.strictEqual(1, compiledFiles.length);
        assert.strictEqual(1, hotCompiledFiles.length);
        compiledFiles = [];
        hotCompiledFiles = [];

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 0);
        assert.strictEqual(hotCompiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);

        compiledFiles = [];
        hotCompiledFiles = [];

        input.write({
          "project.scss": '@import "related"; .something { color: red; }',
        });

        expectedOutput = {
          "project.css":
            "/* This is related to something. */\n" + ".something {\n  color: red; }\n",
        };

        yield builders[1].build();

        assert.notStrictEqual(builders[0].path(), builders[1].path());
        assert.strictEqual(compiledFiles.length, 1);
        assert.strictEqual(hotCompiledFiles.length, 1);
        assertEqualDirs(builders[1].path(), expectedOutput);
      })
    );

    it("doesn't check the persistent cache when doing a rebuild in the same instance.");
    it("busts cache when a file higher in the load path order is added");
  });

  describe("rebuild error handling", function() {
    it(
      "blows away state, so mid-build errors can be recoverable",
      co.wrap(function*() {
        const subject = new EyeglassCompiler(input.path(), {
          cssDir: ".",
        });
        output = createBuilder(subject);

        input.write({
          "omg.scss": ".valid-1 { display: block; }",
        });

        yield output.build();

        expect(output.read()).to.eql({
          "omg.css": ".valid-1 {" + EOL + "  display: block; }" + EOL,
        });

        input.write({
          "omg.scss": "invalid",
        });

        try {
          yield output.build();
          expect(true).to.eql(false);
        } catch (e) {
          expect(e.name).to.eql("BuildError");
        }
        expect(output.read()).to.eql({});

        input.write({
          "omg.scss": ".valid-2 { display: block }",
        });

        yield output.build();

        expect(output.read()).to.eql({
          "omg.css": ".valid-2 {" + EOL + "  display: block; }" + EOL,
        });
      })
    );
  });
});
