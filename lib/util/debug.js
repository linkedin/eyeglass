"use strict";

var debug = require("debug");
var PREFIX = "eyeglass:";

module.exports = ["import", "modules", "functions", "assets"].reduce(function(obj, item) {
  var namespace = PREFIX + item;
  /* istanbul ignore if - don't test debug */
  if (debug.enabled(namespace)) {
    obj[item] = debug(namespace);
  }
  return obj;
}, {});
