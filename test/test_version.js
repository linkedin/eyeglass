"use strict";

var path = require("path");
var fs = require("fs");
var testutils = require("./testutils");

describe("sass version function", function () {
 it("should return the eyeglass version", function (done) {
   var packageContents = fs.readFileSync(path.resolve(__dirname, "../package.json"));
   var eyeglassVersion = JSON.parse(packageContents).version;
   var options = {
     data: "/* Eyeglass version is #{eyeglass-version()} */"
   };
   var expectedOutput = "/* Eyeglass version is " + eyeglassVersion + " */\n";
   testutils.assertCompiles(options, expectedOutput, done);
 });

 it("should return a module's version", function (done) {
   var options = {
     root: testutils.fixtureDirectory("basic_modules"),
     data: ".version {\nmodule-a: eyeglass-version('module_a')}"
   };
   var expectedOutput = '.version {\n  module-a: "1.0.1"; }\n';
   testutils.assertCompiles(options, expectedOutput, done);
 });
});
