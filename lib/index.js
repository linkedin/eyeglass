"use strict";

var makeModuleImporter = require("./module_importer");
var makeAssetImporter = require("./assets_importer");
var customFunctions = require("./function_loader");
var fs = require("fs");
var path = require("path");

// Returns whether a file exists.
function existsSync(file) {
  // This fs method is going to be deprecated but can be re-implemented with fs.accessSync later.
  return fs.existsSync(file);
}

function Eyeglass(options, sass) {
  this.sass = sass || require("node-sass");
  this.assets = require("./assets")(this, this.sass);
  this.options = this.normalizeOptions(this.sass, options);
  this.enableImportOnce = true;
  this.assetPath = [];
}

Eyeglass.prototype = {
  defaultRoot: function() {
    return process.cwd();
  },
  defaultCacheDir: function(root) {
    return path.join(root, ".eyeglass_cache");
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
    // cacheDir is a hidden directory where eyeglass modules can save files
    options.cacheDir = options.cacheDir || this.defaultCacheDir(options.root);

    if (!existsSync(options.cacheDir)) {
      fs.mkdir(options.cacheDir);
    }

    var assetImporter = makeAssetImporter(this, sass, options, options.importer);
    options.importer = makeModuleImporter(this, sass, options, assetImporter);
    options.functions = customFunctions(this, sass, options, options.functions);
    options.eyeglass = this;
    return options;
  }
};

function decorator(options) {
  return (new Eyeglass(options)).sassOptions();
}

/*
 * options: Everything node-sass supports, plus:
 * @option root The root of the project. Defaults to the process.cwd
 * @option assetsHttpPrefix Where assets should be served from. Relative to "/"
 * @option buildDir Where assets should be installed so they can be served.
 */
module.exports = {
  Eyeglass: Eyeglass,
  decorate: decorator
};
