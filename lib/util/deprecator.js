"use strict";

function Deprecator(options) {
  this.ignoreDeprecations = options && options.eyeglass && options.eyeglass.ignoreDeprecations;
}

Deprecator.prototype.isEnabled = function() {
  // if `enabled` is undefined, try to set it
  if (this.enabled === undefined) {
    // if `disableDeprecations`, we fallback to the env variable
    if (this.ignoreDeprecations === undefined) {
      // return early and don't set `enabled`, as we'll check the env everytime
      return !(process.env.EYEGLASS_DEPRECATIONS === "false");
    }
    this.enabled = !this.ignoreDeprecations;
  }

  return this.enabled;
};

Deprecator.prototype.deprecate = function() {
  if (this.isEnabled()) {
    console.warn.apply(console.warn, ["[eyeglass:deprecation]"].concat([].slice.call(arguments)));
  }
};

module.exports = function(options) {
  var deprecator = new Deprecator(options);
  return deprecator.deprecate.bind(deprecator);
};
