var path = require("path");

module.exports = function() {
  return {
    sassDir: path.join(__dirname, "sass"),
  };
};
