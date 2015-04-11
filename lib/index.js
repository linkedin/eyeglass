var BroccoliSassCompiler = require('./broccoli_sass_compiler');
var Eyeglass = require('eyeglass');

var EyeglassCompiler = BroccoliSassCompiler.extend({
  init: function(inputTrees, options) {
    this._super.init(inputTrees, options);
    this.events.on("compiling", this.handleNewFile.bind(this));
  },

  handleNewFile: function(details) {
    var eyeglass = new Eyeglass(details.options);
    details.options = eyeglass.sassOptions();
  },

  // Ugh. This method needs to be decomposed into smaller parts.
  updateCache: function(srcPaths, destDir) {
    return this._super.updateCache(srcPaths, destDir);
  }
});

module.exports = EyeglassCompiler;
