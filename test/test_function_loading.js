"use strict";

var assert = require("assert");
var sass = require("node-sass");
var path = require("path");
var eyeglass = require("../lib/options_decorator");
var capture = require("../lib/util/capture");

function fixtureDirectory(subpath) {
  var p = path.join(__dirname, "fixtures", subpath);
  return p;
}

describe("function loading", function () {

 it("should discover sass functions", function (done) {
   sass.render(eyeglass({
     root: fixtureDirectory("function_modules"),
     data: "#hello { greeting: hello(Chris); }\n" +
           "#transitive { is: transitive(); }\n",
     success: function(result) {
       assert.equal("#hello {\n  greeting: Hello, Chris!; }\n\n" +
                    "#transitive {\n  is: transitive; }\n",
                    result.css);
       done();
     }
   }));
 });

 it("should let me define my own sass functions too", function (done) {
   sass.render(eyeglass({
     root: fixtureDirectory("function_modules"),
     data: "#hello { greeting: hello(Chris); }\n" +
           "#mine { something: add-one(3em); }\n",
     functions: {
       "add-one($number)": function(number) {
         return sass.types.Number(number.getValue() + 1, number.getUnit());
       }
     },
     success: function(result) {
       assert.equal("#hello {\n  greeting: Hello, Chris!; }\n\n" +
                    "#mine {\n  something: 4em; }\n",
                    result.css);
       done();
     }
   }));
 });

 it("should let local functions override imported functions", function (done) {
   var output = "";
   var release = capture(function(string) {
     output = output + string;
   });
   sass.render(eyeglass({
     root: fixtureDirectory("function_modules"),
     data: "#hello { greeting: hello(Chris); }\n",
     functions: {
       "hello($name: \"World\")": function(name) {
         return sass.types.String("Goodbye, " + name.getValue() + "!");
       }
     },
     success: function(result) {
       release();
       assert.equal("#hello {\n  greeting: Goodbye, Chris!; }\n",
                    result.css);
       assert.equal("", output);
       done();
     }
   }));
 });

 it("should warn about conflicting function signatures", function (done) {
   var output = "";
   var release = capture(function(string) {
     output = output + string;
   }, "stderr");
   sass.render(eyeglass({
     root: fixtureDirectory("function_modules"),
     data: "#hello { greeting: hello(Chris); }\n",
     functions: {
       "hello($name: 'Sucker')": function(name) {
         return sass.types.String("Goodbye, " + name.getValue() + "!");
       }
     },
     success: function(result) {
       release();
       assert.equal("#hello {\n  greeting: Goodbye, Chris!; }\n",
                    result.css);
       assert.equal("WARNING: Function hello was redeclared with " +
                    "conflicting function signatures: hello($name: \"World\")" +
                    " vs. hello($name: 'Sucker')\n", output);
       done();
     }
   }));
 });

 it("load functions from modules if they are themselves a npm eyeglass module.",
    function (done) {
      sass.render(eyeglass({
        root: fixtureDirectory("is_a_module"),
        data: "#hello { greeting: hello(); }\n",
        success: function(result) {
          assert.equal("#hello {\n  greeting: Hello, Myself!; }\n",
                       result.css);
                       done();
        }
      }));
  });

});
