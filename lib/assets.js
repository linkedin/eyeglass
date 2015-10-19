"use strict";

var fs = require("fs");
var fse = require("fs-extra");
var glob = require("glob");
var path = require("path");
var unquote = require("./util/unquote");
var merge = require("lodash.merge");

// Returns whether a file exists.
function existsSync(file) {
  // This fs method is going to be deprecated
  // but can be re-implemented with fs.accessSync later.
  return fs.existsSync(file);
}

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
  if (existsSync(srcPath) && !fs.statSync(srcPath).isDirectory()) {
    throw new Error("Expected " + srcPath + " to be a directory.");
  }
  this.name = opts.name || null;
  this.httpPrefix = opts.httpPrefix || opts.name;
  this.srcPath = srcPath;
  this.pattern = opts.pattern || "**/*";
  this.globOpts = merge({}, this.defaultGlobOpts);
  if (opts.globOpts) {
    this.globOpts = merge(this.globOpts, opts.globOpts);
  }
  this.globOpts.cwd = this.srcPath; // cannot be overridden by globOpts
  this.globOpts.root = this.srcPath; // cannot be overridden by globOpts
}

function quoted(string) {
  return string ? '"' + string + '"' : string;
}

function resolveModuleName(assetPathEntry, defaultName) {
  return assetPathEntry.name || defaultName;
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
      // TODO: handle windows error
      var uri = self.httpPrefix;
      var moduleName = resolveModuleName(self, defaultName);

      // TODO: do this in a helper function
      if (uri && moduleName) {
        uri = uri + "/" + moduleName;
      } else if (moduleName) {
        uri = moduleName;
      }

      if (uri) {
        uri = uri + "/" + file;
      } else {
        uri = file;
      }

      assetMap.push('"' + file + '": (filepath: "' + path.join(self.srcPath, file) + '", ' +
                                     'uri: "' + uri + '")');
    });
    return "@include asset-register-all(" +
             (quoted(resolveModuleName(this, defaultName)) || "null") + ", " +
             "(" + assetMap.join(",\n  ") + "));";
  },
  toString: function() {
    return this.srcPath + "/" + this.pattern;
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

function resolveAssetDefaults(sass, sassUtils, registeredAssetsMap, relativePathString) {
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

function httpJoin() {
  var joined = [];
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i]) {
      joined.push(arguments[i]);
    }
  }
  var result = joined.join("/");
  result = result.replace("///", "/");
  result = result.replace("//", "/");
  return result;
}

function resolveAsset(eyeglass, sass, sassUtils, registeredAssetsMap, relativePathString, cb) {
  var data = resolveAssetDefaults(sass, sassUtils, registeredAssetsMap, relativePathString);

  if (data) {
    var uri = data.coerce.get("uri");
    var filepath = data.coerce.get("filepath");
    var fullUri = httpJoin(
                    eyeglass.options.httpRoot,
                    eyeglass.options.assetsHttpPrefix,
                    uri);

    eyeglass.assets.resolve(filepath, fullUri, function(error, assetUriInfo) {
      if (error) {
        cb(error);
      } else {
        // handle a string here?
        var combined = assetUriInfo.path;
        if (eyeglass.options.assetsRelativeTo) {
          combined = path.relative(eyeglass.options.assetsRelativeTo, assetUriInfo.path);
        }
        if (assetUriInfo.query) {
          combined = combined + "?" + assetUriInfo.query;
        }
        eyeglass.assets.install(filepath, assetUriInfo.path, function(installError, newFilepath) {
          if (installError) {
            cb(installError);
          } else {
            cb(null, combined, newFilepath);
          }
        });
      }
    });
  } else {
    cb(new Error("Asset not found: " + relativePathString.getValue()));
  }
}


module.exports = function(eyeglass, sass) {
  var sassUtils = require("node-sass-utils")(sass);
  var mainCollection = new AssetCollection();
  mainCollection.AssetCollection = AssetCollection;
  mainCollection.AssetPathEntry = AssetPathEntry;
  mainCollection.export = newExportableAssetCollection;
  mainCollection.resolveAsset = function(registeredAssetsMap, relativePathString, cb) {
    resolveAsset(eyeglass, sass, sassUtils, registeredAssetsMap, relativePathString, cb);
  };

  mainCollection.resolve = function(assetFile, assetUri, cb) {
    cb(null, {path: assetUri});
  };

  mainCollection.resolver = function(aResolver) {
    var oldResolver = this.resolve;
    this.resolve = function(assetFile, assetUri, cb) {
      aResolver(assetFile, assetUri, oldResolver, cb);
    };
  };

  mainCollection.install = function(assetFile, assetUri, cb) {
    if (eyeglass.options.buildDir) {
      if (assetUri.substring(0, eyeglass.options.httpRoot.length) === eyeglass.options.httpRoot) {
        assetUri = assetUri.substring(eyeglass.options.httpRoot.length);
      }

      if (path.sep !== "/") {
        assetUri = assetUri.split("/").join(path.sep);
      }

      var dest = path.join(eyeglass.options.buildDir, assetUri);
      fse.copy(assetFile, dest, function(error) {
        if (error) {
          cb(error);
        } else {
          cb(null, dest);
        }
      });
    } else {
      cb(null, assetFile);
    }
  };

  mainCollection.installer = function(anInstaller) {
    var oldInstaller = this.install;
    this.install = function(assetFile, assetUri, cb) {
      anInstaller(assetFile, assetUri, oldInstaller, cb);
    };
  };

  return mainCollection;
};
