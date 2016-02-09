"use strict";

var AssetsSource = require("./AssetsSource");
var stringUtils = require("../util/strings");

var assetRegisterAllTmpl = "@include asset-register-all(${namespace}, (\n  ${map}\n));";
var assetEntryTmpl = [
  '"${name}": (',
  '    filepath: "${path}",',
  '    uri: "${uri}"',
  ")"
].join("\n");

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
  //  @include asset-register-all("namespace", (
  //    "path/to/foo.png": (
  //      filepath: "/absolute/namespace/path/to/foo.png",
  //      uri: "namespace/path/to/foo.png"
  //    )
  //  ));
  return this.sources.reduce(function(str, source) {
    // get the assets for the entry
    var assets = source.getAssets(name);
    var namespace = (stringUtils.quote(assets.namespace) || "null");
    // reduce the assets into a Sass map string
    var sassMapString = assets.files.map(function(asset) {
      return stringUtils.tmpl(assetEntryTmpl, {
        name: asset.name,
        // escape all backslashes for Sass string
        //  "C:\foo\bar.png" -> "C:\\foo\\bar.png"
        // actual backslash, for real this time http://www.xkcd.com/1638/
        path: asset.path.replace(/\\/g, "\\\\"),
        uri: asset.uri
      });
    }).join(",\n  ");

    return str += "\n" + stringUtils.tmpl(assetRegisterAllTmpl, {
      namespace: namespace,
      map: sassMapString
    });
  }, '@import "eyeglass/assets";');
};

module.exports = AssetsCollection;
