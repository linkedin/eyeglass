"use strict";

module.exports = function(eyeglass, sass) {
  return {
    "asset-url($relative-path)": function(relativePath, done) {
      done(sass.types.String("url(" + relativePath.getValue() + ")"));
    }
  };
};
