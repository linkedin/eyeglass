"use strict";

module.exports = function(eyeglass, sass) {
  return {
    sass: __dirname, // directory where the sass files are.
    functions: {
      "hello($name: Myself)": function(name, done) {
        done(sass.types.String("Hello, " + name.getValue() + "!"));
      }
    }
  };
};
