"use strict";

var sass = require("node-sass");
var testutils = require("./testutils");

describe("function loading", function () {

  it("should discover sass functions", function (done) {
    console.log("1");
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
    console.log("2");
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
    console.log("3");
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
    console.log("4");
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
   console.log("5");
      var options = {
        root: testutils.fixtureDirectory("is_a_module"),
        data: "#hello { greeting: hello(); }\n"
      };
      var expectedOutput = "#hello {\n  greeting: Hello, Myself!; }\n";
      testutils.assertCompiles(options, expectedOutput, done);
  });
});
