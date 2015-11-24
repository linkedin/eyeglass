"use strict";
var semver = require("semver");

function Deprecator(options) {
  this.ignoreDeprecations = options && options.eyeglass && options.eyeglass.ignoreDeprecations;
}

Deprecator.prototype.isEnabled = function(sinceVersion) {
  // if `enabled` is undefined, try to set it
  if (this.enabled === undefined) {
    // if `disableDeprecations`, we fallback to the env variable
    if (this.ignoreDeprecations === undefined) {
      // return early and don't set `enabled`, as we'll check the env everytime
      return !semver.lte(sinceVersion, process.env.EYEGLASS_DEPRECATIONS);
    }
    this.enabled = !semver.lte(sinceVersion, this.ignoreDeprecations || "0.0.0");
  }

  return this.enabled;
};

Deprecator.prototype.deprecate = function(sinceVersion, removeVersion, message) {
  if (this.isEnabled(sinceVersion)) {
    console.warn(
      "[eyeglass:deprecation]",
       "(deprecated in " + sinceVersion + ", will be removed in " + removeVersion + ")",
       message);
  }
};

module.exports = function(options) {
  var deprecator = new Deprecator(options);
  return deprecator.deprecate.bind(deprecator);
};
