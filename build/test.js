"use strict";

var istanbul = require("gulp-istanbul");
var mocha = require("gulp-mocha");

var testSrc = "test/**/test_*.js";

module.exports = function(gulp, depends) {
  function runTests() {
    return gulp.src(testSrc, {
      read: false
    })
    .pipe(mocha({
      reporter: "spec"
    }));
  }

  gulp.task("test", depends, function (cb) {
    gulp.src(["*.js", "lib/**/*.js", "test/*.js"])
    .pipe(istanbul()) // Covering files
    .pipe(istanbul.hookRequire()) // Force `require` to return covered files
    .on("finish", function () {
      runTests()
      .pipe(istanbul.writeReports()) // Creating the reports after tests runned
      .pipe(istanbul.enforceThresholds({
        thresholds: {
          global: {
            statements: 95.05,
            branches: 86.64,
            functions: 97.14,
            lines: 95.05
          }
        }
      }))
      .on("end", cb)
      .on("error", function(e) {
        console.error(e.toString());
        process.exit(1);
      });
    });
  });

  gulp.task("test:uncovered", depends, runTests);
};
