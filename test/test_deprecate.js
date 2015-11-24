"use strict";

var Deprecator = require("../lib/util/deprecator");
var testutils = require("./testutils");

describe("deprecate", function() {
  beforeEach(function(done) {
    process.env.EYEGLASS_DEPRECATIONS = "";
    done();
  });

  it("should log warning when no options set", function(done) {
    var deprecate = new Deprecator();
    testutils.assertStderr(function(checkStderr) {
      deprecate("0.0.1", "0.1.0", "deprecated message");

      checkStderr(
        "[eyeglass:deprecation] (deprecated in 0.0.1, will be removed in 0.1.0) " +
        "deprecated message\n"
      );
      done();
    });
  });

  it("should ignore warnings when version out of range", function(done) {
    var deprecate = new Deprecator({
      eyeglass: {
        ignoreDeprecations: "0.1.0"
      }
    });
    testutils.assertStderr(function(checkStderr) {
      deprecate("0.0.1", "0.1.0", "deprecated message");
      checkStderr("");
      done();
    });
  });

  it("should default to EYEGLASS_DEPRECATIONS environment var", function(done) {
    process.env.EYEGLASS_DEPRECATIONS = "0.1.0";
    var deprecate = new Deprecator();
    testutils.assertStderr(function(checkStderr) {
      deprecate("0.0.1", "0.1.0", "deprecated message");
      checkStderr("");
      done();
    });
  });

  it("should check EYEGLASS_DEPRECATIONS environment var each run", function(done) {
    var deprecate = new Deprecator();
    testutils.assertStderr(function(checkStderr) {
      deprecate("0.0.1", "0.1.0", "deprecated message 1");
      process.env.EYEGLASS_DEPRECATIONS = "0.1.0";
      deprecate("0.0.1", "0.1.0", "deprecated message 2");
      checkStderr(
        "[eyeglass:deprecation] (deprecated in 0.0.1, will be removed in 0.1.0) " +
        "deprecated message 1\n"
      );
      done();
    });
  });
});
