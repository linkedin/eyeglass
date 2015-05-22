"use strict";

var eyeglass = require("../lib/options_decorator");
var sass = require("node-sass");
var path = require("path");
var assert = require("assert");
var capture = require("../lib/util/capture");

module.exports = {
  fixtureDirectory: function(subpath) {
    return path.join(__dirname, "fixtures", subpath);
  },
  assertCompilesSync: function(options, expectedOutput) {
    try {
      var result = this.compileSync(options);
      assert.equal(expectedOutput, result.css.toString());
    } catch (err) {
      assert(!err, err.toString());
    }
  },
  assertCompiles: function(options, expectedOutput, done) {
    this.compile(options, function(err, result) {
      assert(!err, err && err.message);
      assert.equal(expectedOutput, result.css.toString());
      done();
    });
  },
  assertCompilationError: function(options, expectedError, done) {
    var testutils = this;
    this.compile(options, function(err, result) {
      assert(err);
      assert(!result);
      testutils.assertMultilineEqual(err.message, expectedError);
      done();
    });
  },
  compile: function(options, cb) {
    sass.render(this.sassOptions(options), cb);
  },
  compileSync: function(options) {
    return sass.renderSync(this.sassOptions(options));
  },
  sassOptions: function(options) {
    if (typeof options.sassOptions === "function") {
      return options.sassOptions();
    } else {
      return eyeglass(options);
    }
  },
  assertStdout: function(work) {
    this.assertCapture(work, "stdout");
  },
  assertStderr: function(work) {
    this.assertCapture(work, "stderr");
  },
  assertCapture: function(work, stream) {
    var output = "";
    var release = capture(function(string) {
      output = output + string;
    }, stream);
    work(function(expectedOutput) {
      release();
      assert.equal(output, expectedOutput);
    });
  },
  assertMultilineEqual: function(string1, string2) {
    var lines1 = string1.split("\n");
    var lines2 = string2.split("\n");
    assert.equal(lines1.length, lines2.length, "Number of lines differ.");
    for (var lineNumber = 0; lineNumber < lines1.length; lineNumber++) {
      assert.equal(lines1[lineNumber], lines2[lineNumber],
        "Line #" + lineNumber + " differs: " + lines1[lineNumber] + " != " + lines2[lineNumber]);
    }
  }
};
