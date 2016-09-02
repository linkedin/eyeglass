"use strict";

var merge = require("lodash.merge");

module.exports = function(eyeglass, sass) {
  return ["asset-uri", "normalize-uri", "version", "fs"].reduce(function(functions, name) {
    return merge(
      functions,
      require("./" + name)(eyeglass, sass)
    );
  }, {});
};
