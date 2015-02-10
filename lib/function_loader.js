'use strict';

var discover = require('./util/discover');
var hash = require('./util/hash');

function auto_discover_modules(root) {
  return discover.simple(root);
};

module.exports = function(eyeglass, sass, options, existing_functions) {
  var root = options.root;
  var functions = {};
  hash.merge_into(functions, existing_functions);

  var modules = auto_discover_modules(root);

  modules.forEach(function(m)  {
    var obj = require(m)(eyeglass, sass);
    // XXX collision detection?
    if (obj.functions) hash.merge_into(functions, obj.functions);
  });
  return functions;
}
