var BroccoliEyeglass = require("broccoli-eyeglass");


var outputTree = new BroccoliEyeglass("src", {
  cssDir: "css" /* This is the only required option */,
});

module.exports = outputTree;
