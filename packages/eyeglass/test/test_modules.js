"use strict";

var EyeglassModules = require("../lib/modules/EyeglassModules").default;
var fs = require("fs");
var path = require("path");
var glob = require("glob");
var assert = require("assert");
var testutils = require("./testutils");
const DEFAULT_EYEGLASS_COMPAT = require("../lib/util/Options").DEFAULT_EYEGLASS_COMPAT;

var fixtureDir = path.join(__dirname, "fixtures/EyeglassModules");
var fixtures = glob.sync(path.join(fixtureDir, "*"));

var TESTS = {
  // tests that the graph is accurate
  graph: function(modules, err, expected) {
    assert.ok(!err, err ? err.toString() : "");
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
  function testFixture(testDir, config, modules) {
    var modules;
    var err;
    config = config || {};
    config.eyeglass = config.eyeglass || {};
    if (typeof config.eyeglass.assertEyeglassCompatibility === "undefined") {
      config.eyeglass.assertEyeglassCompatibility = DEFAULT_EYEGLASS_COMPAT;
    }
    try {
      modules = new EyeglassModules(testDir, config, modules);
    } catch (e) {
      err = e;
    }

    var expectations = glob.sync(path.join(testDir, "expected.*"));
    expectations.forEach(function (expectationFile) {
      var testType = path.extname(expectationFile).replace(/^\./, "");
      var expectationFn = TESTS[testType];
      var expectationContents = fs.readFileSync(expectationFile).toString();
      expectationFn(modules, err, expectationContents);
    });
  }

  fixtures.forEach(function(testDir) {
    var testName = path.basename(testDir);
    it(testName, function() {
      testFixture(testDir);
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
    testutils.assertStderr(function(checkStderr) {
      checkStderr("");
      testutils.assertCompilationError(options, expectedError, done);
    });
  });
  it("ignores a manual dependency already in the tree", function() {
    var rootDir = testutils.fixtureDirectory("EyeglassModules/has_conflicting_versions");
    var depInTree =
      testutils.fixtureDirectory("EyeglassModules/has_conflicting_versions/node_modules/module_a/node_modules/module_b");
    var modules = [ {path: depInTree} ];
    testFixture(
      rootDir,
      {
        eyeglass: {
          modules: modules
        }
      },
      modules
    );
  });
});
