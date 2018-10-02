"use strict";

var syncFn = require("../util/sync");
var debug = require("../util/debug");
var merge = require("lodash.merge");
var ARGUMENTS_REGEX = /\s*\(.*\)$/;
var DELIM = "\n\t\u2022 ";

function getFunctionName(fnSignature) {
  return fnSignature.replace(ARGUMENTS_REGEX, "");
}

function checkConflicts(obj1, obj2) {
  // return early if either collection is empty
  if (!obj1 || !obj2) {
    return;
  }

  var functions = {};
  // collect all the function names and signatures from the first collection
  Object.keys(obj1).forEach(function(fn) {
    var fnName = getFunctionName(fn);
    functions[fnName] = fn;
  });

  // check all the function names and signatures from the second collection
  Object.keys(obj2).forEach(function(fn) {
    var fnName = getFunctionName(fn);
    var currentFunction = functions[fnName];
    // if the current signature does not match the new signature...
    if (currentFunction && currentFunction !== fn) {
      // throw a warning
      console.warn("WARNING: Function " + fnName +
        " was redeclared with conflicting function signatures: " +
        currentFunction + " vs. " + fn);
    }
  });
}

function ModuleFunctions(eyeglass, sass, options, existingFunctions) {
  var functions = eyeglass.modules.list.reduce(function(fns, mod) {
    if (!mod.functions) {
      return fns;
    }

    // log any functions found in this module
    /* istanbul ignore next - don't test debug */
    debug.functions && debug.functions(
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
  /* istanbul ignore next - don't test debug */
  debug.functions && debug.functions(
    "all discovered functions:%s%s",
    DELIM,
    Object.keys(functions).join(DELIM)
  );
  return functions;
}

module.exports = ModuleFunctions;
