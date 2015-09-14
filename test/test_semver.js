"use strict";

var assert = require("assert");
var testutils = require("./testutils");

var eyeglass = require("../lib").decorate;
var eyeglassSemverChecker = require("../lib/semver_checker");

describe("semver checking", function () {
  it("will not let a module through with an engine violation", function (done) {
    var options = {
      root: testutils.fixtureDirectory("bad_engine"),
      data: "#hello { greeting: hello(Chris); }"
    };

    testutils.assertStderr(function(check) {
      eyeglass(options);
      check();
    }, function(output) {
      var errored = (output.indexOf("incompatible with eyeglass") >= 0);
      assert.ok(errored, "Error was not logged to console");
      done();
    });
  });

  it("gives a nice error when missing eyeglass version dep", function (done) {
    var options = {
      root: testutils.fixtureDirectory("old_engine"),
      data: "#hello { greeting: hello(Chris); }"
    };

    testutils.assertStderr(function(check) {
      eyeglass(options);
      check("The following modules did not declare an eyeglass version:\n  module_a\n" +
            "Please add the following to the module's package.json:\n" +
            "  \"eyeglass\": { \"needs\": \"^" + eyeglassSemverChecker.eyeglassVersion + "\" }\n");
      done();
    });
  });


  it("will throw if strictModuleVersions is set", function (done) {
    var options = {
      root: testutils.fixtureDirectory("bad_engine"),
      data: "#hello { greeting: hello(Chris); }",
      strictModuleVersions: true
    };

    testutils.assertStderr(function(check) {
      var ex;
      try {
        eyeglass(options);
      } catch (e) {
        ex = e;
      }
      assert.ok(ex, "Exception thrown that stops eyeglass processing");
      check();
    }, function(output) {
      // no output check required
      done();
    });
  });
});
