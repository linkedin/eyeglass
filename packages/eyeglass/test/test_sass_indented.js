"use strict";

var path = require("path");
var testutils = require("./testutils");
var Eyeglass = require("../lib");

describe("sass indented syntax", function (done) {
  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    let skipNodeSass = sassName === "node-sass" ? xit : it;
    describe(`with ${sassName}`, function () {
      var rootDir = testutils.fixtureDirectory("sass_indented_import");
      var expected = "body {\n" +
        "  background: #FFF;\n}\n\n" +
        "h1 {\n" +
        "  font-family: Georgia;\n}\n";
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

        sassTestUtils.assertCompiles(eg, expected, done);
      });


      skipNodeSass("shouldn’t interfere with .sass syntax partial", function (done) {
        var eg = new Eyeglass({
          file: path.join(rootDir, "sass", "main.sass"),
          indentedSyntax: true,
          eyeglass: options
        });

        sassTestUtils.assertCompiles(eg, expected, done);
      });

    });
  });
});
