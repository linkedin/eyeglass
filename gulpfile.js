var gulp = require("gulp");

// Know the node-sass we wrap. It's vital to debugging, tests, and coverage reports
console.log(require("node-sass").info);

require("./build/lint")(gulp, []);
require("./build/test")(gulp, ["lint"]);
require("./build/coverage")(gulp, []);

gulp.task("default", ["test"]);
