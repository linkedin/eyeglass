"use strict";

var uriUtils = require("../util/uri");
var stringUtils = require("../util/strings");

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-normalize-uri($uri, $type: web)": function($uri, $type, done) {
      var type = $type.getValue();
      var uri = uriUtils.normalize[type]($uri.getValue());
      done(sass.types.String(stringUtils.quote(uri)));
    }
  };
};
