"use strict";

var AssetsSource = require("./AssetsSource");
var stringUtils = require("../util/strings");
var URI = require("../util/URI");

var assetRegisterTmpl = "@include asset-register(${namespace}, ${name}, ${sourcePath}, ${uri});\n";

function AssetsCollection() {
  this.sources = [];
}

AssetsCollection.prototype.addSource = function(src, opts) {
  this.sources.push(new AssetsSource(src, opts));
  return this;
};

AssetsCollection.prototype.asAssetImport = function (name) {
  // builds the scss to register all the assets
  // this will look something like...
  //  @import "eyeglass/assets";
  //  @include asset-register(
  //    "namespace",
  //    "path/to/foo.png",
  //    "/absolute/namespace/path/to/foo.png",
  //    "namespace/path/to/foo.png"
  //  );
  return this.sources.reduce(function(importStr, source) {
    // get the assets for the entry
    var assets = source.getAssets(name);
    var namespace = (stringUtils.quote(assets.namespace) || "null");
    // reduce the assets into a `asset-register` calls
    return importStr + assets.files.reduce(function(registerStr, asset) {
      return registerStr + stringUtils.tmpl(assetRegisterTmpl, {
        namespace: namespace,
        name: URI.sass(asset.name),
        sourcePath: URI.sass(asset.sourcePath),
        uri: URI.sass(asset.uri)
      });
    }, "");
  }, '@import "eyeglass/assets";\n');
};

module.exports = AssetsCollection;
