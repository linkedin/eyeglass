"use strict";

var discover = require("../util/discover");
var unquote = require("../util/unquote");

// REFACTOR ME: this is copy pasta from module_importer.js
function eyeglassName(moduleDef) {
  return (moduleDef.eyeglass &&
         typeof moduleDef.eyeglass == "object" &&
         moduleDef.eyeglass.name) ||
         moduleDef.name;
}



module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-version($module: eyeglass)": function(moduleName, done) {
      var name = unquote(moduleName.getValue());
      var modules = discover.all(eyeglass.root()).modules; // TODO Cache this value?
      var mod;
      for (var i = 0; i < modules.length; i++) {
        if (eyeglassName(modules[i]) === name) {
          mod = modules[i];
          break;
        }
      }
      if (mod) {
        done(sass.types.String('"' + (mod.version || "versonless") + '"'));
      } else {
        done(sass.types.Null());
      }
    }
  };
};
