var BroccoliEyeglass = require('broccoli-eyeglass');

var outputDirectory = "dist";

var options = {
  cssDir: 'css'
};

var outputTree = new BroccoliEyeglass(['src'], options);
