"use strict";

var EyeglassModules = require("./util/eyeglass_modules");
var makeModuleImporter = require("./module_importer");
var makeAssetImporter = require("./assets_importer");
var loadFunctions = require("./function_loader");
var merge = require("lodash.merge");
var engineChecks = require("./semver_checker");
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

  this.modules = new EyeglassModules(this.options.root);

  if (!existsSync(this.options.cacheDir)) {
    fs.mkdir(this.options.cacheDir);
  }

  engineChecks(this, sass, options);

  checkMissingDependencies.call(this);
}

Eyeglass.prototype = {
  defaultRoot: function() {
    return process.cwd();
  },
  defaultCacheDir: function(root) {
    return path.join(root, ".eyeglass_cache");
  },
  defaultIncludePaths: function() {
    if (process.env.SASS_PATH) {
      return process.env.SASS_PATH.split(path.delimiter);
    } else {
      return [];
    }
  },
  root: function() {
    return this.options.root;
  },
  sassOptions: function() {
    // TODO remove eyeglass specific options or maybe namespace them?
    var opts = merge({}, this.options);
    opts.eyeglass = this;

    var assetImporter = makeAssetImporter(this, this.sass, opts, opts.importer);
    opts.importer = makeModuleImporter(this, this.sass, opts, assetImporter);
    opts.functions = loadFunctions(this, this.sass, opts, opts.functions);

    return opts;
  },
  normalizeOptions: function(options) {
    options.root = options.root || this.defaultRoot();

    // cacheDir is a hidden directory where eyeglass modules can save files
    options.cacheDir = options.cacheDir || this.defaultCacheDir(options.root);
    options.httpRoot = options.httpRoot || "/";
    options.includePaths = options.includePaths || this.defaultIncludePaths();
    // in some cases includePaths is a path delimited string
    if (typeof options.includePaths === "string") {
      options.includePaths = options.includePaths.split(path.delimiter);
    }
    return options;
  }
};

function decorator(options) {
  return (new Eyeglass(options)).sassOptions();
}

function checkMissingDependencies() {
  var missing = this.modules.issues.dependencies.missing;
  if (missing.length) {
    var warning = ["The following dependencies were not found:"];
    warning.push.apply(warning, missing.map(function(dep) {
      return "  " + dep;
    }));
    warning.push("You might need to `npm install` the above.");
    console.warn(warning.join("\n"));
  }
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
