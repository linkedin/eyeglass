"use strict";

var Deprecator = require("../lib/util/deprecator").Deprecator;
var Eyeglass = require("../");
var VERSION = Eyeglass.VERSION;
var assert = require("assert");
var testutils = require("./testutils");
var path = require("path");
var semver = require("semver");

describe("options", function() {
  beforeEach(function(done) {
    process.env.SASS_PATH = "";
    done();
  });

  it("should wrap options when not an instance", function(done) {
    var rootDir = testutils.fixtureDirectory("app_with_malformed_module");
    /* eslint new-cap:0 */
    var options = Eyeglass({
      eyeglass: {
        root: rootDir
      }
    });
    assert(options);
    assert(options.eyeglass.root);
    done();
  });

  it("should not contain a circular reference to itself", function(done) {
    var rootDir = testutils.fixtureDirectory("app_with_malformed_module");
    var options = {root: rootDir};
    var eyeglass = new Eyeglass(options);
    var sassopts = eyeglass.options;
    assert(sassopts.eyeglass);
    assert.notEqual(eyeglass, sassopts.eyeglass);
    done();
  });

  it("uses the SASS_PATH environment variable as a default for includePaths", function(done) {
    process.env.SASS_PATH = ["foo", "bar", "baz"].join(path.delimiter);

    var rootDir = testutils.fixtureDirectory("basic_modules");
    var options = {root: rootDir};
    var eyeglass = new Eyeglass(options);
    var sassopts = eyeglass.options;
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
    var sassopts = eyeglass.options;
    assert.equal(sassopts.includePaths.length, 0);
    done();
  });

  it("works with the indented syntax", function(done) {
    var rootDir = testutils.fixtureDirectory("basic_modules");
    var data = ".foo\n  bar: baz";
    var options = {root: rootDir, indentedSyntax: true, data: data};
    var eyeglass = new Eyeglass(options);
    var expectedOutput = ".foo {\n  bar: baz; }\n";

    testutils.assertCompiles(eyeglass.options, expectedOutput, done);
  });

  it("should normalize includePaths", function () {
    var includePaths = ["path/one", "path/two", "path/three"];
    var rootDir = testutils.fixtureDirectory("app_assets");
    var eyeglass = new Eyeglass({
      root: rootDir,
      includePaths: includePaths.join(path.delimiter)
    });
    var sassopts = eyeglass.options;
    assert(sassopts);
    assert.deepEqual(sassopts.includePaths, includePaths.map(function(p){
      return path.resolve(rootDir, p);
    }));
  });

  it("should disable deprecation warnings via an option", function(done) {
    testutils.assertStderr(function(checkStderr) {
      var rootDir = testutils.fixtureDirectory("basic_modules");
      var options = {
        root: rootDir,
        eyeglass: {
          ignoreDeprecations: "1.5.0"
        }
      };
      let deprecator = new Deprecator(options);
      deprecator.deprecate("1.4.0", "20.0.0", "testing deprecator");
      checkStderr("");
      done();
    });
  });

  it("should still get new deprecation warnings if ignoreDeprecations is set to an older version.", function(done) {
    testutils.assertStderr(function(checkStderr) {
      var rootDir = testutils.fixtureDirectory("basic_modules");
      var options = {
        root: rootDir,
        eyeglass: {
          ignoreDeprecations: "1.5.0"
        }
      };
      let deprecator = new Deprecator(options);
      deprecator.deprecate("2.0.0", "20.0.0", "this deprecation is expected");
      checkStderr("[eyeglass:deprecation] (deprecated in 2.0.0, will be removed in 20.0.0) this deprecation is expected\n");
      done();
    });
  });

  it("should get all deprecation warnings if ignoreDeprecations is set to false.", function(done) {
    testutils.assertStderr(function(checkStderr) {
      var rootDir = testutils.fixtureDirectory("basic_modules");
      var options = {
        root: rootDir,
        eyeglass: {
          ignoreDeprecations: false
        }
      };
      let deprecator = new Deprecator(options);
      deprecator.deprecate("0.0.1", "20.0.0", "this deprecation is expected");
      checkStderr("[eyeglass:deprecation] (deprecated in 0.0.1, will be removed in 20.0.0) this deprecation is expected\n");
      done();
    });
  });


  describe("deprecated interface", function() {

    it("should warn on eyeglass options not in namespace", function(done) {
      function expectedOptionsWarning(option) {
        return [
          "[eyeglass:deprecation] (deprecated in 0.8.0, will be removed in 0.9.0) `" +
          option + "` should be passed into the eyeglass options rather than the sass options:",
          "var options = eyeglass({",
          "  /* sassOptions */",
          "  ...",
          "  eyeglass: {",
          "    " + option + ": ...",
          "  }",
          "});"
        ].join("\n  ");
      }
      function expectedAssetOptionsWarning(originalName, newName) {
        return [
          "[eyeglass:deprecation] (deprecated in 0.8.0, will be removed in 0.9.0) `" +
          originalName + "` has been renamed to `" + newName + "` and should be passed " +
          "into the eyeglass asset options rather than the sass options:",
          "var options = eyeglass({",
          "  /* sassOptions */",
          "  ...",
          "  eyeglass: {",
          "    assets: {",
          "      " + newName + ": ...",
          "    }",
          "  }",
          "});"
        ].join("\n  ");
      }

      testutils.assertStderr(function(checkStderr) {
        var eyeglass = new Eyeglass({
          root: __dirname,
          cacheDir: ".cache",
          buildDir: "dist",
          httpRoot: "root",
          assetsHttpPrefix: "prefix",
          assetsRelativeTo: "relative",
          strictModuleVersions: true
        });
        checkStderr([
          expectedOptionsWarning("root"),
          expectedOptionsWarning("cacheDir"),
          expectedOptionsWarning("buildDir"),
          expectedOptionsWarning("httpRoot"),
          expectedOptionsWarning("strictModuleVersions"),
          expectedAssetOptionsWarning("assetsHttpPrefix", "httpPrefix"),
          expectedAssetOptionsWarning("assetsRelativeTo", "relativeTo")
        ].join("\n") + "\n");
        done();
      });
    });

    it("should warn when setting deprecated property directly on instance", function(done) {
      testutils.assertStderr(function(checkStderr) {
        var eyeglass = new Eyeglass();
        eyeglass.enableImportOnce = false;
        checkStderr([
          "[eyeglass:deprecation] (deprecated in 0.8.0, will be removed in 0.9.0) " +
          "The property `enableImportOnce` should no longer be set directly on eyeglass. " +
          "Instead, you should pass this as an option to eyeglass:",
          "  var options = eyeglass({",
          "    /* sassOptions */",
          "    ...",
          "    eyeglass: {",
          "      enableImportOnce: ...",
          "    }",
          "  });"
        ].join("\n") + "\n");
        done();
      });
    });

    it("should warn when getting deprecated property directly on instance", function(done) {
      testutils.assertStderr(function(checkStderr) {
        var eyeglass = new Eyeglass();
        var isEnabled = eyeglass.enableImportOnce;
        checkStderr([
          "[eyeglass:deprecation] (deprecated in 0.8.0, will be removed in 0.9.0) " +
          "The property `enableImportOnce` should no longer be accessed directly on eyeglass. " +
          "Instead, you'll find the value on `eyeglass.options.eyeglass.enableImportOnce`"
        ].join("\n") + "\n");
        done();
      });
    });

    it("should warn when passing sass engine as argument", function(done) {
      testutils.assertStderr(function(checkStderr) {
        var eyeglass = new Eyeglass({}, require("node-sass"));
        checkStderr([
          "[eyeglass:deprecation] (deprecated in 0.8.0, will be removed in 0.9.0) " +
          "You should no longer pass `sass` directly to Eyeglass. Instead pass it as an option:",
          "  var options = eyeglass({",
          "    /* sassOptions */",
          "    ...",
          "    eyeglass: {",
          "      engines: {",
          "        sass: require('node-sass')",
          "      }",
          "    }",
          "  });"
        ].join("\n") + "\n");
        done();
      });
    });
  });
});
