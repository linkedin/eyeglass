"use strict";

var path = require("path");
var sass = require("node-sass");
var testutils = require("./testutils");
var Eyeglass = require("../lib");

describe("sass indented syntax", function (done) {
  var rootDir = testutils.fixtureDirectory("sass_indented_import");
  var expected = "body {\n" +
                 "  background: #FFF; }\n\n" +
                 "h1 {\n" +
                 "  font-family: Georgia; }\n";
  var options = {
    root: rootDir,
    engines: {
      sass: sass
    }
  };

  it("shouldn’t interfere with .scss partial", function (done) {
    var eg = new Eyeglass({
      file: path.join(rootDir, "scss", "main.scss"),
      eyeglass: options
    });

    testutils.assertCompiles(eg, expected, done);
  });


  it("shouldn’t interfere with .sass syntax partial", function (done) {
    var eg = new Eyeglass({
      file: path.join(rootDir, "sass", "main.sass"),
      eyeglass: options
    });

    testutils.assertCompiles(eg, expected, done);
  });

});
