"use strict";

var fs = require("fs");
var glob = require("glob");
var path = require("path");
var hash = require("./util/hash");
var unquote = require("./util/unquote");


/* class AssetPathEntry
 *
 * srcPath - directory where assets are sourced.
 * Option: name [Optional] - The logical name of this path entry. When specified,
 *   the source url of an asset in this directory will be of the form
 *   "<name>/path/relativeTo/srcPath.ext".
 * Option: httpPrefix [Optional] - The http prefix where the assets url should be anchored
 *   "url(<httpPrefix>/path/relativeTo/srcPath.ext)". Defaults to "/<name>" or just "/"
 *   when there is no name.
 * Option: pattern [Optional] - A glob pattern that controls what files can be in this asset path.
 *   Defaults to "**\/*".
 * Option: globOpts [Optional] - Options to use for globbing.
 *   See: https://github.com/isaacs/node-glob#options
 */
function AssetPathEntry(srcPath, opts) {
  opts = opts || {};
  if (!fs.statSync(srcPath).isDirectory()) {
    throw new Error("Expected " + srcPath + " to be a directory.");
  }
  this.name = opts.name || null;
  this.httpPrefix = opts.httpPrefix || opts.name;
  this.srcPath = srcPath;
  this.pattern = opts.pattern || "**/*";
  this.globOpts = {};
  hash.merge(this.globOpts, this.defaultGlobOpts);
  if (opts.globOpts) {
    hash.merge(this.globOpts, opts.globOpts);
  }
  this.globOpts.cwd = this.srcPath; // cannot be overridden by globOpts
  this.globOpts.root = this.srcPath; // cannot be overridden by globOpts
}

function quoted(string) {
  return string ? '"' + string + '"' : string;
}

AssetPathEntry.prototype = {
  defaultGlobOpts: {
    follow: true,
    nodir: true
  },
  asRegistrationString: function(defaultName) {
    var files = glob.sync(this.pattern, this.globOpts);
    var assetMap = [];
    var self = this;
    files.forEach(function(file) {
      assetMap.push('"' + file + '": "' + path.join(self.srcPath, file) + '"');
    });
    return "@include register-assets(" +
             (quoted(this.name) || quoted(defaultName) || "null") + ", " +
             "(" + assetMap.join(",\n  ") + "));";
  },
  toString: function() {
    return "<" + this.pattern + " within " + this.sourcePath + ">";
  }
};


function AssetCollection() {
  this.assetPath = [];
}

AssetCollection.prototype = {
  /* See: AssetPathEntry */
  addSource: function(srcPath, opts) {
    this.assetPath.push(new AssetPathEntry(srcPath, opts));
    return this;
  },
  asAssetImport: function (defaultName) {
    var scssString = ['@import "eyeglass/assets";'];
    this.assetPath.forEach(function(pathEntry) {
      scssString.push(pathEntry.asRegistrationString(defaultName));
    });
    var importString = scssString.join("\n");
    return importString;
  }
};

function chainableExport(srcPath, opts) {
  return this.addSource(srcPath, opts);
}

function newExportableAssetCollection(srcPath, opts) {
    var assets = new AssetCollection();
    assets.export = chainableExport;
    return assets.export(srcPath, opts);
}


function resolveAssetToPath(sass, sassUtils, registeredAssetsMap, relativePathString) {
  registeredAssetsMap = sassUtils.handleEmptyMap(registeredAssetsMap);
  sassUtils.assertType(registeredAssetsMap, "map");
  sassUtils.assertType(relativePathString, "string");

  var relativePath = unquote(relativePathString.getValue());
  var registeredAssets = sassUtils.castToJs(registeredAssetsMap);

  var appAssets = registeredAssets.coerce.get(null);
  if (appAssets) {
    // XXX sassUtils.assertType(appAssets, "map");
    var appAsset = appAssets.coerce.get(relativePath);
    if (appAsset) {
      return appAsset;
    }
  }

  var segments = relativePath.split("/");
  var moduleName = segments[0];
  var moduleRelativePath = segments.slice(1).join("/");
  var moduleAssets = registeredAssets.coerce.get(moduleName);
  if (moduleAssets) {
    // XXX sassUtils.assertType(moduleAssets, "map");
    return moduleAssets.coerce.get(moduleRelativePath);
  }
}


module.exports = function(sass) {
  var sassUtils = require("node-sass-utils")(sass);
  var mainCollection = new AssetCollection();
  mainCollection.AssetCollection = AssetCollection;
  mainCollection.AssetPathEntry = AssetPathEntry;
  mainCollection.export = newExportableAssetCollection;
  mainCollection.resolveAssetToPath = function(registeredAssetsMap, relativePathString) {
    return resolveAssetToPath(sass, sassUtils, registeredAssetsMap, relativePathString);
  };
  return mainCollection;
};
