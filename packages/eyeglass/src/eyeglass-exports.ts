"use strict";

var path = require("path");

module.exports = function(eyeglass, sass) {
  var opts = {
    sassDir: path.join(__dirname, "..", "sass"), // directory where the sass files are.
    functions: require("./functions/index")(eyeglass, sass)
  };
  return opts;
};
