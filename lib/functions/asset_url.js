"use strict";

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-asset-uri($registered-assets, $relative-path)":
      function(registeredAssetsMap, relativePathString, done) {
        var relativePath = relativePathString.getValue();
        var assetPath = eyeglass.assets.resolveAssetToPath(registeredAssetsMap, relativePathString);
        var assetUri = eyeglass.assets.resolveAssetToUri(registeredAssetsMap, relativePathString.getValue());
        if (assetPath) {
          // console.log("asset " + relativePath + " found at: " + assetPath);
          console.log("assetPath");
          console.log(assetUri);
          done(sass.types.String(assetUri));
        } else {
          done(sass.types.Error("Asset not found: " + relativePath));
        }
      }
  };
};
