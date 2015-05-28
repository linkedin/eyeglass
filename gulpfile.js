var gulp = require("gulp");

require("./build/lint")(gulp, []);
require("./build/test")(gulp, ["lint"]);
require("./build/coverage")(gulp, []);

gulp.task("default", ["test"]);
