'use strict';

var discover = require('./util/discover');

function merge_into(obj1, obj2) {
  for (var attr in obj2) {
    if (obj2.hasOwnProperty(attr)) obj1[attr] = obj2[attr];
  }
}

function auto_discover_modules(root) {
  return discover.simple(root);
};

module.exports = function(eyeglass, sass, options, existing_functions) {
  var root = options.root;
  var functions = {};
  merge_into(functions, existing_functions);

  var modules = auto_discover_modules(root);

  modules.forEach(function(m)  {
    var obj = require(m)(eyeglass, sass);
    // XXX collision detection?
    if (obj.functions) merge_into(functions, obj.functions);
  });
  return functions;
}
