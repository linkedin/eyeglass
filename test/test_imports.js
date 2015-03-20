"use strict";

var assert = require("assert");
var sass = require("node-sass");
var path = require("path");
var eyeglass = require("../lib");
var capture = require("../lib/util/capture");

function fixtureDirectory(subpath) {
  return path.join(__dirname, "fixtures", subpath);
}

describe("core api", function () {

 it("should compile a sass file", function (done) {
    sass.render({
      data: "div { $c: red; color: $c; }",
      success: function(result) {
        assert.equal("div {\n  color: red; }\n", result.css);
        done();
      }
    });
 });

 it("should compile a sass file with a custom function", function (done) {
    sass.render({
      data: "div { content: hello-world(); }",
      functions: {
        "hello-world()": function() {
          return sass.types.String('"Hello World!"');
        }
      },
      success: function(result) {
        assert.equal('div {\n  content: "Hello World!"; }\n', result.css);
        done();
      }
    });
 });

 it("should compile a sass file with a custom async function", function (done) {
    sass.render({
      data: "div { content: hello-world(); }",
      functions: {
        "hello-world()": function(sassCb) {
          setTimeout(function() {
            sassCb(sass.types.String('"Hello World!"'));
          });
        }
      },
      success: function(result) {
        assert.equal('div {\n  content: "Hello World!"; }\n', result.css);
        done();
      }
    });
 });

 it("passes through node-sass options", function (done) {
    sass.render(eyeglass({
      data: "div { content: hello-world(); }",
      functions: {
        "hello-world()": function() {
          return sass.types.String('"Hello World!"');
        }
      },
      success: function(result) {
        assert.equal('div {\n  content: "Hello World!"; }\n', result.css);
        done();
      }
    }));
 });

});

describe("eyeglass importer", function () {

 it("lets you import sass files from npm modules", function (done) {
    sass.render(eyeglass({
      root: fixtureDirectory("basic_modules"),
      data: '@import "module_a";',
      success: function(result) {
        assert.equal(".module-a {\n  greeting: hello world; }\n\n" +
                     ".sibling-in-module-a {\n  sibling: yes; }\n", result.css);
        done();
      }
    }));
 });

 it("lets you import from a subdir in a npm module", function (done) {
    sass.render(eyeglass({
      root: fixtureDirectory("basic_modules"),
      data: '@import "module_a/submodule";',
      success: function(result) {
        assert.equal(".submodule {\n  hello: world; }\n", result.css);
        done();
      }
    }));
 });

 it("lets you import explicitly from a subdir in a module", function (done) {
    sass.render(eyeglass({
      root: fixtureDirectory("basic_modules"),
      data: '@import "module_a/submodule/_index.scss";',
      success: function(result) {
        assert.equal(".submodule {\n  hello: world; }\n", result.css);
        done();
      }
    }));
 });

 it("lets you import css files", function (done) {
    sass.render(eyeglass({
      root: fixtureDirectory("basic_modules"),
      data: '@import "module_a/css_file";',
      success: function(result) {
        assert.equal(".css-file {\n  hello: world; }\n", result.css);
        done();
      }
    }));
 });

 it("lets you import sass files from a transitive dependency", function (done) {
    sass.render(eyeglass({
      root: fixtureDirectory("basic_modules"),
      data: '@import "module_a/transitive_imports";',
      success: function(result) {
        assert.equal(".transitive_module {\n  hello: world; }\n", result.css);
        done();
      }
    }));
 });

 it("does not let you import transitive sass files", function (done) {
   var output = "";
   var release = capture(function(string) {
     output = output + string;
   }, "stderr");
   sass.render(eyeglass({
     root: fixtureDirectory("basic_modules"),
     data: '@import "transitive_module";',
     success: function(result) {
       release();
       // TODO This should not be a successful compile if no importers
       // TODO actually work (libsass issue?)
       assert.equal("", result.css);
       done();
     }
   }));
 });

 it("only imports a module dependency once.", function (done) {
    sass.render(eyeglass({
      root: fixtureDirectory("basic_modules"),
      data: '@import "module_a"; @import "module_a";',
      success: function(result) {
        assert.equal(".module-a {\n  greeting: hello world; }\n\n" +
                     ".sibling-in-module-a {\n  sibling: yes; }\n", result.css);
        done();
      }
    }));
 });

 it("imports modules if they are themselves a npm eyeglass module.",
    function (done) {
      sass.render(eyeglass({
        root: fixtureDirectory("is_a_module"),
        data: '@import "is_a_module";',
        success: function(result) {
          assert.equal(".is-a-module {\n  this: is a module; }\n", result.css);
          done();
        }
      }));
    }
 );

 it("eyeglass exports can be specified through the " +
    "eyeglass property of package.json.",
    function (done) {
      sass.render(eyeglass({
        root: fixtureDirectory("has_a_main_already"),
        data: '@import "has_a_main_already";',
        success: function(result) {
          assert.equal(".has-a-main {\n  main: already; }\n", result.css);
          done();
        }
      }));
    }
 );

});
