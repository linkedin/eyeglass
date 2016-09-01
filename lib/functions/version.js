"use strict";

var stringUtils = require("../util/strings");

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-version($module: eyeglass)": function(moduleName) {
      var name = stringUtils.unquote(moduleName.getValue());
      var mod = eyeglass.modules.find(name);

      if (mod) {
        return sass.types.String(mod.version || "unversioned");
      } else {
        return sass.types.Null();
      }
    }
  };
};
