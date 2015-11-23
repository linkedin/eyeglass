"use strict";

var Eyeglass = require("../lib").Eyeglass;
var assert = require("assert");
var testutils = require("./testutils");
var path = require("path");

describe("options", function() {
  beforeEach(function(done) {
    process.env.SASS_PATH = "";
    done();
  });

  it("should not contain a circular reference to itself", function(done) {
    var rootDir = testutils.fixtureDirectory("app_with_malformed_module");
    var options = {root: rootDir};
    var eyeglass = new Eyeglass(options);
    var sassopts = eyeglass.sassOptions();
    assert(sassopts.eyeglass);
    assert.notEqual(eyeglass, sassopts.eyeglass);
    done();
  });

  it("uses the SASS_PATH environment variable as a default for includePaths", function(done) {
    process.env.SASS_PATH = "foo:bar:baz";

    var rootDir = testutils.fixtureDirectory("basic_modules");
    var options = {root: rootDir};
    var eyeglass = new Eyeglass(options);
    var sassopts = eyeglass.sassOptions();
    assert.equal(sassopts.includePaths[0], path.resolve(process.cwd(), "foo"));
    assert.equal(sassopts.includePaths[1], path.resolve(process.cwd(), "bar"));
    assert.equal(sassopts.includePaths[2], path.resolve(process.cwd(), "baz"));
    done();
  });

  it("defaults includePaths to empty array", function(done) {
    assert.equal(process.env.SASS_PATH, "");
    var rootDir = testutils.fixtureDirectory("basic_modules");
    var options = {root: rootDir};
    var eyeglass = new Eyeglass(options);
    var sassopts = eyeglass.sassOptions();
    assert.equal(sassopts.includePaths.length, 0);
    done();
  });

  it("works with the indented syntax", function(done) {
    var rootDir = testutils.fixtureDirectory("basic_modules");
    var data = ".foo\n  bar: baz";
    var options = {root: rootDir, indentedSyntax: true, data: data};
    var eyeglass = new Eyeglass(options);
    var expectedOutput = ".foo {\n  bar: baz; }\n";

    testutils.assertCompiles(eyeglass.sassOptions(), expectedOutput, done);
  });

  it("should normalize includePaths", function () {
    var includePaths = ["path/one", "path/two", "path/three"];
    var rootDir = testutils.fixtureDirectory("app_assets");
    var eyeglass = new Eyeglass({
      root: rootDir,
      includePaths: includePaths.join(":")
    });
    var sassopts = eyeglass.sassOptions();
    assert(sassopts);
    assert.deepEqual(sassopts.includePaths, includePaths.map(function(p){
      return path.resolve(rootDir, p);
    }));
  });
});
