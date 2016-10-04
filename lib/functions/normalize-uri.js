"use strict";

var URI = require("../util/URI");

module.exports = function(eyeglass, sass) {
  return {
    "eyeglass-normalize-uri($uri, $type: web)": function($uri, $type, done) {
      var type = $type.getValue();
      var uri = $uri.getValue();
      // normalize the uri for the given type
      uri = URI[type](uri);
      done(sass.types.String(uri));
    },
    "eyeglass-uri-preserve($uri)": function($uri, done) {
      var uri = $uri.getValue();
      // decorate the uri
      uri = URI.preserve(uri);
      done(sass.types.String(uri));
    },
    "eyeglass-uri-restore($uri)": function($uri, done) {
      var uri = $uri.getValue();
      // restore the uri
      uri = URI.restore(uri);
      done(sass.types.String(uri));
    }
  };
};
