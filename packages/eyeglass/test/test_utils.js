"use strict";

var assert = require("assert");
var proxyquire = require('proxyquire');
var stringUtils = require("../lib/util/strings");
var unquote = stringUtils.unquote;
var unquoteJS = stringUtils.unquoteJS;
var sync = require("../lib/util/sync").default;
var sass = require("node-sass");
var testutils = require("./testutils");
var EyeglassModules = require("../lib/modules/EyeglassModules").default;
var Eyeglass = require("../lib");
var DEFAULT_EYEGLASS_COMPAT = require("../lib/util/Options").DEFAULT_EYEGLASS_COMPAT;

describe("utilities", function () {
  it("unquote handles js strings", function (done) {
    assert.equal("asdf", unquoteJS(sass, '"asdf"'));
    assert.equal("asdf", unquoteJS(sass, "'asdf'"));
    assert.equal("\"asdf'", unquoteJS(sass, "\"asdf'"));
    assert.equal("'asdf\"", unquoteJS(sass, "'asdf\""));
    assert.equal("asdf", unquoteJS(sass, "asdf"));
    done();
  });

  it("unquote handles sass strings", function (done) {
    var s = sass.types.String;
    assert.equal("asdf", unquote(sass, s('"asdf"')).getValue());
    assert.equal("asdf", unquote(sass, s("'asdf'")).getValue());
    assert.equal("\"asdf'", unquote(sass, s("\"asdf'")).getValue());
    assert.equal("'asdf\"", unquote(sass, s("'asdf\"")).getValue());
    assert.equal("asdf", unquote(sass, s("asdf")).getValue());
    done();
  });

  it("provides a collection of errors if it cannot find" +
    " shared semantic versions in modules", function () {
      var dir = testutils.fixtureDirectory("conflicting_modules");
      var config = {eyeglass: {assertEyeglassCompatibility: DEFAULT_EYEGLASS_COMPAT}};
      var versionIssues = new EyeglassModules(dir, config).issues.dependencies.versions;

      assert(versionIssues.length, "discovery found errors");
      assert.equal(versionIssues[0].name, "conflict_module");
      assert.notEqual(versionIssues[0].requested.version, versionIssues[0].resolved.version);
    });

  it("loads a package.json for an eyeglass module", function (done) {
    var dir = testutils.fixtureDirectory("is_a_module");
    var eyeglass = {};
    var config = {eyeglass: {assertEyeglassCompatibility: DEFAULT_EYEGLASS_COMPAT }};
    var modules = new EyeglassModules(dir, config);
    var egModule = modules.find("is-a-module");
    egModule.init(eyeglass, sass);
    assert(egModule);
    assert.equal(egModule.sassDir, dir);
    assert(egModule.functions);
    done();
  });

  it("populates the eyeglass name for a module into the module definition", function (done) {
    var dir = testutils.fixtureDirectory("is_a_module");
    var config = {eyeglass: {assertEyeglassCompatibility: DEFAULT_EYEGLASS_COMPAT }};
    var modules = new EyeglassModules(dir, config);
    var egModule = modules.find("is-a-module");
    assert(egModule);
    assert.equal(egModule.rawName, "is_a_module");
    assert.equal(egModule.name, "is-a-module");
    done();
  });

  it("can convert an async function into a synchronous behavior", function () {
    var expected = "the-result";
    function asyncFunction(cb) {
      process.nextTick(function () {
        cb(expected);
      });
    }

    function syncFunction() {
      return expected;
    }

    var syncFnA = sync(asyncFunction);
    var resultA = syncFnA();
    var syncFnB = sync(syncFunction);
    var resultB = syncFnB();
    assert.equal(resultA, expected, "handles async functions with callbacks");
    assert.equal(resultB, expected, "handles sync functions without callbacks");
  });

  it("should throw when async function is tried to turn synchronous without having deasync installed", function(done) {
    var syncWithoutDeasync = proxyquire("../lib/util/sync", { deasync: null }).default;

    function asyncFunction(cb) {
      process.nextTick(function () {
        cb('hello');
      });
    }

    try {
      var syncFnA = syncWithoutDeasync(asyncFunction);
      var resultA = syncFnA();
    } catch(ex) {
      assert.equal(ex.message, 'deasync is required to make async functions synchronous');

      done();
    }
  });

  it("quote handles Sass strings", function (done) {
    assert.equal('"asdf"', stringUtils.quoteSass(sass, sass.types.String("asdf")).getValue());
    done();
  });

  it("tmpl should preserve placeholders if not in data", function (done) {
    var tmpl = "${foo} ${bar}";
    var result = stringUtils.tmpl(sass, tmpl, {}); // no data
    assert.equal(tmpl, result);
    done();
  });
  describe("Sass Helpers", () => {
    const they = it;
    const helpers = Eyeglass.helpers(sass);
    they("have a type guard for null", () => {
      assert.ok(helpers.isNull(sass.NULL));
      assert.ok(!helpers.isNull(null));
    });
    they("have a type guard for booleans", () => {
      assert(helpers.isBoolean(sass.TRUE));
      assert(helpers.isBoolean(sass.FALSE));
      assert(!helpers.isBoolean(sass.NULL));
    });
    they("have a type guard for colors", () => {
      assert(helpers.isColor(sass.types.Color(0x000000FF)));
      assert(!helpers.isColor(sass.NULL));
    });

    they("have a type guard for numbers", () => {
      assert(helpers.isNumber(sass.types.Number(5, "px")));
      assert(!helpers.isNumber(sass.NULL));
    });
    they("have a type guard for maps", () => {
      assert(helpers.isMap(sass.types.Map(0)));
      assert(!helpers.isMap(sass.types.List(0)));
    });
    they("have a type guard for maps and empty lists", () => {
      assert(helpers.isMapOrEmptyList(sass.types.Map(0)));
      assert(helpers.isMapOrEmptyList(sass.types.List(0)));
      assert(!helpers.isMapOrEmptyList(sass.types.List(1)));
    });
    they("have a type guard for list", () => {
      assert(helpers.isList(sass.types.List(0)));
      assert(!helpers.isList(sass.types.Map(0)));
    });
    they("have a type guard for errors", () => {
      assert(helpers.isError(sass.types.Error("wtf")));
      assert(!helpers.isError(sass.NULL));
    });
  });
});
