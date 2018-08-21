"use strict";

var debug = require("debug");
var PREFIX = "eyeglass:";

module.exports = ["import", "modules", "functions", "assets"].reduce(function(obj, item) {
  obj[item] = debug(PREFIX + item);
  return obj;
}, {});
