"use strict";

var fs = require("fs-extra");
var path = require("path");
var URI = require("../util/URI");

var AssetsCollection = require("./AssetsCollection");

// TODO - doc
function Assets(eyeglass, sass) {
  this.sassUtils = require("node-sass-utils")(sass);
  this.eyeglass = eyeglass;
  // create a master collection
  this.collection = new AssetsCollection();
}

// TODO - doc
Assets.prototype.asAssetImport = function(name) {
  return this.collection.asAssetImport(name);
};

// TODO - doc
Assets.prototype.addSource = function(src, opts) {
  return this.collection.addSource(src, opts);
};

// TODO - doc
Assets.prototype.export = function(src, opts) {
  var assets = new AssetsCollection();
  return assets.addSource(src, opts);
};

// TODO - doc - this function is way too big...
Assets.prototype.resolveAsset = function($assetsMap, $uri, cb) {
  var options = this.eyeglass.options.eyeglass;
  var assets = this.eyeglass.assets;

  this.sassUtils.assertType($uri, "string");

  // get a URI instance
  var uri = new URI($uri.getValue());

  // normalize the uri and resolve it

  var data = resolveAssetDefaults.call(this, $assetsMap, uri.getPath());
  if (data) {
    var filepath = data.coerce.get("filepath");

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
            cb(null, uri.toString(), file);
          }
        });
      }
    });
  } else {
    cb(new Error("Asset not found: " + uri.getPath()));
  }
};

// TODO - doc
Assets.prototype.resolve = function(assetFile, assetUri, cb) {
  cb(null, {
    path: assetUri
  });
};

// TODO - doc
Assets.prototype.resolver = function(resolver) {
  var oldResolver = this.resolve;
  this.resolve = function(assetFile, assetUri, cb) {
    resolver(assetFile, assetUri, oldResolver, cb);
  };
};

// TODO - doc
Assets.prototype.install = function(file, uri, cb) {
  var options = this.eyeglass.options.eyeglass;
  var httpRoot = options.httpRoot;
  if (options.buildDir) {
    // normalize the uri using the system OS path separator
    // and make it relative to the httpRoot
    uri = new URI(uri);
    uri = uri.getPath(path.sep, httpRoot);

    var dest = path.join(options.buildDir, uri);
    fs.copy(file, dest, function(error) {
      if (error) {
        cb(error);
      } else {
        cb(null, dest);
      }
    });
  } else {
    cb(null, file);
  }
};

// TODO - doc
Assets.prototype.installer = function(installer) {
  var oldInstaller = this.install;
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
