"use strict";

var mocha = require("gulp-mocha");

module.exports = function(gulp, depends) {
  gulp.task("test", depends, function() {
    return gulp.src([
      "test/**/test_*.js"
      ], {read: false})
        .pipe(mocha({reporter: "spec"}));
  });
};
