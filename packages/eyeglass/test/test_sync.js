"use strict";

var path = require("path");
var testutils = require("./testutils");

describe("synchronous rendering", function () {
  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    let skipDartSass = sassName === "dart-sass" ? xit : it;
    describe(`with ${sassName}`, function () {
      skipDartSass("compiles basic file synchronously", function (done) {
        var pkg = require(path.resolve(__dirname, "../package.json"));
        var eyeglassVersion = pkg.version;
        var options = {
          eyeglass: { root: testutils.fixtureDirectory("function_modules") },
          data: "/* Eyeglass version is #{eyeglass-version()} */ .test { a: read('a'); }"
        };
        var expectedOutput = "/* Eyeglass version is " + eyeglassVersion + " */\n" +
          ".test {\n  a: 1;\n}\n";
          sassTestUtils.assertCompilesSync(options, expectedOutput, done);
        done();
      });
    });
  });
});
