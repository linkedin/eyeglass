var BroccoliEyeglass = require('broccoli-eyeglass');

var options = {
  cssDir: 'css'
};

var outputTree = new BroccoliEyeglass(['src'], options);

module.exports = outputTree;
