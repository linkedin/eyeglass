var BroccoliSassCompiler = require('./broccoli_sass_compiler');
var Eyeglass = require('eyeglass').Eyeglass;
var path = require("path");

function httpJoin() {
  var joined = [];
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i]) {
      var segment = arguments[i];
      if (path.sep !== "/") {
        segment = segment.replace(path.sep, "/");
      }
      joined.push(segment);
    }
  }
  var result = joined.join("/");
  result = result.replace("///", "/");
  result = result.replace("//", "/");
  return result;
}

var EyeglassCompiler = BroccoliSassCompiler.extend({
  init: function(inputTrees, options) {
    if (options.configureEyeglass) {
      this.configureEyeglass = options.configureEyeglass;
      delete options.configureEyeglass;
    }

    this.relativeAssets = options.relativeAssets
    delete options.relativeAssets;

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
    this._super(inputTrees, options);
    this.events.on("compiling", this.handleNewFile.bind(this));
  },

  handleNewFile: function(details) {
    if (this.assetsHttpPrefix) {
      details.options.assetsHttpPrefix = this.assetsHttpPrefix;
    }

    if (this.relativeAssets) {
      details.options.assetsRelativeTo =
        httpJoin(details.options.httpRoot || "/", path.dirname(details.cssFilename));
    }

    details.options.buildDir = details.destDir;

    var eyeglass = new Eyeglass(details.options, this._super.sass);
    if (this.assetDirectories) {
      for (var i = 0; i < this.assetDirectories.length; i++) {
        eyeglass.assets.addSource(path.resolve(".", this.assetDirectories[i]), {
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
    return this._super(srcPaths, destDir);
  }
});

module.exports = EyeglassCompiler;
