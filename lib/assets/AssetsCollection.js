"use strict";

var AssetsSource = require("./AssetsSource");
var stringUtils = require("../util/strings");
var URI = require("../util/URI");

var assetRegisterTmpl = "@include asset-register(${namespace}, ${name}, ${sourcePath}, ${uri});\n";

var assetCache = {};

function AssetsCollection() {
  this.sources = [];
}

/**
  * adds an AssetsSource to the collection
  * @param    {String} src - the source directory of the assets
  * @param    {Object} opts - the options to pass @see AssetsSource
  * @returns  {AssetsCollection} returns the instance of AssetsCollection for chaining
  */
AssetsCollection.prototype.addSource = function(src, opts) {
  this.sources.push(new AssetsSource(src, opts));
  return this;
};

/**
  * returns the scss to register all the assets
  * @param    {String} name - the namespace to use
  * @returns  {String} the scss representation of the asset registration
  */
AssetsCollection.prototype.asAssetImport = function (name) {
  //  if the sources are all the same as what's in cache, send that back
  var cacheKey = this.sources.reduce(function(cacheStr, source) {
    return cacheStr + ":" + source.cacheKey(name);
  }, "sources");
  if (assetCache[cacheKey] !== undefined) {
    return assetCache[cacheKey];
  }

  // builds the scss to register all the assets
  // this will look something like...
  //  @import "eyeglass/assets";
  //  @include asset-register(
  //    "namespace",
  //    "path/to/foo.png",
  //    "/absolute/namespace/path/to/foo.png",
  //    "namespace/path/to/foo.png"
  //  );
  var generatedScss = this.sources.reduce(function(importStr, source) {
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

  assetCache[cacheKey] = generatedScss;
  return generatedScss;
};

module.exports = AssetsCollection;
