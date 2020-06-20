"use strict";

var assert = require("assert");
var testutils = require("./testutils");

var eyeglass = require("../lib");

describe("semver checking", function () {
  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    describe(`with ${sassName}`, function () {
      it("will not let a module through with an engine violation", function (done) {
        var options = {
          data: "#hello { greeting: hello(Chris);\n}",
          eyeglass: {
            root: testutils.fixtureDirectory("bad_engine")
          }
        };

        testutils.assertStderr(function (check) {
          eyeglass(options);
          check();
        }, function (output) {
          var errored = (output.indexOf("incompatible with eyeglass") >= 0);
          assert.ok(errored, "Error was not logged to console");
          done();
        });
      });

      it("gives a nice error when missing eyeglass version dep", function (done) {
        var options = {
          data: "#hello { greeting: hello(Chris); }",
          eyeglass: {
            root: testutils.fixtureDirectory("old_engine")
          }
        };

        testutils.assertStderr(function (check) {
          eyeglass(options);
          check("The following modules did not declare an eyeglass version:\n  module_a\n" +
            "Please add the following to the module's package.json:\n" +
            "  \"eyeglass\": { \"needs\": \"^" + eyeglass.VERSION + "\" }\n");
          done();
        });
      });


      it("will throw if strictModuleVersions is set", function (done) {
        var options = {
          data: "#hello { greeting: hello(Chris); }",
          eyeglass: {
            root: testutils.fixtureDirectory("bad_engine"),
            strictModuleVersions: true
          }
        };

        testutils.assertStderr(function (check) {
          var ex;
          try {
            eyeglass(options);
          } catch (e) {
            ex = e;
          }
          assert.ok(ex, "Exception thrown that stops eyeglass processing");
          check();
        }, function (output) {
          // no output check required
          done();
        });
      });

      it("should be silent if strictModuleVersions is disabled (false)", function (done) {
        var options = {
          data: "#hello { greeting: hello(Chris); }",
          eyeglass: {
            root: testutils.fixtureDirectory("bad_engine"),
            strictModuleVersions: false
          }
        };

        sassTestUtils.assertCompiles(options, "#hello {\n  greeting: hello(Chris);\n}\n", done);
      });
      it("gives an error if a module needs eyeglass 3.x", function (done) {
        var options = {
          data: "#hello { greeting: hello(Chris); }",
          eyeglass: {
            modules: [
              { path: testutils.fixtureDirectory("built_for_eyeglass_v4") }
            ],
          }
        };
        testutils.assertStderr(function (check) {
          eyeglass(options);
          check();
        }, function (output) {
          var errored = (output.indexOf("incompatible with eyeglass") >= 0);
          assert.ok(errored, "Error was not logged to console");
          done();
        });

      });
      it("should be automatically compatible between eyeglass v2 and v1 addons", function (done) {
        var options = {
          data: '@import "older-module";',
          eyeglass: {
            modules: [
              { path: testutils.fixtureDirectory("built_for_eyeglass_v1") }
            ],
          }
        };

        sassTestUtils.assertCompiles(options, ".hello {\n  content: \"World\" !important;\n}\n", done);
      });
    });
  });
});
