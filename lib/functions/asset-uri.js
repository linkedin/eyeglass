"use strict";

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-asset-uri($registered-assets, $relative-path)": function($assets, $uri, done) {
      eyeglass.assets.resolveAsset($assets, $uri, function(error, assetUri, assetPath) {
        if (error) {
          if (error.constructor === sass.types.Error) {
            done(error);
          } else {
            done(sass.types.Error(error.message));
          }
        } else {
          // TODO - this should probably be quoted
          done(sass.types.String(assetUri));
        }
      });
    }
  };
};
