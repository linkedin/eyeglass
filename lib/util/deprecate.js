"use strict";

function isEnabled() {
  return (process.env.EYEGLASS_DEPRECATIONS !== "false");
}

function deprecate() {
  if (isEnabled()) {
    console.warn.apply(console.warn, ["[eyeglass:deprecation]"].concat([].slice.call(arguments)));
  }
}

module.exports = deprecate;
module.exports.isEnabled = isEnabled;
