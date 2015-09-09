"use strict";

var semver = require("semver");
var pkg = require("../package.json");
var discover = require("./util/discover");

function autoDiscoverModules(root) {
  return discover.all(root).modules;
}

module.exports = function(eyeglass, sass, options) {
  var root = options.root;
  var strictMode = options.strictModuleVersions;
  var modules = autoDiscoverModules(root);

  var incompatible = {};
  var noEngine = [];
  var hasErrors = false;
  var hasWarnings = false;

  strictMode = (typeof strictMode === "undefined") ? "warn" : strictMode;

  modules.forEach(function(m) {
    if (!m.eyeglass || !m.eyeglass.needs) {
      hasWarnings = true;
      noEngine.push(m.name);
    } else {
      if (!semver.satisfies(pkg.version, m.eyeglass.needs)) {
        hasErrors = true;
        incompatible[m.name] = m.eyeglass.needs;
      }
    }
  });

  if (!hasErrors && !hasWarnings) {
    return;
  }

  var errors = [];
  errors.push("The following modules are incompatible with eyeglass " + pkg.version + ":");
  Object.keys(incompatible).forEach(function(m) {
    errors.push("  " + m + " needed eyeglass " + incompatible[m]);
  });

  var warnings = [];
  warnings.push("The following modules did not declare an eyeglass version:");
  noEngine.forEach(function(m) {
    warnings.push("  " + m);
  });
  warnings.push("Please add the following to the module's package.json:");
  warnings.push("  \"eyeglass\": { \"needs\": \"^" + pkg.version + "\" }");

  if (hasErrors && strictMode) {
    console.error(errors.join("\n"));
  }

  if (hasWarnings && strictMode) {
    console.warn(warnings.join("\n"));
  }

  if ((hasErrors || hasWarnings) && strictMode === true) {
    throw new Error("Cannot proceed with errors/warning and options.strictModuleVersions");
  }
};

module.exports.eyeglassVersion = pkg.version;
