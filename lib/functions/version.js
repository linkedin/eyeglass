"use strict";

var unquote = require("../util/unquote");

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-version($module: eyeglass)": function(moduleName) {
      var name = unquote(moduleName.getValue());
      var mod = eyeglass.modules.find(name);

      if (mod) {
        // TODO - why do we quote this?
        return sass.types.String('"' + (mod.version || "unversioned") + '"');
      } else {
        return sass.types.Null();
      }
    }
  };
};
