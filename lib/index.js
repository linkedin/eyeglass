"use strict";

var importer = require("./module_importer");
var customFunctions = require("./function_loader");
var path = require("path");
var fs = require("fs");

function existsSync(file) {
  // This fs method is going to be deprecated
  // but can be re-implemented with fs.accessSync later.
  return fs.existsSync(file);
}

function AssetLocation(sourceDir, httpDir, buildDir) {
  this.sourceDir = sourceDir;
  this.httpDir = httpDir;
  this.buildDir = buildDir;
}

AssetLocation.prototype = {
};

function Eyeglass(options, sass) {
  sass = sass || require("node-sass");
  this.options = this.normalizeOptions(sass, options);
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
    options.importer = importer(this, sass, options, options.importer);
    options.functions = customFunctions(this, sass, options, options.functions);
    return options;
  },
  // Register assets to be referenced by asset-url().
  // @param sourceDir The source directory containing assets
  // @param httpDir The directory from where the assets are served to the web.
  // @param buildDir [Optional] The intermediate location where these assets
  //   should be copied during build.
  assets: function(sourceDir, httpDir, buildDir) {
    sourceDir = path.resolve(this.root(), sourceDir);
    buildDir = buildDir && path.resolve(this.root(), buildDir);
    this.assetPath.push(new AssetLocation(sourceDir, httpDir, buildDir));
  },
  PATH_SEPARATOR_REGEX: /\//g,
  // Finds an asset in the asset path.
  findAsset: function(relativePath) {
    // All sass files should use forward slash (/) to separate paths.
    // We translate this to the windows separator if needed.
    if (path.sep !== "/") {
      relativePath = relativePath.replace(this.PATH_SEPARATOR_REGEX, path.sep);
    }
    // Look for this file in all the locations
    for (var i = 0; i < this.assetPath.length; i++) {
      var pathEntry = this.assetPath[i];
      var fullSourcePath = path.join(pathEntry.sourceDir, relativePath);
      if (existsSync(fullSourcePath)) {
        // TODO URL formatting
        // TODO Asset installation
        return pathEntry;
      }
    }
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
