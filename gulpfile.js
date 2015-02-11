var gulp = require("gulp");

require("./build/lint")(gulp);
require("./build/test")(gulp);
