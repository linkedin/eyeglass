"use strict";

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-asset-uri($registered-assets, $relative-path)":
      function(registeredAssetsMap, relativePathString, done) {
        var relativePath = relativePathString.getValue();
        var assetPath = eyeglass.assets.resolveAssetToPath(registeredAssetsMap, relativePathString);
        if (assetPath) {
          // console.log("asset " + relativePath + " found at: " + assetPath);
          done(sass.types.String("/" + relativePath));
        } else {
          done(sass.types.Error("Asset not found: " + relativePath));
        }
      }
  };
};
