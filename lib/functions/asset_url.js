"use strict";

var unquote = require("../util/unquote");

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-asset-uri($relative-path)": function(relativePathString, done) {
      var relativePath = unquote(relativePathString.getValue());
      var assetLocation = eyeglass.findAsset(relativePath);
      if (assetLocation) {
        done(sass.types.String(assetLocation.httpDir + "/" + relativePath));
      } else {
        done(sass.types.Error("Asset not found: " + relativePath));
      }
    }
  };
};
