"use strict";

var uriUtils = require("../util/uri");

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-normalize-uri($uri, $type: web)": function($uri, $type, done) {
      var type = $type.getValue();
      var uri = $uri.getValue();
      // normalize the uri for the given type
      uri = uriUtils.normalize[type](uri);
      // then normalize it to an escaped sass string
      uri = uriUtils.normalize.sass(uri);
      done(sass.types.String(uri));
    }
  };
};
