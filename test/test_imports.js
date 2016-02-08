"use strict";

var sass = require("node-sass");
var Eyeglass = require("../lib");
var testutils = require("./testutils");
var path = require("path");
var assert = require("assert");

describe("core api", function () {
  it("should compile a sass file", function (done) {
    var options = {
      data: "div { $c: red; color: $c; }"
    };
    var expected = "div {\n  color: red; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should compile a sass file if includePaths" +
     " was not passed as an option & not needed", function(done) {
    var expected = ".foo {\n" +
                   "  color: red; }\n";
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

    testutils.assertCompiles(eg, expected, done);
  });

  it("should compile a sass file honoring includePaths", function(done) {
    var expected = ".foo {\n" +
                   "  color: #112358; }\n";
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

    testutils.assertCompiles(eg, expected, done);
  });

   it("should be able to @import \"folder/file\" from a dir in includePaths", function(done) {
     var expected = ".bar {\n" +
                    "  color: #333; }\n";
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

     testutils.assertCompiles(eg, expected, done);
   });

   it("should be able to @import a sass file with a dots in" +
      " its directory name and file name", function(done) {
     var expected = ".bat-noise {\n" +
                    "  color: #eee; }\n";
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

     testutils.assertCompiles(eg, expected, done);
   });

  it("should compile a sass file with a custom function", function (done) {
    var options = {
      data: "div { content: hello-world(); }",
      functions: {
        "hello-world()": function() {
          return sass.types.String('"Hello World!"');
        }
      }
    };
    var expected = 'div {\n  content: "Hello World!"; }\n';
    testutils.assertCompiles(options, expected, done);
  });

  it("should compile a sass file with a custom async function", function (done) {
    var options = {
      data: "div { content: hello-world(); }",
      functions: {
        "hello-world()": function(sassCb) {
          setTimeout(function() {
            sassCb(sass.types.String('"Hello World!"'));
          });
        }
      }
    };
    var expected = 'div {\n  content: "Hello World!"; }\n';
    testutils.assertCompiles(options, expected, done);
  });

  it("passes through node-sass options", function (done) {
    var options = {
      data: "div { content: hello-world(); }",
      functions: {
        "hello-world()": function() {
          return sass.types.String('"Hello World!"');
        }
      }
    };
    var expected = 'div {\n  content: "Hello World!"; }\n';
    testutils.assertCompiles(options, expected, done);
  });

});

describe("eyeglass importer", function () {

  it("lets you import sass files from npm modules", function (done) {
    var options = {
      data: '@import "module_a";',
      eyeglass: {
        root: testutils.fixtureDirectory("basic_modules")
      }
    };
    var expected = ".module-a {\n  greeting: hello world; }\n\n" +
                   ".sibling-in-module-a {\n  sibling: yes; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("lets you import sass files from dev and peer dependencies", function (done) {
    var options = {
      data: '@import "module_a"; @import "module_peer"; @import "module_b";',
      eyeglass: {
        root: testutils.fixtureDirectory("dev_peer_deps")
      }
    };
    var expected = ".module-a {\n  greeting: hello world; }\n\n" +
                   ".sibling-in-module-a {\n  sibling: yes; }\n\n" +
                   "/* module_peer */\n/* module_b */\n/* module_peer/foo */\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("lets you import from a subdir in a npm module", function (done) {
    var options = {
      data: '@import "module_a/submodule";',
      eyeglass: {
        root: testutils.fixtureDirectory("basic_modules")
      }
    };
    var expected = ".submodule {\n  hello: world; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("lets you import explicitly from a subdir in a module", function (done) {
    var options = {
      data: '@import "module_a/submodule/_index.scss";',
      eyeglass: {
        root: testutils.fixtureDirectory("basic_modules")
      }
    };
    var expected = ".submodule {\n  hello: world; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("lets you import css files", function (done) {
    var options = {
      data: '@import "module_a/css_file";',
      eyeglass: {
        root: testutils.fixtureDirectory("basic_modules")
      }
    };
    var expected = ".css-file {\n  hello: world; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("lets you import sass files from a transitive dependency", function (done) {
    var options = {
      data: '@import "module_a/transitive_imports";',
      eyeglass: {
        root: testutils.fixtureDirectory("basic_modules")
      }
    };
    var expected = ".transitive_module {\n  hello: world; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("does not let you import transitive sass files", function (done) {
    testutils.assertStderr(function(checkStderr) {
      var options = {
        file: "wubwubwub.scss",
        data: '@import "transitive_module";',
        eyeglass: {
          root: testutils.fixtureDirectory("basic_modules")
        }
      };
      // TODO This should not be a successful compile (libsass issue?)
      // TODO Shouldn't the file path be relative to `options.root`?
      var expectedError = "Could not import transitive_module from " +
                          path.resolve("wubwubwub.scss");
      testutils.assertCompilationError(options, expectedError, done);
    });
  });

  it("only imports a module dependency once.", function (done) {
    var options = {
      data: '@import "module_a"; @import "module_a";',
      eyeglass: {
        root: testutils.fixtureDirectory("basic_modules")
      }
    };
    var expected = ".module-a {\n  greeting: hello world; }\n\n" +
                   ".sibling-in-module-a {\n  sibling: yes; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("imports modules that use the module name instead index.", function(done) {
    var options = {
      data: '@import "compatible-module";',
      eyeglass: {
        root: testutils.fixtureDirectory("compatible_module")
      }
    };
    var expected = ".is-a-compatible-submodule {\n  this: is a compatible submodule; }\n\n" +
                   ".is-a-compatible-module {\n  this: is a compatible module; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("imports modules if they are themselves a npm eyeglass module.", function(done) {
    var options = {
      data: '@import "is-a-module";',
      eyeglass: {
        root: testutils.fixtureDirectory("is_a_module")
      }
    };
    var expected = ".is-a-module {\n  this: is a module; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("imports for modules such as foo/bar/_foo.scss wanting foo/bar (#37)", function (done) {
    var options = {
      data: '@import "module_a";',
      eyeglass: {
        root: testutils.fixtureDirectory("redundantly_named_modules")
      }
    };
    var expected = ".nested-module-a {\n  greeting: hello world; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("eyeglass exports can be specified through the " +
  " eyeglass property of package.json.", function (done) {
    var options = {
      data: '@import "has_a_main_already";',
      eyeglass: {
        root: testutils.fixtureDirectory("has_a_main_already")
      }
    };
    var expected = ".has-a-main {\n  main: already; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("errors when no sass directory is specified", function (done) {
    testutils.assertStderr(function(checkStderr) {
      var rootDir = testutils.fixtureDirectory("app_with_malformed_module");
      var options = {
        data: '@import "malformed_module"; .foo {}',
        eyeglass: {
          root: rootDir
        }
      };
      var expectedError = "sassDir is not specified in malformed_module's package.json or " +
        path.join(rootDir, "node_modules", "malformed_module", "eyeglass-exports.js");

      testutils.assertCompilationError(options, expectedError, done);
    });
  });

  it("errors when a dependency is missing", function (done) {
    testutils.assertStderr(function(checkStderr) {
      var rootDir = testutils.fixtureDirectory("missing_module");
      var options = {
        data: "/* test */",
        eyeglass: {
          root: rootDir
        }
      };
      var expectedOutput = "/* test */\n";
      testutils.assertCompiles(options, expectedOutput, function() {
        checkStderr("The following dependencies were not found:" +
          "\n  module_a\nYou might need to `npm install` the above.\n");
        done();
      });
    });
  });

  it("handles an array of importers", function(done) {
    var importerMissCalled = false;
    var importerMiss = function(uri, prev, cb) {
     importerMissCalled = true;
     cb(sass.NULL);
    };

    var importerHit = function(uri, prev, cb) {
     cb({contents: ".foo { color: red; }"});
    };

    var options = {
      data: '@import "OMG";',
      importer: [importerMiss, importerHit],
      eyeglass: {
        root: testutils.fixtureDirectory("basic_modules")
      }
    };
    var expected = ".foo {\n  color: red; }\n";
    testutils.assertCompiles(options, expected, function() {
     assert(importerMissCalled);
     done();
    });
  });

  it("handle project name that conflicts with eyeglass module name", function(done) {
    var options = {
      data: '@import "my-package";',
      eyeglass: {
        root: testutils.fixtureDirectory("project_name_is_dep_name")
      }
    };
    var expected = ".foo {\n  color: red; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should invoke importers with the correct context", function(done) {
    var importerOptions;

    var options = {
      data: '@import "OMG";',
      importer: function(uri, prev, cb) {
        importerOptions = this.options;
        cb({contents: ".foo { color: red; }"});
      }
    };
    var expected = ".foo {\n  color: red; }\n";
    testutils.assertCompiles(options, expected, function() {
      assert(importerOptions);
      done();
    });
  });

  it("should allow sassDir to be specified in the package.json", function(done) {
    var options = {
      data: '@import "simple-module";',
      eyeglass: {
        root: testutils.fixtureDirectory("simple_module")
      }
    };
    var expected = ".simple-module {\n  this: is a simple module; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should allow sassDir to be specified in " +
  "the package.json with main and no exports", function(done) {
    var options = {
      data: '@import "simple-module-with-main";',
      eyeglass: {
        root: testutils.fixtureDirectory("simple_module_with_main")
      }
    };
    var expected = ".simple-module {\n  this: is a simple module;\n  exports: nothing; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should resolve includePaths against the root directory", function(done) {
    var rootDir = testutils.fixtureDirectory("app_with_include_paths");
    var options = {
      file: path.join(rootDir, "scss", "main.scss"),
      includePaths: ["more_scss"],
      eyeglass: {
        root: rootDir
      }
    };
    var expected = ".from {\n  include: path; }\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should compile multiple files with imports (#114)", function(done) {
    var rootDir = testutils.fixtureDirectory("issue-114");
    var files = ["main1.scss", "main2.scss", "main3.scss", "main4.scss"];

    var promises = files.map(function(file) {
      return new Promise(function(fulfill, reject) {
        var options = {
          file: path.join(rootDir, "sass", file),
          eyeglass: {
            root: rootDir
          }
        };
        var expected = "/* partial */\n";
        testutils.assertCompiles(options, expected, function(err) {
          if (err) {
            reject(err);
          } else {
            fulfill();
          }
        });
      });
    });

    // when all the promises finish
    Promise.all(promises).then(function() {
      done();
    }, done);
  });

  it("should be allowed to import from eyeglass without a declared depenedency", function(done) {
    var options = {
      data: '@import "module_a";',
      eyeglass: {
        root: testutils.fixtureDirectory("module_imports_eyeglass")
      }
    };
    var expected = "/* function-exists(asset-url): true */\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should not require(main) if not an eyeglass module", function(done) {
    var root = testutils.fixtureDirectory("no_main_if_not_module");
    var options = {
      file: path.join(root, "test.scss"),
      eyeglass: {
        root: root
      }
    };
    var expected = "/* testing */\n";
    testutils.assertCompiles(options, expected, done);
  });

  it("should not import `index` for non-existent files", function(done) {
    var rootDir = testutils.fixtureDirectory("simple_module");
    var options = {
      data: '@import "simple-module/invalid";',
      eyeglass: {
        root: rootDir
      }
    };

    var expectedError = [
      "sass/this-does-not-exist.scss",
      "sass/this-does-not-exist.sass",
      "sass/this-does-not-exist.css",
      "sass/_this-does-not-exist.scss",
      "sass/_this-does-not-exist.sass",
      "sass/_this-does-not-exist.css",
      "sass/this-does-not-exist/index.scss",
      "sass/this-does-not-exist/index.sass",
      "sass/this-does-not-exist/index.css",
      "sass/this-does-not-exist/_index.scss",
      "sass/this-does-not-exist/_index.sass",
      "sass/this-does-not-exist/_index.css"
    ].reduce(function(msg, location) {
      return msg + "\n  " + path.resolve(rootDir, location);
    }, "Error: Could not import this-does-not-exist from any of the following locations:");

    testutils.assertCompilationError(options, expectedError, done);
  });

  it("should import files with extensions", function(done) {
    var options = {
      data: '@import "simple-module/bar";',
      eyeglass: {
        root: testutils.fixtureDirectory("simple_module")
      }
    };

    var expected = "/* baz.css */\n/* _qux.scss */\n";

    testutils.assertCompiles(options, expected, done);
  });
});
