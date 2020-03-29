"use strict";

var testutils = require("./testutils");
var Eyeglass = require("../lib");

describe("sass version function", function () {
  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    describe(`with ${sassName}`, function () {
      it("should return the eyeglass version", function (done) {
        var options = {
          data: "/* Eyeglass version is #{eyeglass-version()} */"
        };
        var expectedOutput = "/* Eyeglass version is " + Eyeglass.VERSION + " */\n";
        sassTestUtils.assertCompiles(options, expectedOutput, done);
      });

      it("should return a module's version", function (done) {
        var options = {
          eyeglass: { root: testutils.fixtureDirectory("basic_modules") },
          data: ".version {\nmodule-a: eyeglass-version('module_a')}"
        };
        var expectedOutput = ".version {\n  module-a: 1.0.1;\n}\n";
        sassTestUtils.assertCompiles(options, expectedOutput, done);
      });

      it("should handle asking for the version of an unknown module", function (done) {
        var options = {
          eyeglass: { root: testutils.fixtureDirectory("basic_modules") },
          data: ".ok { color: blue} .version {\nmodule-a: eyeglass-version('not_real_module')}"
        };
        var expectedOutput = ".ok {\n  color: blue;\n}\n";
        sassTestUtils.assertCompiles(options, expectedOutput, done);
      });
    });
  });
});
