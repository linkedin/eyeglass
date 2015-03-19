"use strict";

var hash = require("./util/hash");

module.exports = function(eyeglass, sass) {
  var functions = {};
  ["asset_url", "version"].forEach(function(name) {
    var fn = require("./functions/" + name)(eyeglass, sass);
    hash.merge(functions, fn);
  });
  return functions;
};
