"use strict";

var importer = require("./module_importer");
var customFunctions = require("./function_loader");
var nodeSass = require("node-sass");


function normalizeOptions(eyeglass, sass, options) {
 if (!options.root) {
   options.root = process.cwd();
 }
 options.importer = importer(eyeglass, sass, options, options.importer);
 options.functions = customFunctions(eyeglass,
                                     sass,
                                     options,
                                     options.functions);
 return options;
}

/*
 * options: Everything node-sass supports, plus:
 * @option root The root of the project. Defaults to the process.cwd
 *
 */
module.exports = function(options) {
  var eyeglassObject = {};
  return normalizeOptions(eyeglassObject, nodeSass, options);
};
