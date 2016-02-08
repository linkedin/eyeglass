"use strict";

var EyeglassModules = require("../lib/util/eyeglass_modules");
var fs = require("fs");
var path = require("path");
var glob = require("glob");
var assert = require("assert");

var fixtureDir = path.join(__dirname, "fixtures/EyeglassModules");
var fixtures = glob.sync(path.join(fixtureDir, "*"));

var TESTS = {
  // tests that the graph is accurate
  graph: function(modules, err, expected) {
    assert.ok(!err);
    assert.ok(modules);
    // get the module graph, stripping off the local eyeglass version
    var graph = modules.getGraph().replace(/(\seyeglass)(?:@\S+)?/g, "$1");
    assert.equal(graph, expected);
  },
  issues: function(modules, err, expected) {
    assert.ok(!err);
    assert.ok(modules);
    assertSubset(JSON.parse(expected), modules.issues);
  },
  error: function(modules, err, expected) {
    assert.ok(err);
    assert.ok(!modules);
    assert.equal(JSON.parse(expected).error, err.toString());
  }
};

function assertSubset(obj1, obj2) {
  if (typeof obj1 === "object") {
    Object.keys(obj1).forEach(function(key) {
      assert(obj2);
      assertSubset(obj1[key], obj2[key]);
    });
  } else {
    assert.deepEqual(obj1, obj2);
  }
}

describe("EyeglassModules", function () {
  fixtures.forEach(function(testDir) {
    var testName = path.basename(testDir);
    it(testName, function() {
      var modules;
      var err;

      try {
        modules = new EyeglassModules(testDir);
      } catch (e) {
        err = e;
      }

      var expectations = glob.sync(path.join(testDir, "expected.*"));
      expectations.forEach(function(expectationFile) {
        var testType = path.extname(expectationFile).replace(/^\./, "");
        var expectationFn = TESTS[testType];
        var expectationContents = fs.readFileSync(expectationFile).toString();
        expectationFn(modules, err, expectationContents);
      });
    });
  });

  it("should find a module given a path", function() {
    var modules = new EyeglassModules(path.join(fixtureDir, "has_modules"));
    var moduleB = modules.find("module_b");
    var moduleBPrime = modules.findByPath(moduleB.path);
    assert.deepEqual(moduleB, moduleBPrime);
  });
});
