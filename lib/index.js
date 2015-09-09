"use strict";

var makeModuleImporter = require("./module_importer");
var makeAssetImporter = require("./assets_importer");
var customFunctions = require("./function_loader");
var hash = require("./util/hash");
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
  this.options = this.normalizeOptions(options);
  this.enableImportOnce = true;
  this.assetPath = [];

  if (!existsSync(this.options.cacheDir)) {
    fs.mkdir(this.options.cacheDir);
  }
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
    var opts = {};
    hash.merge(opts, this.options);
    opts.eyeglass = this;

    var assetImporter = makeAssetImporter(this, this.sass, opts, opts.importer);
    opts.importer = makeModuleImporter(this, this.sass, opts, assetImporter);
    opts.functions = customFunctions(this, this.sass, opts, opts.functions);
    return opts;
  },
  normalizeOptions: function(options) {
    options.root = options.root || this.defaultRoot();
    // cacheDir is a hidden directory where eyeglass modules can save files
    options.cacheDir = options.cacheDir || this.defaultCacheDir(options.root);
    options.httpRoot = options.httpRoot || "/";

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
