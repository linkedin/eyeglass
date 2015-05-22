"use strict";

var path = require("path");
var fs = require("fs");
var testutils = require("./testutils");

describe("synchronous rendering", function () {
 it("compiles basic file synchronously", function (done) {
   var packageContents = fs.readFileSync(path.resolve(__dirname, "../package.json"));
   var eyeglassVersion = JSON.parse(packageContents).version;
   var options = {
     root: testutils.fixtureDirectory("function_modules"),
     data: "/* Eyeglass version is #{eyeglass-version()} */ .test { a: read('a'); }"
   };
   var expectedOutput = "/* Eyeglass version is " + eyeglassVersion + " */\n" +
                        ".test {\n  a: 1; }\n";
   testutils.assertCompilesSync(options, expectedOutput, done);
   done();
 });
});
