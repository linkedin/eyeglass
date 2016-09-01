"use strict";

var assert = require("assert");
var unquote = require("../lib/util/strings").unquote;
var sync = require("../lib/util/sync");
var sass = require("node-sass");
var testutils = require("./testutils");
var EyeglassModules = require("../lib/modules/EyeglassModules");

describe("utilities", function () {

 it("unquote handles js strings", function(done) {
   assert.equal("asdf", unquote('"asdf"'));
   assert.equal("asdf", unquote("'asdf'"));
   assert.equal("\"asdf'", unquote("\"asdf'"));
   assert.equal("'asdf\"", unquote("'asdf\""));
   assert.equal("asdf", unquote("asdf"));
   done();
 });

 it("unquote handles sass strings", function(done) {
   var s = sass.types.String;
   assert.equal("asdf", unquote(s('"asdf"')).getValue());
   assert.equal("asdf", unquote(s("'asdf'")).getValue());
   assert.equal("\"asdf'", unquote(s("\"asdf'")).getValue());
   assert.equal("'asdf\"", unquote(s("'asdf\"")).getValue());
   assert.equal("asdf", unquote(s("asdf")).getValue());
   done();
 });

 it("provides a collection of errors if it cannot find" +
    " shared semantic versions in modules", function() {
   var dir = testutils.fixtureDirectory("conflicting_modules");
   var versionIssues = new EyeglassModules(dir).issues.dependencies.versions;

   assert(versionIssues.length, "discovery found errors");
   assert.equal(versionIssues[0].name, "conflict_module");
   assert.notEqual(versionIssues[0].left.version, versionIssues[0].right.version);
 });

 it("loads a package.json for an eyeglass module", function(done) {
    var dir = testutils.fixtureDirectory("is_a_module");
    var eyeglass = {};
    var modules = new EyeglassModules(dir);
    var egModule = modules.find("is-a-module");
    egModule.init(eyeglass, sass);
    assert(egModule);
    assert.equal(egModule.sassDir, dir);
    assert(egModule.functions);
    done();
 });

 it("populates the eyeglass name for a module into the module definition", function(done) {
    var dir = testutils.fixtureDirectory("is_a_module");
    var modules = new EyeglassModules(dir);
    var egModule = modules.find("is-a-module");
    assert(egModule);
    assert.equal(egModule.rawName, "is_a_module");
    assert.equal(egModule.name, "is-a-module");
    done();
 });

 it("can convert an async function into a synchronous behavior", function() {
   var expected = "the-result";
   function asyncFunction(cb) {
     process.nextTick(function() {
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
});
