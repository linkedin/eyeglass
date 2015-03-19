"use strict";

var importer = require("./module_importer");
var customFunctions = require("./function_loader");

function Eyeglass(options, sass) {
  sass = sass || require("node-sass");
  this.options = this.normalizeOptions(sass, options);
}

Eyeglass.prototype = {
  defaultRoot: function() {
    return process.cwd();
  },
  root: function() {
    return this.options.root;
  },
  sassOptions: function() {
    // TODO remove eyeglass specific options or maybe namespace them?
    return this.options;
  },
  normalizeOptions: function(sass, options) {
    options.root = options.root || this.defaultRoot();
    options.importer = importer(this, sass, options, options.importer);
    options.functions = customFunctions(this, sass, options, options.functions);
    return options;
  }
};

/*
 * options: Everything node-sass supports, plus:
 * @option root The root of the project. Defaults to the process.cwd
 *
 */
module.exports = function(options) {
  return new Eyeglass(options);
};
