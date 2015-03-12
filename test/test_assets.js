"use strict";

var assert = require("assert");
var sass = require("node-sass");
var path = require("path");
var eyeglass = require("../lib");
var capture = require("../lib/util/capture");

function fixtureDirectory(subpath) {
  return path.join(__dirname, "fixtures", subpath);
}

describe("assets", function () {

 it("should create a url to an asset", function (done) {
    sass.render(eyeglass({
      data: "div { background-image: asset-url('foo.png'); }",
      success: function(result) {
        assert.equal("div {\n  background-image: url('foo.png'); }\n", result.css);
        done();
      }
    }));
 });

});
