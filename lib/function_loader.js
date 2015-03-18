"use strict";

var discover = require("./util/discover");
var syncFn = require("./util/sync_fn");
var hash = require("./util/hash");
var ARGUMENTS_REGEX = /\(.*\)$/;

function autoDiscoverModules(root) {
  return discover.simple(root);
}

function checkConflicts(obj1, obj2) {
  var keys = {};
  var attr;
  for (attr in obj1) {
    if (obj1.hasOwnProperty(attr)) {
      keys[attr.replace(ARGUMENTS_REGEX, "")] = attr;
    }
  }
  for (attr in obj2) {
    if (obj2.hasOwnProperty(attr)) {
      var fnName = attr.replace(ARGUMENTS_REGEX, "");
      if (keys[fnName] && keys[fnName] !== attr) {
        // Better way to report warnings.
        console.warn("WARNING: Function " + fnName +
          " was redeclared with conflicting function signatures: " +
          keys[fnName] + " vs. " + attr);
      }
    }
  }
}

module.exports = function(eyeglass, sass, options, existingFunctions) {
  var root = options.root;
  var functions = {};
  var modules = autoDiscoverModules(root);

  modules.forEach(function(m) {
    var obj = require(m)(eyeglass, sass);
    if (obj.functions) {
      checkConflicts(functions, obj.functions);
      hash.merge(functions, obj.functions);
    }
  });

  checkConflicts(functions, existingFunctions);
  hash.merge(functions, existingFunctions);

  functions = syncFn.all(functions);

  return functions;
};
