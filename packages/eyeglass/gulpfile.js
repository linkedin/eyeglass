/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-use-before-define */
var gulp = require("gulp");

// Know the node-sass we wrap. It's vital to debugging, tests, and coverage reports

// eslint-disable-next-line no-console
console.log(require("node-sass").info);

require("./build/site")(gulp, null, __dirname);
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/no-use-before-define */