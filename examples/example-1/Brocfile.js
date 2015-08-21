var BroccoliEyeglass = require('broccoli-eyeglass');

var options = {
  cssDir: 'css' /* This is the only required option */
};

var outputTree = new BroccoliEyeglass(['src'], options);

module.exports = outputTree;
