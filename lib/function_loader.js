"use strict";

var syncFn = require("./util/sync_fn");
var debug = require("./util/debug");
var merge = require("lodash.merge");
var ARGUMENTS_REGEX = /\(.*\)$/;
var DELIM = "\n\t\u2022 ";

function checkConflicts(obj1, obj2) {
  var keys = {};
  var attr;
  for (attr in obj1) {
    /* istanbul ignore else - hasOwnProperty */
    if (obj1.hasOwnProperty(attr)) {
      keys[attr.replace(ARGUMENTS_REGEX, "")] = attr;
    }
  }
  for (attr in obj2) {
    /* istanbul ignore else - hasOwnProperty */
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
  var functions = eyeglass.modules.list.reduce(function(fns, mod) {
    if (!mod.functions) {
      return fns;
    }

    // log any functions found in this module
    debug.functions(
      "functions discovered in module %s:%s%s",
      mod.name,
      DELIM,
      Object.keys(mod.functions).join(DELIM)
    );
    checkConflicts(fns, mod.functions);
    return merge(fns, mod.functions);
  }, {});

  checkConflicts(functions, existingFunctions);
  functions = merge(functions, existingFunctions);

  functions = syncFn.all(functions);

  // log all the functions we discovered
  debug.functions(
    "all discovered functions:%s%s",
    DELIM,
    Object.keys(functions).join(DELIM)
  );
  return functions;
};
