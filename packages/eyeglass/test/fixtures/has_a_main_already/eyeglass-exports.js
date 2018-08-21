"use strict";

module.exports = function(eyeglass, sass) {
  return {
    sassDir: __dirname, // directory where the sass files are.
    functions: {
      "hello($name: 'Not Main')": function(name, done) {
        done(sass.types.String("Hello, " + name.getValue() + "!"));
      }
    }
  };
};
