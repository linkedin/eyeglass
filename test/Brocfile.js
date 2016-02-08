var debug = false;
var EyeglassCompiler = require("..");

var tree = new EyeglassCompiler(["sass"], {
  cssDir: "css",
  verbose: true,
  assets: "assets",
  assetsHttpPrefix: "assets",
  relativeAssets: true
});

if (debug) {
  var instrument = require("broccoli-debug").instrument;
  tree = instrument.print(tree);
}
module.exports = tree;
