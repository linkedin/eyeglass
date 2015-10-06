"use strict";

var sass = require("node-sass");
var path = require("path");
var tmp = require("tmp");
var Eyeglass = require("../lib").Eyeglass;
var testutils = require("./testutils");
var assert = require("assert");
var fse = require("fs-extra");

describe("fs", function () {

 it("can resolve the identifier 'root' to the project root", function (done) {
   var rootDir = testutils.fixtureDirectory("app_assets");

   var input = "@import 'fs(root)';" +
               "fs {" +
               "  absolute: fs-absolute-path(root, 'images/foo.png'); }";
   var expected = "fs {\n" +
                  "  absolute: " + path.join(rootDir, "images", "foo.png") + "; }\n";

   var eg = new Eyeglass({
     root: rootDir,
     data: input
   }, sass);

   testutils.assertCompiles(eg, expected, done);
 });

 it("resolves stdin as the current working directory", function (done) {
   var rootDir = testutils.fixtureDirectory("app_assets");
   var pwd = path.resolve(".");

   var input = "@import 'fs(stdin)';" +
               "fs {" +
               "  absolute: fs-absolute-path(stdin, 'images/foo.png'); }";
   var expected = "fs {\n" +
                  "  absolute: " + path.join(pwd, "images", "foo.png") + "; }\n";

   var eg = new Eyeglass({
     root: rootDir,
     data: input
   }, sass);

   testutils.assertCompiles(eg, expected, done);
 });

 it("resolves current file's directory", function (done) {
   var rootDir = testutils.fixtureDirectory("app_assets");

   var input = "@import 'fs(my-id)';" +
               "fs {" +
               "  absolute: fs-absolute-path(my-id, 'images/foo.png'); }";
   var expected = "fs {\n" +
                  "  absolute: " + path.join(rootDir, "sass", "images", "foo.png") + "; }\n";

   var eg = new Eyeglass({
     root: rootDir,
     data: input,
     file: path.join(rootDir, "sass", "uses_mod_1.scss")
   }, sass);

   testutils.assertCompiles(eg, expected, done);
 });

 it("can join path segments", function (done) {
   var rootDir = testutils.fixtureDirectory("app_assets");

   var input = "@import 'eyeglass/fs';" +
               "fs {" +
               "  joined: fs-join('images', 'foo.png'); }";
   var expected = "fs {\n" +
                  "  joined: " + path.join("images",  "foo.png") + "; }\n";

   var eg = new Eyeglass({
     root: rootDir,
     data: input,
     file: path.join(rootDir, "sass", "uses_mod_1.scss")
   }, sass);

   testutils.assertCompiles(eg, expected, done);
 });

 it("exposes the path separator", function (done) {
   var rootDir = testutils.fixtureDirectory("app_assets");

   var input = "@import 'eyeglass/fs';" +
               "fs {" +
               "  sep: $fs-path-separator }";
   var expected = "fs {\n" +
                  "  sep: " + path.sep + "; }\n";

   var eg = new Eyeglass({
     root: rootDir,
     data: input,
     file: path.join(rootDir, "sass", "uses_mod_1.scss")
   }, sass);

   testutils.assertCompiles(eg, expected, done);
 });


 it("can check if a file exists", function (done) {
   var rootDir = testutils.fixtureDirectory("app_assets");

   var input = "@import 'fs(my-id)';" +
               "fs {" +
               "  absolute: fs-absolute-path(my-id, 'images/foo.png');" +
               "  exists: fs-exists(fs-absolute-path(my-id, 'uses_mod_1.scss'));" +
               "  missing: fs-exists(fs-absolute-path(my-id, 'images/foo.png'));" +
               "}";
   var expected = "fs {\n" +
                  "  absolute: " + path.join(rootDir, "sass", "images", "foo.png") + ";\n" +
                  "  exists: true;\n" +
                  "  missing: false; }\n";

   var eg = new Eyeglass({
     root: rootDir,
     data: input,
     file: path.join(rootDir, "sass", "uses_mod_1.scss")
   }, sass);

   testutils.assertCompiles(eg, expected, done);
 });

 it("cannot access check existance of file outside the security sandbox", function(done) {
   var rootDir = testutils.fixtureDirectory("app_assets");

   var input = "@import 'fs(my-id)';" +
               "fs {" +
               "  illegal: fs-exists(fs-absolute-path(my-id, '..', '..', '..'));" +
               "}";

   var eg = new Eyeglass({
     root: rootDir,
     data: input,
     file: path.join(rootDir, "sass", "uses_mod_1.scss"),
     fsSandbox: true
   }, sass);

   // Ugh. I hate this, need to clean up error checking so it's not so fragile.
   // Also, why is this error different?
   var expectedError = [
     "error in C function eyeglass-fs-exists: Security violation: Cannot access " +
       path.resolve(rootDir, "..", ".."),
     "",
     "Backtrace:",
     "\teyeglass/fs:23, in function `eyeglass-fs-exists`",
     "\teyeglass/fs:23, in function `fs-exists`",
     "\ttest/fixtures/app_assets/sass/uses_mod_1.scss:1",
   ].join("\n");

   testutils.assertCompilationError(eg, expectedError, done);
 });
});
