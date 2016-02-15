"use strict";

var URI = require("../util/URI");

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-normalize-uri($uri, $type: web)": function($uri, $type, done) {
      var type = $type.getValue();
      var uri = $uri.getValue();
      // normalize the uri for the given type
      uri = URI[type](uri);
      // then normalize it to an escaped sass string
      uri = URI.sass(uri);
      done(sass.types.String(uri));
    }
  };
};
