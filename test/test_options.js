"use strict";

var Eyeglass = require("../lib").Eyeglass;
var assert = require("assert");
var testutils = require("./testutils");

describe("options", function() {
  beforeEach(function(done) {
    process.env.SASS_PATH = "";
    done();
  });

  it("has no circular references in eyeglass options", function(done) {
    var rootDir = testutils.fixtureDirectory("app_with_malformed_module");
    var options = {root: rootDir};
    var eyeglass = new Eyeglass(options);
    var sassopts = eyeglass.sassOptions();
    assert.equal(eyeglass, sassopts.eyeglass);
    assert.equal(sassopts.eyeglass.options.eyeglass, undefined);
    done();
  });

  it("uses the SASS_PATH environment variable as a default for includePaths", function(done) {
    process.env.SASS_PATH = "foo:bar:baz";

    var rootDir = testutils.fixtureDirectory("basic_modules");
    var options = {root: rootDir};
    var eyeglass = new Eyeglass(options);
    var sassopts = eyeglass.sassOptions();
    assert.equal(sassopts.includePaths[0], "foo");
    assert.equal(sassopts.includePaths[1], "bar");
    assert.equal(sassopts.includePaths[2], "baz");
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
    var eyeglass = new Eyeglass({
      includePaths: includePaths.join(":")
    });
    var sassopts = eyeglass.sassOptions();
    assert(sassopts);
    assert.deepEqual(sassopts.includePaths, includePaths);
  });
});
