var debug = false;
var EyeglassCompiler = require("..");
var instrument = require('broccoli-debug').instrument;

var tree = new EyeglassCompiler(["sass"], {cssDir: "css", verbose: true});

if (debug) {
  tree = instrument.print(tree)
}
module.exports = tree;
