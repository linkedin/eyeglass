"use strict";

var assert = require("assert");
var sass = require("node-sass");
var testutils = require("./testutils");

var eyeglass = require("../lib/options_decorator");

describe("function loading", function () {

  it("should discover sass functions", function (done) {
    var options = {
      root: testutils.fixtureDirectory("function_modules"),
      data: "#hello { greeting: hello(Chris); }\n" +
            "#transitive { is: transitive(); }\n"
    };
    var expected = "#hello {\n  greeting: Hello, Chris!; }\n\n" +
                   "#transitive {\n  is: transitive; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should let me define my own sass functions too", function (done) {
    var input = "#hello { greeting: hello(Chris); }\n" +
                "#mine { something: add-one(3em); }\n";
    var options = {
      root: testutils.fixtureDirectory("function_modules"),
      data: input,
      functions: {
        "add-one($number)": function(number) {
          return sass.types.Number(number.getValue() + 1, number.getUnit());
        }
      }
    };
    var expected = "#hello {\n  greeting: Hello, Chris!; }\n\n" +
                   "#mine {\n  something: 4em; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should let local functions override imported functions", function (done) {
    testutils.assertStdout(function(checkOutput) {
      var input = "#hello { greeting: hello(Chris); }\n";
      var expectedOutput = "#hello {\n  greeting: Goodbye, Chris!; }\n";
      var options = {
        root: testutils.fixtureDirectory("function_modules"),
        data: input,
        functions: {
          "hello($name: \"World\")": function(name) {
            return sass.types.String("Goodbye, " + name.getValue() + "!");
          }
        }
      };
      testutils.assertCompiles(options, expectedOutput, function() {
        checkOutput("");
        done();
      });
    });
  });

  it("should warn about conflicting function signatures", function (done) {
    testutils.assertStderr(function(checkStderr) {
      var input = "#hello { greeting: hello(Chris); }\n";
      var options = {
        root: testutils.fixtureDirectory("function_modules"),
        data: input,
        functions: {
          "hello($name: 'Sucker')": function(name) {
            return sass.types.String("Goodbye, " + name.getValue() + "!");
          }
        }
      };
      var expectedOutput = "#hello {\n  greeting: Goodbye, Chris!; }\n";
      testutils.assertCompiles(options, expectedOutput, function() {
        checkStderr("WARNING: Function hello was redeclared with " +
                    "conflicting function signatures: hello($name: \"World\")" +
                    " vs. hello($name: 'Sucker')\n");
        done();
      });
    });
  });

 it("load functions from modules if they are themselves a npm eyeglass module.",
    function (done) {
      var options = {
        root: testutils.fixtureDirectory("is_a_module"),
        data: "#hello { greeting: hello(); }\n"
      };
      var expectedOutput = "#hello {\n  greeting: Hello, Myself!; }\n";
      testutils.assertCompiles(options, expectedOutput, done);
  });

  it("will always block and masquerade as an asynchronous function",
    function(done) {
      var input = "#hello { greeting: hello(); }\n";
      var expected = "#hello {\n  greeting: Hello, Myself!; }\n";
      var result = sass.renderSync(eyeglass({
        root: testutils.fixtureDirectory("is_a_module"),
        data: input
      }));
      assert.equal(expected, result.css);
      done();
  });

});
