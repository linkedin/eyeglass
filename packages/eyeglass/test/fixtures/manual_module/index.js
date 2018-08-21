var path = require("path");

module.exports = {
  name: "my-manual-module",
  eyeglass: {
    needs: "*"
  },

  main: function(eyeglass, sass) {
    return {
      sassDir: path.join(__dirname, "sass"),

      functions: {
        "manual-hello()": function(done) {
          done(sass.types.String('"Hello World!"'));
        }
      }
    };
  }
};
