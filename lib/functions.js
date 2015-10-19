"use strict";

var merge = require("lodash.merge");

module.exports = function(eyeglass, sass) {
  return ["asset_url", "version"].reduce(function(functions, name) {
    return merge(
      functions,
      require("./functions/" + name)(eyeglass, sass)
    );
  }, {});
};
