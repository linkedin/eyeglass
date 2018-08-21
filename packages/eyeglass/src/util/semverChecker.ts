"use strict";

module.exports = function(eyeglass, sass, options, version) {
  var strictMode = options.strictModuleVersions;
  var modules = eyeglass.modules;
  var issues = modules.issues.engine;
  var missing;
  var incompatible;

  // default to `warn`
  strictMode = (typeof strictMode === "undefined") ? "warn" : strictMode;

  // return early if not strictMode
  if (!strictMode) {
    return;
  }

  // if there are incompatible needs...
  if (issues.incompatible.length) {
    incompatible = ["The following modules are incompatible with eyeglass " + version + ":"];
    incompatible.push.apply(incompatible, issues.incompatible.map(function(mod) {
      return "  " + mod.name + " needed eyeglass " + mod.eyeglass.needs;
    }));

    console.error(incompatible.join("\n"));
  }

  // if there are missing needs...
  if (issues.missing.length) {
    missing = ["The following modules did not declare an eyeglass version:"];
    missing.push.apply(missing, issues.missing.map(function(mod) {
      return "  " + mod.name;
    }));
    missing.push("Please add the following to the module's package.json:");
    missing.push("  \"eyeglass\": { \"needs\": \"^" + version + "\" }");

    console.warn(missing.join("\n"));
  }

  // if have any issues and `strictMode === true`...
  if ((incompatible || missing) && strictMode === true) {
    // throw an error
    throw new Error("Cannot proceed with errors/warning and options.strictModuleVersions");
  }
};
