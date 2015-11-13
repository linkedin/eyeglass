"use strict";

var eyeglass = require("../lib").decorate;
var sass = require("node-sass");
var path = require("path");
var assert = require("assert");
var capture = require("./capture");
var fs = require("fs");

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
      assert(!result, result ? "Should not have compiled to: " + result.css : "");
      assert(err);
      if (typeof expectedError == "object" && expectedError.message) {
        var matchData = err.message.match(/error in C function ([^:]+): (.*)$/m);
        if (matchData) {
          assert.equal(expectedError.message, matchData[2]);
        } else {
          assert.equal(expectedError.message, err.message);
        }
      } else {
        testutils.assertMultilineEqual(err.message, expectedError);
      }
      done();
    });
  },
  compile: function(options, cb) {
    try {
      var sassOpts = this.sassOptions(options);
      sass.render(sassOpts, cb);
    } catch (err) {
      console.log(err, err.stack.split("\n"));
      cb(err, null);
    }
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
  assertStdout: function(work, check) {
    this.assertCapture(work, "stdout", check);
  },
  assertStderr: function(work, check) {
    this.assertCapture(work, "stderr", check);
  },
  assertCapture: function(work, stream, check) {
    check = check || assert.equal;
    var output = "";
    var release = capture(function(string) {
      output = output + string;
    }, stream);
    work(function(expectedOutput) {
      release();
      check(output, expectedOutput);
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
  },
  assertFileExists: function(filename) {
    assert(fs.existsSync(filename));
  }
};
