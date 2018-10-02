"use strict";

var fs = require("fs-extra");
var path = require("path");
var URI = require("../util/URI");
var debug = require("../util/debug");
var ensureSymlink = require("ensure-symlink");
var AssetsCollection = require("./AssetsCollection");
// TODO - remove when deprecated AssetPathEntry is removed
var AssetsSource = require("./AssetsSource");

function Assets(eyeglass, sass) {
  this.sassUtils = require("node-sass-utils")(sass);
  this.eyeglass = eyeglass;
  // create a master collection
  this.collection = new AssetsCollection();
  // and keep a list of module collections
  this.moduleCollections = [];

  // Expose these temporarily for back-compat reasons
  function deprecate(method) {
    eyeglass.deprecate("0.8.3", "0.9.0", [
      "The assets." + method + " interface will be removed from the public API.",
      "If you currently use this method, please open an issue at",
      "https://github.com/sass-eyeglass/eyeglass/issues/ so we can",
      "understand and accomodate your use case"
    ].join(" "));
  }
  this.AssetCollection = function() {
    deprecate("AssetCollection");
    return new AssetsCollection();
  };
  this.AssetPathEntry = function(src, options) {
    deprecate("AssetPathEntry");
    return new AssetsSource(src, options);
  };
}

/**
  * @see AssetsCollection#asAssetImport
  */
Assets.prototype.asAssetImport = function(name) {
  return this.collection.asAssetImport(name);
};

/**
  * @see AssetsCollection#addSource
  */
Assets.prototype.addSource = function(src, opts) {
  return this.collection.addSource(src, opts);
};

/**
  * @see AssetsCollection#cacheKey
  */
Assets.prototype.cacheKey = function(name) {
  return this.collection.cacheKey(name);
};

/**
  * creates a new AssetsCollection and adds the given source
  * @see #addSource
  * @param    {String} src - the source directory
  * @param    {Object} opts - the options
  * @returns  {AssetsCollection} the instance of the AssetsCollection
  */
Assets.prototype.export = function(src, opts) {
  var assets = new AssetsCollection();
  this.moduleCollections.push(assets);
  return assets.addSource(src, opts);
};

/**
  * resolves an asset given a uri
  * @param    {SassMap} $assetsMap - the map of registered Sass assets
  * @param    {SassString} $uri - the uri of the asset
  * @param    {Function} cb - the callback that is invoked when the asset resolves
  */
Assets.prototype.resolveAsset = function($assetsMap, $uri, cb) {
  var options = this.eyeglass.options.eyeglass;
  var assets = this.eyeglass.assets;

  this.sassUtils.assertType($uri, "string");

  // get a URI instance
  var originalUri = $uri.getValue();
  var uri = new URI(originalUri);

  // normalize the uri and resolve it

  var data = resolveAssetDefaults.call(this, $assetsMap, uri.getPath());
  if (data) {
    var filepath = URI.restore(data.coerce.get("filepath"));

    // create the URI
    var fullUri = URI.join(
      options.httpRoot,
      options.assets.httpPrefix,
      data.coerce.get("uri")
    );

    assets.resolve(filepath, fullUri, function(error, assetInfo) {
      if (error) {
        cb(error);
      } else {
        // if relativeTo is set
        if (options.assets.relativeTo) {
          // make the URI relative to the httpRoot + relativeTo path
          uri.setPath(path.relative(
            URI.join(options.httpRoot, options.assets.relativeTo),
            assetInfo.path
          ));
        } else {
          // otherwise, just update it to the path as is
          uri.setPath(assetInfo.path);
        }
        // if a query param was specified, append it to the uri query
        if (assetInfo.query) {
          uri.addQuery(assetInfo.query);
        }

        assets.install(filepath, assetInfo.path, function(error, file) {
          if (error) {
            cb(error);
          } else {
            if (file) {
              /* istanbul ignore next - don't test debug */
              debug.assets && debug.assets(
                "%s resolved to %s with URI %s",
                originalUri,
                path.relative(options.root, file),
                uri.toString()
              );
            }
            cb(null, uri.toString(), file);
          }
        });
      }
    });
  } else {
    cb(new Error("Asset not found: " + uri.getPath()));
  }
};

/**
  * resolves the asset uri
  * @param    {String} assetFile - the source file path
  * @param    {String} assetUri - the resolved uri path
  * @param    {Function} cb - the callback to pass the resolved uri to
  */
Assets.prototype.resolve = function(assetFile, assetUri, cb) {
  cb(null, {
    path: assetUri
  });
};

/**
  * wraps the current resolver with a custom resolver
  * @param    {Function} resolver - the new resolver function
  */
Assets.prototype.resolver = function(resolver) {
  var oldResolver = this.resolve.bind(this);
  this.resolve = function(assetFile, assetUri, cb) {
    resolver(assetFile, assetUri, oldResolver, cb);
  };
};

/**
  * installs the given asset
  * @param    {String} file - the source file path to install from
  * @param    {String} uri - the resolved uri path
  * @param    {Function} cb - the callback invoked after the installation is successful
  */
Assets.prototype.install = function(file, uri, cb) {
  var options = this.eyeglass.options.eyeglass;
  var httpRoot = options.httpRoot;
  if (options.buildDir) {
    // normalize the uri using the system OS path separator
    // and make it relative to the httpRoot
    uri = new URI(uri);
    uri = uri.getPath(path.sep, httpRoot);

    var dest = path.join(options.buildDir, uri);

    try {
      if (options.installWithSymlinks) {
        fs.mkdirpSync(path.dirname(dest));
        ensureSymlink(file, dest);
      } else {
        // we explicitly use copySync rather than copy to avoid starving system resources
        fs.copySync(file, dest);
      }
      cb(null, dest);
    } catch (error) {
      error = new Error("Failed to install asset from " + file + "\n" + error.toString());
      cb(error);
    }
  } else {
    cb(null, file);
  }
};

/**
  * wraps the current installer with a custom installer
  * @param    {Function} installer - the new installer function
  */
Assets.prototype.installer = function(installer) {
  var oldInstaller = this.install.bind(this);
  this.install = function(assetFile, assetUri, cb) {
    installer(assetFile, assetUri, oldInstaller, cb);
  };
};

function resolveAssetDefaults(registeredAssetsMap, relativePath) {
  registeredAssetsMap = this.sassUtils.handleEmptyMap(registeredAssetsMap);
  this.sassUtils.assertType(registeredAssetsMap, "map");

  var registeredAssets = this.sassUtils.castToJs(registeredAssetsMap);

  var appAssets = registeredAssets.coerce.get(null);

  if (appAssets) {
    // XXX sassUtils.assertType(appAssets, "map");
    var appAsset = appAssets.coerce.get(relativePath);
    if (appAsset) {
      return appAsset;
    }
  }

  var segments = relativePath.split("/");
  var moduleName = segments.shift();
  var moduleRelativePath = segments.join("/");
  var moduleAssets = registeredAssets.coerce.get(moduleName);
  if (moduleAssets) {
    // XXX sassUtils.assertType(moduleAssets, "map");
    return moduleAssets.coerce.get(moduleRelativePath);
  }
}

module.exports = Assets;
