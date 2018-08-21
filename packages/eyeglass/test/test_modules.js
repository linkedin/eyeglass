"use strict";

var EyeglassModules = require("../lib/modules/EyeglassModules");
var fs = require("fs");
var path = require("path");
var glob = require("glob");
var assert = require("assert");
var testutils = require("./testutils");

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

  it("handles symlinked node modules", function(done) {
    var fixtureDir = path.join(__dirname, "fixtures", "symlinked_modules");
    var symlinkPath = path.join(fixtureDir, "project", "node_modules", "mymodule");
    var modulePath = path.join(fixtureDir, "mymodule");
    fs.symlinkSync(modulePath, symlinkPath, "dir");

    var opts = {
      data: '@import "mymodule"; @import "shared_dep";',
      eyeglass: {
        root: path.join(fixtureDir, "project")
      }
    };

    var expected = ".shared {\n" +
                   "  float: upside-down;\n" +
                   "  version: 1.2.0; }\n" +
                   "\n" +
                   ".mymodule {\n" +
                   "  color: red; }\n";

    testutils.assertCompiles(opts, expected, function() {
      fs.unlinkSync(symlinkPath);
      done();
    });

  });

  it("throws when an invalid module path is provided", function(done) {
    var rootDir = testutils.fixtureDirectory("simple_module");
    var invalidPath = testutils.fixtureDirectory("does_not_exist");
    var expectedError = "Could not find a valid package.json at " + invalidPath;
    var options = {
      data: "// should not compile",
      eyeglass: {
        root: rootDir,
        modules: [{
          path: invalidPath
        }]
      }
    };
    testutils.assertCompilationError(options, expectedError, done);
  });
});
