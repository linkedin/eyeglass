var path = require("path");
var sassDir = path.join(__dirname, "sass");
module.exports = function() {
  return {
    sassDir,
  };
};
