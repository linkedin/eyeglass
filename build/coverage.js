"use strict";

var istanbul = require("gulp-istanbul");
var mocha = require("gulp-mocha");

module.exports = function(gulp, depends, name) {
  gulp.task(name || "coverage", depends, function (cb) {
    gulp.src(["lib/**/*.js"])
    .pipe(istanbul()) // Covering files
    .pipe(istanbul.hookRequire()) // Force `require` to return covered files
    .on("finish", function () {
      gulp.src(["test/**/test_*.js"])
      .pipe(mocha())
      .pipe(istanbul.writeReports()) // Creating the reports after tests runned
      .pipe(istanbul.enforceThresholds({
        thresholds: {
          global: {
            statements: 99.8,
            branches: 99.25,
            functions: 100,
            lines: 99.8
          }
        }
      }))
      .on("end", cb)
      .on("error", function(e) {
        console.log(e.toString());
        process.exit(1);
      });
    });
  });
};
