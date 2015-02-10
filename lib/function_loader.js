'use strict';

var discover = require('./util/discover');
var hash = require('./util/hash');

function auto_discover_modules(root) {
  return discover.simple(root);
};

function check_for_conflicts(obj1, obj2) {
  var keys = {}
  for (var attr in obj1) {
    if (obj1.hasOwnProperty(attr)) {
      keys[attr.replace(/\(.*\)$/, '')] = attr
    }
  }
  for (var attr in obj2) {
    if (obj2.hasOwnProperty(attr)) {
      var fn_name = attr.replace(/\(.*\)$/, '');
      if (keys[fn_name] && keys[fn_name] != attr) {
        // Better way to report warnings.
        console.log("WARNING: Function " + fn_name + " was redeclared with conflicting function signatures: " + keys[fn_name] + " vs. " + attr);
      }
    }
  }
}

module.exports = function(eyeglass, sass, options, existing_functions) {
  var root = options.root;
  var functions = {};

  var modules = auto_discover_modules(root);

  modules.forEach(function(m)  {
    var obj = require(m)(eyeglass, sass);
    if (obj.functions) {
      check_for_conflicts(functions, obj.functions);
      hash.merge_into(functions, obj.functions);
    }
  });

  check_for_conflicts(functions, existing_functions);
  hash.merge_into(functions, existing_functions);
  return functions;
}
