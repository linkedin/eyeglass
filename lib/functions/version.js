"use strict";

var discover = require("../util/discover");
var unquote = require("../util/unquote");

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-version($module: eyeglass)": function(moduleName, done) {
      var name = unquote(moduleName.getValue());
      var moduleDef;

      // optimization if the name is `eyeglass` itself
      if (name === "eyeglass") {
        moduleDef = discover.getEyeglassDef();
      } else {
        // find the requested module
        discover.all(eyeglass.root()).modules.some(function(mod) {
          if (mod.eyeglassName === name) {
            moduleDef = mod;
            return true;
          }
        });
      }

      if (moduleDef) {
        // TODO - why do we quote it?
        done(sass.types.String('"' + (moduleDef.version || "unversioned") + '"'));
      } else {
        done(sass.types.Null());
      }
    }
  };
};
