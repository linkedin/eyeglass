"use strict";

var eyeglass = require("../lib");
var nodeSass = require("node-sass");
var dartSass = require("sass");
var path = require("path");
var assert = require("assert");
var capture = require("./capture");
var fs = require("fs");

function utils(sass) {
  function sassOptions(options) {
    if (typeof options.options === "object") {
      return options.options;
    } else {
      options.outputStyle = options.outputStyle || "expanded";
      options.eyeglass = options.eyeglass || {};
      options.eyeglass.engines = options.eyeglass.engines || {};
      options.eyeglass.engines.sass = options.eyeglass.engines.sass || sass;
      return eyeglass(options);
    }
  }
  function assertCompilesSync(options, expectedOutput) {
    try {
      var result = compileSync(options);
      assert.equal(result.css.toString().trim(), expectedOutput.trim());
    } catch (err) {
      assert(!err, err.toString());
    }
  }

  function assertCompiles(options, expectedOutput, done) {
    compile(options, function (err, result) {
      assert(!err, err && err.message);
      assert.equal(result.css.toString().trim(), expectedOutput.trim());
      done();
    });
  }

  function assertCompilationError(options, expectedError, done) {
    var testutils = this;
    compile(options, function (err, result) {
      assert(!result, result ? "Should not have compiled to: " + result.css : "");
      assert(err);
      if (typeof expectedError == "object" && expectedError.message) {
        var matchData = err.message.match(/error in C function ([^:]+): (.*)$/m);
        if (matchData) {
          assert.equal(matchData[2], expectedError.message);
        } else {
          assert.equal(err.message, expectedError.message);
        }
      } else {
        testutils.assertMultilineEqual(err.message, expectedError);
      }
      done();
    });
  }
  function compile(options, cb) {
    try {
      var sassOpts = sassOptions(options);
      sass.render(sassOpts, cb);
    } catch (err) {
      // console.log(err, err.stack.split("\n"));
      cb(err, null);
    }
  }
  function compileSync(options) {
    return sass.renderSync(sassOptions(options));
  }

  return {
    sassOptions,
    assertCompiles,
    assertCompilesSync,
    assertCompilationError,
    compile,
    compileSync,
  };
}

const nodeSassTestUtils = utils(nodeSass);
const dartSassTestUtils = utils(dartSass);

module.exports = {
  withEachSass: function(cb) {
    cb(nodeSass, "node-sass", nodeSassTestUtils);
    cb(dartSass, "dart-sass", dartSassTestUtils);
  },
  fixtureDirectory: function(subpath) {
    return path.join(__dirname, "fixtures", subpath);
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
    // assert.equal(lines1.length, lines2.length, "Number of lines differ.");
    for (var lineNumber = 0; lineNumber < lines1.length; lineNumber++) {
      assert.equal(lines1[lineNumber], lines2[lineNumber],
        "Line #" + lineNumber + " differs: " + lines1[lineNumber] + " != " + lines2[lineNumber]);
    }
  },
  assertFileExists: function(filename) {
    assert(fs.existsSync(filename));
  }
};
