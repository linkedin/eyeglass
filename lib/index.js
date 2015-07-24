var BroccoliSassCompiler = require('./broccoli_sass_compiler');
var Eyeglass = require('eyeglass').Eyeglass;
var path = require("path");

var EyeglassCompiler = BroccoliSassCompiler.extend({
  init: function(inputTrees, options) {
    if (options.configureEyeglass) {
      this.configureEyeglass = options.configureEyeglass;
      delete options.configureEyeglass;
    }
    if (options.assets) {
      this.assetDirectories = options.assets;
      if (typeof this.assetDirectories === "string") {
        this.assetDirectories = [this.assetDirectories];
      }
      delete options.assets;
    }
    if (options.assetsHttpPrefix) {
      this.assetsHttpPrefix = options.assetsHttpPrefix;
      delete options.assetsHttpPrefix;
    }
    this._super.init(inputTrees, options);
    this.events.on("compiling", this.handleNewFile.bind(this));
  },

  handleNewFile: function(details) {
    if (this.assetsHttpPrefix) {
      details.options.assetsHttpPrefix = this.assetsHttpPrefix;
    }
    details.options.buildDir = details.destDir;
    var eyeglass = new Eyeglass(details.options, this._super.sass);
    if (this.assetDirectories) {
      for (var i = 0; i < this.assetDirectories.length; i++) {
        eyeglass.assets.addSource(path.resolve(".", this.assetDirectories[0]), {
          globOpts: {
            ignore: ["**/*.js", "**/*.s[ac]ss"]
          }
        });
      }
    }
    if (this.configureEyeglass) {
      this.configureEyeglass(eyeglass, this._super.sass, details);
    }
    details.options = eyeglass.sassOptions();
  },

  // Ugh. This method needs to be decomposed into smaller parts.
  updateCache: function(srcPaths, destDir) {
    return this._super.updateCache(srcPaths, destDir);
  }
});

module.exports = EyeglassCompiler;
