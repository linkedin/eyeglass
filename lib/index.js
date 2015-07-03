"use strict";

var makeModuleImporter = require("./module_importer");
var makeAssetImporter = require("./assets_importer");
var customFunctions = require("./function_loader");

function Eyeglass(options, sass) {
  this.sass = sass || require("node-sass");
  this.assets = require("./assets")(this.sass);
  this.options = this.normalizeOptions(this.sass, options);
  this.enableImportOnce = true;
  this.assetPath = [];
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
    var assetImporter = makeAssetImporter(this, sass, options, options.importer);
    options.importer = makeModuleImporter(this, sass, options, assetImporter);
    options.functions = customFunctions(this, sass, options, options.functions);
    return options;
  }
};

/*
 * options: Everything node-sass supports, plus:
 * @option root The root of the project. Defaults to the process.cwd
 *
 */
module.exports = function(options, sass) {
  return new Eyeglass(options, sass);
};
