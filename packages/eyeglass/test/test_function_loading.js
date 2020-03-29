"use strict";

var testutils = require("./testutils");


describe("function loading", function () {
  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    describe(`with ${sassName}`, function () {
      let nodeOnly = sassName === "node-sass" ? it : it.skip;
      it("should discover sass functions", function (done) {
        var options = {
          data: "#hello { greeting: hello(Chris); }\n" +
            "#transitive { is: transitive(); }\n",
          eyeglass: {
            root: testutils.fixtureDirectory("function_modules")
          }
        };
        var expected = "#hello {\n  greeting: Hello, Chris!;\n}\n\n" +
          "#transitive {\n  is: transitive;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should include devDependencies in its list", function (done) {
        var options = {
          data: "#hello { greeting: hellob(Chris); }\n",
          eyeglass: {
            root: testutils.fixtureDirectory("function_modules")
          }
        };
        var expected = "#hello {\n  greeting: Hello, Chris!;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should let me define my own sass functions too", function (done) {
        var input = "#hello { greeting: hello(Chris); }\n" +
          "#mine { something: add-one(3em); }\n";
        var options = {
          data: input,
          functions: {
            "add-one($number)": function (number) {
              return new sass.types.Number(number.getValue() + 1, number.getUnit());
            }
          },
          eyeglass: {
            root: testutils.fixtureDirectory("function_modules")
          }
        };
        var expected = "#hello {\n  greeting: Hello, Chris!;\n}\n\n" +
          "#mine {\n  something: 4em;\n}\n";
          sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should let local functions override imported functions", function (done) {
        testutils.assertStdout(function (checkOutput) {
          var input = "#hello { greeting: hello(Chris); }\n";
          var expectedOutput = "#hello {\n  greeting: Goodbye, Chris!;\n}\n";
          var options = {
            data: input,
            functions: {
              "hello($name: \"World\")": function (name) {
                return new sass.types.String("Goodbye, " + name.getValue() + "!");
              }
            },
            eyeglass: {
              root: testutils.fixtureDirectory("function_modules")
            }
          };
          sassTestUtils.assertCompiles(options, expectedOutput, function () {
            checkOutput("");
            done();
          });
        });
      });

      it("should warn about conflicting function signatures", function (done) {
        testutils.assertStderr(function (checkStderr) {
          var input = "#hello { greeting: hello(Chris); }\n";
          var options = {
            data: input,
            functions: {
              "hello($name: 'Sucker')": function (name) {
                return new sass.types.String("Goodbye, " + name.getValue() + "!");
              }
            },
            eyeglass: {
              root: testutils.fixtureDirectory("function_modules")
            }
          };
          var expectedOutput = "#hello {\n  greeting: Goodbye, Chris!;\n}\n";
          sassTestUtils.assertCompiles(options, expectedOutput, function () {
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
            data: "#hello { greeting: hello(); }\n",
            eyeglass: {
              root: testutils.fixtureDirectory("is_a_module")
            }
          };
          var expectedOutput = "#hello {\n  greeting: Hello, Myself!;\n}\n";
          sassTestUtils.assertCompiles(options, expectedOutput, done);
        });

      nodeOnly("will always block and masquerade as an asynchronous function",
        function (done) {
          var input = "#hello { greeting: hello(); }\n";
          var expected = "#hello {\n  greeting: Hello, Myself!;\n}\n";
          sassTestUtils.assertCompilesSync({
            data: input,
            eyeglass: {
              root: testutils.fixtureDirectory("is_a_module")
            }
          }, expected)
          done();
        });

      it("unversioned modules should return `unversioned` from `eyeglass-version()`",
        function (done) {
          var options = {
            data: "/* #{eyeglass-version(is-a-module)} */\n",
            eyeglass: {
              root: testutils.fixtureDirectory("is_a_module")
            }
          };
          var expectedOutput = "/* unversioned */\n";
          sassTestUtils.assertCompiles(options, expectedOutput, done);
        });
    });
  });
});