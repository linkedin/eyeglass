"use strict";

var Eyeglass = require("../lib");
var testutils = require("./testutils");
var path = require("path");
var assert = require("assert");

describe("core api", function () {
  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    describe(`with ${sassName}`, function () {
      it("should compile a sass file", function (done) {
        var options = {
          data: "div { $c: red; color: $c; }"
        };
        var expected = "div {\n  color: red;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should compile a sass file if includePaths" +
        " was not passed as an option & not needed", function (done) {
          var expected = ".foo {\n" +
            "  color: red;\n}\n";
          var rootDir = testutils.fixtureDirectory("app_assets");
          var eg = new Eyeglass({
            file: path.join(rootDir, "sass", "no_includePaths.scss"),
            eyeglass: {
              root: rootDir,
              engines: {
                sass: sass
              }
            }
          });

          sassTestUtils.assertCompiles(eg, expected, done);
        });

      it("should compile a sass file honoring includePaths", function (done) {
        var expected = ".foo {\n" +
          "  color: #112358;\n}\n";
        var rootDir = testutils.fixtureDirectory("app_assets");
        var eg = new Eyeglass({
          includePaths: [
            "this-folder-does-not-exist",
            "../includable_scss",
            "this-does-not-exist-either"
          ],
          file: path.join(rootDir, "sass", "uses_includePaths.scss"),
          eyeglass: {
            root: rootDir,
            engines: {
              sass: sass
            }
          }
        });

        sassTestUtils.assertCompiles(eg, expected, done);
      });

      it("should be able to @import \"folder/file\" from a dir in includePaths", function (done) {
        var expected = ".bar {\n" +
          "  color: #333;\n}\n";
        var rootDir = testutils.fixtureDirectory("app_assets");
        var eg = new Eyeglass({
          includePaths: ["../includable_scss"],
          file: path.join(rootDir, "sass", "advanced_includePaths.scss"),
          eyeglass: {
            root: rootDir,
            engines: {
              sass: sass
            }
          }
        });

        sassTestUtils.assertCompiles(eg, expected, done);
      });

      it("should be able to @import a sass file with a dots in" +
        " its directory name and file name", function (done) {
          var expected = ".bat-noise {\n" +
            "  color: #eee;\n}\n";
          var rootDir = testutils.fixtureDirectory("app_assets");
          var eg = new Eyeglass({
            includePaths: ["../includable_scss"],
            file: path.join(rootDir, "sass", "dot_include.scss"),
            eyeglass: {
              root: rootDir,
              engines: {
                sass: sass
              }
            }
          });

          sassTestUtils.assertCompiles(eg, expected, done);
        });

      it("should compile a sass file with a custom function", function (done) {
        var options = {
          data: "div { content: hello-world(); }",
          functions: {
            "hello-world()": function () {
              return new sass.types.String('"Hello World!"');
            }
          }
        };
        var expected = 'div {\n  content: "Hello World!";\n}\n';
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should compile a sass file with a custom async function", function (done) {
        var options = {
          data: "div { content: hello-world(); }",
          functions: {
            "hello-world()": function (sassCb) {
              setTimeout(function () {
                sassCb(new sass.types.String('"Hello World!"'));
              });
            }
          }
        };
        var expected = 'div {\n  content: "Hello World!";\n}\n';
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("passes through node-sass options", function (done) {
        var options = {
          data: "div { content: hello-world(); }",
          functions: {
            "hello-world()": function () {
              return new sass.types.String('"Hello World!"');
            }
          }
        };
        var expected = 'div {\n  content: "Hello World!";\n}\n';
        sassTestUtils.assertCompiles(options, expected, done);
      });
    });
  });
});

describe("eyeglass importer", function () {

  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    describe(`with ${sassName}`, function () {
      beforeEach(() => {
        Eyeglass.resetGlobalCaches();
      });
      it("lets you import sass files from npm modules", function (done) {
        var options = {
          data: '@import "module_a";',
          eyeglass: {
            root: testutils.fixtureDirectory("basic_modules")
          }
        };
        var expected = ".module-a {\n  greeting: hello world;\n}\n\n" +
          ".sibling-in-module-a {\n  sibling: yes;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("lets you import sass files from dev and peer dependencies", function (done) {
        var options = {
          data: '@import "module_a"; @import "module_peer"; @import "module_b";',
          eyeglass: {
            root: testutils.fixtureDirectory("dev_peer_deps")
          }
        };
        var expected = ".module-a {\n  greeting: hello world;\n}\n\n" +
          ".sibling-in-module-a {\n  sibling: yes;\n}\n\n" +
          "/* module_peer */\n/* module_b */\n/* module_peer/foo */\n";
          sassTestUtils.assertCompiles(options, expected, done);
      });

      it("lets you import from a subdir in a npm module", function (done) {
        var options = {
          data: '@import "module_a/submodule";',
          eyeglass: {
            root: testutils.fixtureDirectory("basic_modules")
          }
        };
        var expected = ".submodule {\n  hello: world;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("lets you import explicitly from a subdir in a module", function (done) {
        var options = {
          data: '@import "module_a/submodule/_index.scss";',
          eyeglass: {
            root: testutils.fixtureDirectory("basic_modules")
          }
        };
        var expected = ".submodule {\n  hello: world;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("lets you import css files", function (done) {
        var options = {
          data: '@import "module_a/css_file";',
          eyeglass: {
            root: testutils.fixtureDirectory("basic_modules")
          }
        };
        var expected = ".css-file {\n  hello: world;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("lets you import sass files from a transitive dependency", function (done) {
        var options = {
          data: '@import "module_a/transitive_imports";',
          eyeglass: {
            root: testutils.fixtureDirectory("basic_modules")
          }
        };
        var expected = ".transitive_module {\n  hello: world;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("lets you import transitive sass files when strict module checks are disabled", function (done) {
        var options = {
          file: "wubwubwub.scss",
          data: '@import "transitive_module";',
          eyeglass: {
            disableStrictDependencyCheck: true,
            root: testutils.fixtureDirectory("basic_modules")
          }
        };
        var expected = ".transitive_module {\n  hello: world;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("does not let you import transitive sass files", function (done) {
        testutils.assertStderr(function (checkStderr) {
          var options = {
            file: "wubwubwub.scss",
            data: '@import "transitive_module";',
            eyeglass: {
              root: testutils.fixtureDirectory("basic_modules")
            }
          };
          // TODO This should not be a successful compile (libsass issue?)
          // TODO Shouldn't the file path be relative to `options.root`?
          var basic_modules = testutils.fixtureDirectory("basic_modules");
          var expectedError = `Could not import transitive_module from ${path.resolve("wubwubwub.scss")}: \`transitive_module\` was not found in any of the following locations:
  ${basic_modules}/_transitive_module.scss
  ${basic_modules}/transitive_module/_index.scss
  ${basic_modules}/transitive_module.scss
  ${basic_modules}/transitive_module/index.scss
  ${basic_modules}/transitive_module.sass
  ${basic_modules}/transitive_module.css
  ${basic_modules}/_transitive_module.sass
  ${basic_modules}/_transitive_module.css
  ${basic_modules}/transitive_module/index.sass
  ${basic_modules}/transitive_module/index.css
  ${basic_modules}/transitive_module/_index.sass
  ${basic_modules}/transitive_module/_index.css`;

sassTestUtils.assertCompilationError(options, {message: expectedError}, done);
        });
      });

      it("only imports a module dependency once.", function (done) {
        var options = {
          data: '@import "module_a"; @import "module_a";',
          eyeglass: {
            root: testutils.fixtureDirectory("basic_modules")
          }
        };
        var expected = ".module-a {\n  greeting: hello world;\n}\n\n" +
          ".sibling-in-module-a {\n  sibling: yes;\n}\n";
          sassTestUtils.assertCompiles(options, expected, done);
      });

      it("imports modules that use the module name instead index.", function (done) {
        var options = {
          data: '@import "compatible-module";',
          eyeglass: {
            root: testutils.fixtureDirectory("compatible_module")
          }
        };
        var expected = ".is-a-compatible-submodule {\n  this: is a compatible submodule;\n}\n\n" +
          ".is-a-compatible-module {\n  this: is a compatible module;\n}\n";
          sassTestUtils.assertCompiles(options, expected, done);
      });

      it("imports modules if they are themselves a npm eyeglass module.", function (done) {
        var options = {
          data: '@import "is-a-module";',
          eyeglass: {
            root: testutils.fixtureDirectory("is_a_module")
          }
        };
        var expected = ".is-a-module {\n  this: is a module;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("imports for modules such as foo/bar/_foo.scss wanting foo/bar (#37)", function (done) {
        var options = {
          data: '@import "module_a";',
          eyeglass: {
            root: testutils.fixtureDirectory("redundantly_named_modules")
          }
        };
        var expected = ".nested-module-a {\n  greeting: hello world;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("eyeglass exports can be specified through the " +
        " eyeglass property of package.json.", function (done) {
          var options = {
            data: '@import "has_a_main_already";',
            eyeglass: {
              root: testutils.fixtureDirectory("has_a_main_already")
            }
          };
          var expected = ".has-a-main {\n  main: already;\n}\n";
          sassTestUtils.assertCompiles(options, expected, done);
        });

      it("errors when no sass directory is specified", function (done) {
        testutils.assertStderr(function (checkStderr) {
          var rootDir = testutils.fixtureDirectory("app_with_malformed_module");
          var options = {
            data: '@import "malformed_module"; .foo {}',
            eyeglass: {
              root: rootDir
            }
          };
          var expectedError = {message: "sassDir is not specified in malformed_module's package.json or " +
            path.join(rootDir, "node_modules", "malformed_module", "eyeglass-exports.js")};

            sassTestUtils.assertCompilationError(options, expectedError, done);
        });
      });

      it("errors when a dependency is missing", function (done) {
        testutils.assertStderr(function (checkStderr) {
          var rootDir = testutils.fixtureDirectory("missing_module");
          var options = {
            data: "/* test */",
            eyeglass: {
              root: rootDir
            }
          };
          var expectedOutput = "/* test */\n";
          sassTestUtils.assertCompiles(options, expectedOutput, function () {
            checkStderr("The following dependencies were not found:" +
              "\n  module_a\nYou might need to `npm install` the above.\n");
            done();
          });
        });
      });

      it("handles an array of importers", function (done) {
        var importerMissCalled = false;
        var importerMiss = function (uri, prev, cb) {
          importerMissCalled = true;
          cb(sass.types.Null.NULL);
        };

        var importerHit = function (uri, prev, cb) {
          cb({ contents: ".foo { color: red; }" });
        };

        var options = {
          data: '@import "OMG";',
          importer: [importerMiss, importerHit],
          eyeglass: {
            root: testutils.fixtureDirectory("basic_modules")
          }
        };
        var expected = ".foo {\n  color: red;\n}\n";
        sassTestUtils.assertCompiles(options, expected, function () {
          assert(importerMissCalled);
          done();
        });
      });

      it("handle project name that conflicts with eyeglass module name", function (done) {
        var options = {
          data: '@import "my-package";',
          eyeglass: {
            root: testutils.fixtureDirectory("project_name_is_dep_name")
          }
        };
        var expected = ".foo {\n  color: red;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should invoke importers with the correct context", function (done) {
        var importerOptions;

        var options = {
          data: '@import "OMG";',
          importer: function (uri, prev, cb) {
            importerOptions = this.options;
            cb({ contents: ".foo { color: red; }" });
          }
        };
        var expected = ".foo {\n  color: red;\n}\n";
        sassTestUtils.assertCompiles(options, expected, function () {
          assert(importerOptions);
          done();
        });
      });

      it("should allow sassDir to be specified in the package.json", function (done) {
        var options = {
          data: '@import "simple-module";',
          eyeglass: {
            root: testutils.fixtureDirectory("simple_module")
          }
        };
        var expected = ".simple-module {\n  this: is a simple module;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should allow sassDir to be specified in " +
        "the package.json with main and no exports", function (done) {
          var options = {
            data: '@import "simple-module-with-main";',
            eyeglass: {
              root: testutils.fixtureDirectory("simple_module_with_main")
            }
          };
          var expected = ".simple-module {\n  this: is a simple module;\n  exports: nothing;\n}\n";
          sassTestUtils.assertCompiles(options, expected, done);
        });

      it("should resolve includePaths against the root directory", function (done) {
        var rootDir = testutils.fixtureDirectory("app_with_include_paths");
        var options = {
          file: path.join(rootDir, "scss", "main.scss"),
          includePaths: ["more_scss"],
          eyeglass: {
            root: rootDir
          }
        };
        var expected = ".from {\n  include: path;\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should compile multiple files with imports (#114)", function (done) {
        var rootDir = testutils.fixtureDirectory("issue-114");
        var files = ["main1.scss", "main2.scss", "main3.scss", "main4.scss"];

        var promises = files.map(function (file) {
          return new Promise(function (fulfill, reject) {
            var options = {
              file: path.join(rootDir, "sass", file),
              eyeglass: {
                root: rootDir
              }
            };
            var expected = "/* partial */\n";
            sassTestUtils.assertCompiles(options, expected, function (err) {
              if (err) {
                reject(err);
              } else {
                fulfill();
              }
            });
          });
        });

        // when all the promises finish
        Promise.all(promises).then(function () {
          done();
        }, done);
      });

      it("should be allowed to import from eyeglass without a declared dependency", function (done) {
        var options = {
          data: '@import "module_a";',
          eyeglass: {
            root: testutils.fixtureDirectory("module_imports_eyeglass")
          }
        };
        var expected = "/* function-exists(asset-url): true */\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should not require(main) if not an eyeglass module", function (done) {
        var root = testutils.fixtureDirectory("no_main_if_not_module");
        var options = {
          file: path.join(root, "test.scss"),
          eyeglass: {
            root: root
          }
        };
        var expected = "/* testing */\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should not import `index` for non-existent files", function (done) {
        var rootDir = testutils.fixtureDirectory("simple_module");
        var options = {
          data: '@import "simple-module/invalid";',
          eyeglass: {
            root: rootDir
          }
        };

        var expectedError = [
          "sass/_this-does-not-exist.scss",
          "sass/this-does-not-exist/_index.scss",
          "sass/this-does-not-exist.scss",
          "sass/this-does-not-exist/index.scss",
          "sass/this-does-not-exist.sass",
          "sass/this-does-not-exist.css",
          "sass/_this-does-not-exist.sass",
          "sass/_this-does-not-exist.css",
          "sass/this-does-not-exist/index.sass",
          "sass/this-does-not-exist/index.css",
          "sass/this-does-not-exist/_index.sass",
          "sass/this-does-not-exist/_index.css"
        ].reduce(function (msg, location) {
          return msg + "\n  " + path.resolve(rootDir, location);
        }, "`this-does-not-exist` was not found in any of the following locations:");

        sassTestUtils.assertCompilationError(options, {message: expectedError}, done);
      });

      it("should import css files without extensions", function (done) {
        var options = {
          data: '@import "simple-module/bar";',
          eyeglass: {
            root: testutils.fixtureDirectory("simple_module")
          }
        };

        var expected = "/* baz.css */\n/* _qux.scss */\n";

        sassTestUtils.assertCompiles(options, expected, done);
      });


      it("should import from a scoped module name", function (done) {
        var options = {
          data: '@import "@scope/foo";',
          eyeglass: {
            root: testutils.fixtureDirectory("scoped_module")
          }
        };
        var expected = "/* @scope/foo */\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      // back-compat
      it("should import using scoped module workaround", function (done) {
        var options = {
          data: '@import "@scope-foo/bar";',
          eyeglass: {
            root: testutils.fixtureDirectory("scoped_workaround")
          }
        };
        var expected = "/* @scope/foo/bar */\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });
    });
  });
});

describe("manual modules", function () {
  testutils.withEachSass(function (sass, sassName, sassTestUtils) {
    describe(`with ${sassName}`, function () {
      it("should support manually added module", function (done) {
        var manualModule = require(testutils.fixtureDirectory("manual_module"));
        var rootDir = testutils.fixtureDirectory("simple_module");
        var options = {
          data: '@import "my-manual-module"; .test { hello: manual-hello(); }',
          eyeglass: {
            root: rootDir,
            modules: [manualModule]
          }
        };
        var expected = ".manual-module {\n  works: true;\n}\n\n"
          + ".test {\n  hello: \"Hello World!\";\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should support manually added module via path", function (done) {
        var manualModulePath = testutils.fixtureDirectory("manual_module");
        var manualModule = require(manualModulePath);
        // add a bower module with a given path
        var bowerModule = {
          path: path.join(manualModulePath, "bower_components/bower-module")
        };
        var rootDir = testutils.fixtureDirectory("simple_module");
        var options = {
          data: "@import \"bower-module\"; @import \"my-manual-module\";"
            + ".test { hello: manual-hello(); }",
          eyeglass: {
            root: rootDir,
            modules: [manualModule, bowerModule]
          }
        };
        var expected = "/* bower-module */\n.manual-module {\n  works: true;\n}" +
          "\n\n.test {\n  hello: \"Hello World!\";\n}\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });

      it("should allow manually declared dependencies", function (done) {
        var manualModulePath = testutils.fixtureDirectory("manual_module");
        var rootDir = testutils.fixtureDirectory("simple_module");
        var options = {
          data: "@import \"module_b\";",
          eyeglass: {
            root: rootDir,
            modules: [
              // my-manual-module
              require(manualModulePath),

              // module_a
              {
                path: path.join(manualModulePath, "module_a"),
                dependencies: {
                  "my-manual-module": "*"
                }
              },

              // module_b
              {
                path: path.join(manualModulePath, "module_b"),
                dependencies: {
                  "module_a": "*"
                }
              }
            ]
          }
        };
        var expected = "/* module_b */\n/* module_a */\n"
          + ".manual-module {\n  works: true;\n}\n\n/* module_c */\n";
        sassTestUtils.assertCompiles(options, expected, done);
      });
    });
  });
});
