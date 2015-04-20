"use strict";

var path = require("path");
var fs = require("fs");
var testutils = require("./testutils");

describe("synchronous rendering", function () {
 it("compiles basic file synchronously", function (done) {
   var eyeglassVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"))).version;
   var options = {
     data: "/* Eyeglass version is #{eyeglass-version()} */"
   };
   var expectedOutput = "/* Eyeglass version is \"" + eyeglassVersion + "\" */\n";
   testutils.assertCompilesSync(options, expectedOutput, done);
   done();
 });
});
