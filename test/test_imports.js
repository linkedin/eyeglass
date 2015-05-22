"use strict";

var sass = require("node-sass");
var testutils = require("./testutils");

describe("core api", function () {

 it("should compile a sass file", function (done) {
   var options = {
     data: "div { $c: red; color: $c; }"
   };
   var expected = "div {\n  color: red; }\n";
   testutils.assertCompiles(options, expected, done);
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
     root: testutils.fixtureDirectory("basic_modules"),
     data: '@import "module_a";'
   };
   var expected = ".module-a {\n  greeting: hello world; }\n\n" +
                  ".sibling-in-module-a {\n  sibling: yes; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("lets you import sass files from dev dependencies", function (done) {
   var options = {
     root: testutils.fixtureDirectory("dev_deps"),
     data: '@import "module_a";'
   };
   var expected = ".module-a {\n  greeting: hello world; }\n\n" +
                  ".sibling-in-module-a {\n  sibling: yes; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("lets you import from a subdir in a npm module", function (done) {
   var options = {
     root: testutils.fixtureDirectory("basic_modules"),
     data: '@import "module_a/submodule";'
   };
   var expected = ".submodule {\n  hello: world; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("lets you import explicitly from a subdir in a module", function (done) {
   var options = {
     root: testutils.fixtureDirectory("basic_modules"),
     data: '@import "module_a/submodule/_index.scss";'
   };
   var expected = ".submodule {\n  hello: world; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("lets you import css files", function (done) {
   var options = {
     root: testutils.fixtureDirectory("basic_modules"),
     data: '@import "module_a/css_file";'
   };
   var expected = ".css-file {\n  hello: world; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("lets you import sass files from a transitive dependency", function (done) {
   var options = {
     root: testutils.fixtureDirectory("basic_modules"),
     data: '@import "module_a/transitive_imports";'
   };
   var expected = ".transitive_module {\n  hello: world; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("does not let you import transitive sass files", function (done) {
   testutils.assertStderr(function(checkStderr) {
     var options = {
       root: testutils.fixtureDirectory("basic_modules"),
       data: '@import "transitive_module";'
     };
     // TODO This should not be a successful compile (libsass issue?)
     var expected = "";
     testutils.assertCompiles(options, expected, function() {
       // TODO: Why isn't there an error?
       checkStderr("");
       done();
     });
   });
 });

 it("only imports a module dependency once.", function (done) {
   var options = {
     root: testutils.fixtureDirectory("basic_modules"),
     data: '@import "module_a"; @import "module_a";'
   };
   var expected = ".module-a {\n  greeting: hello world; }\n\n" +
                  ".sibling-in-module-a {\n  sibling: yes; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("imports modules if they are themselves a npm eyeglass module.", function(done) {
    var options = {
      root: testutils.fixtureDirectory("is_a_module"),
      data: '@import "is_a_module";'
    };
   var expected = ".is-a-module {\n  this: is a module; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("imports for modules such as foo/bar/_foo.scss wanting foo/bar (#37)", function (done) {
   var options = {
     root: testutils.fixtureDirectory("redundantly_named_modules"),
     data: '@import "module_a";'
   };
   var expected = ".nested-module-a {\n  greeting: hello world; }\n";
   testutils.assertCompiles(options, expected, done);
 });

 it("eyeglass exports can be specified through the " +
    "eyeglass property of package.json.",
   function (done) {
     var options = {
       root: testutils.fixtureDirectory("has_a_main_already"),
       data: '@import "has_a_main_already";'
     };
     var expected = ".has-a-main {\n  main: already; }\n";
     testutils.assertCompiles(options, expected, done);
   }
 );

});
