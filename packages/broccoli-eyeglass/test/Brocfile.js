const debug = false;
const EyeglassCompiler = require("..");

const tree = new EyeglassCompiler(["sass"], {
  cssDir: "css",
  verbose: true,
  assets: "assets",
  assetsHttpPrefix: "assets",
  relativeAssets: true
});

if (debug) {
  let instrument = require("broccoli-debug").instrument;
  tree = instrument.print(tree);
}
module.exports = tree;
