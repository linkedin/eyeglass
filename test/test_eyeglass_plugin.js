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
var broccoli = require("broccoli");
var RSVP = require("rsvp");
var glob = require("glob");
var EyeglassCompiler = require("../lib/index");

function fixtureSourceDir(name) {
  return path.resolve(__dirname, "fixtures", name, "input");
}

function fixtureOutputDir(name) {
  return path.resolve(__dirname, "fixtures", name, "output");
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

  /*
    moveOption(this.options, this, "cssDir", "sassDir",
                                   "optionsGenerator", "fullException",
                                   "verbose", "renderSync",
                                   "discover", "sourceFiles");
   */
});
