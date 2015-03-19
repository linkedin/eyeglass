"use strict";

var Eyeglass = require("./index");

module.exports = function(options) {
  var eg = new Eyeglass(options);
  return eg.sassOptions();
};
