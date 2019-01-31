"use strict";
// TODO: Annotate Types

export default function(eyeglass, sass) {
  return {
    "eyeglass-asset-uri($registered-assets, $relative-path)": function($assets, $uri, done) {
      eyeglass.assets.resolveAsset($assets, $uri, function(error, assetUri) {
        if (error) {
          if (error.constructor === sass.types.Error) {
            done(error);
          } else {
            done(sass.types.Error(error.message));
          }
        } else {
          done(sass.types.String(assetUri));
        }
      });
    }
  };
};
