var BroccoliEyeglass = require('broccoli-eyeglass');

var options = {
  cssDir: 'stylesheets',
  discover: false, // Don't automatically find & convert sass files in the trees
  sourceFiles: ['master.scss'] // Array of files (or glob string) to compile
};

var outputTree = new BroccoliEyeglass(['src'], options);

module.exports = outputTree;
