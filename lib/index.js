var BroccoliSassCompiler = require('./broccoli_sass_compiler');
var Eyeglass = require('eyeglass');

var EyeglassCompiler = BroccoliSassCompiler.extend({
  init: function(inputTrees, options) {
    this._super.init(inputTrees, options);
  },

  // Ugh. This method needs to be decomposed into smaller parts.
  updateCache: function(srcPaths, destDir) {
    this._super.updateCache(srcPaths, destDir);
  }
});

module.exports = EyeglassCompiler;
