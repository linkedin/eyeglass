'use strict';

var module_importer = require("./module_importer");
var function_loader = require("./function_loader");
var sass = require("node-sass");


var normalize_options = function(eyeglass, sass, options) {
 if (!options.root) options.root = process.cwd();
 options.importer = module_importer(eyeglass, sass, options, options.importer);
 options.functions = function_loader(eyeglass, sass, options, options.functions);
 return options;
}

/*
 * options: Everything node-sass supports, plus:
 * @option root The root of the project. Defaults to the current working directory.
 *
 */
module.exports = function(options) {
  var eyeglass_object = {};
  return normalize_options({}, sass, options);
}
