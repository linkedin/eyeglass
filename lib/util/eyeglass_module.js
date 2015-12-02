"use strict";

var merge = require("lodash.merge");

function EyeglassModule(mod) {
  return merge({
    isEyeglassModule: true,
    rawName: mod && mod.name,
    eyeglass: {}
  }, mod);
}

module.exports = EyeglassModule;
