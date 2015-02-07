'use strict';

var module_importer = require("./module_importer");


var normalize_options = function(options) {
 if (!options.root) options.root = process.cwd();
 options.importer = module_importer(options, options.importer);
 return options;
}

/*
 * options: Everything node-sass supports, plus:
 * @option root The root of the project. Defaults to the current working directory.
 *
 */
module.exports = function(options) {
  return normalize_options(options);
}

