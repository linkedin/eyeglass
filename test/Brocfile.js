const debug = false;
const EyeglassCompiler = require("..");

let tree = new EyeglassCompiler(["sass"], {
  cssDir: "css",
  verbose: true,
  assets: "assets",
  assetsHttpPrefix: "assets",
  relativeAssets: true,
});

if (debug) {
  const BroccoliDebug = require("broccoli-debug");
  tree = new BroccoliDebug(tree, "eyeglass-debugging");
}
module.exports = tree;
