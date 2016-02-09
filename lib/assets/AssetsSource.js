"use strict";

var fs = require("fs");
var glob = require("glob");
var path = require("path");
var merge = require("lodash.merge");
var uriUtils = require("../util/uri");
var fileUtils = require("../util/files");

// TODO - doc
/* class AssetsSource
 *
 * srcPath - directory where assets are sourced.
 * Option: name [Optional] - The logical name of this path entry. When specified,
 *   the source url of an asset in this directory will be of the form
 *   "<name>/path/relativeTo/srcPath.ext".
 * Option: httpPrefix [Optional] - The http prefix where the assets url should be anchored
 *   "url(<httpPrefix>/path/relativeTo/srcPath.ext)". Defaults to "/<name>" or just "/"
 *   when there is no name.
 * Option: pattern [Optional] - A glob pattern that controls what files can be in this asset path.
 *   Defaults to "**\/*".
 * Option: globOpts [Optional] - Options to use for globbing.
 *   See: https://github.com/isaacs/node-glob#options
 */
function AssetsSource(srcPath, options) {
  options = options || {};

  if (fileUtils.existsSync(srcPath) && !fs.statSync(srcPath).isDirectory()) {
    throw new Error("Expected " + srcPath + " to be a directory.");
  }

  // TODO - what is this for? needs a test
  this.name = options.name || null;
  this.httpPrefix = options.httpPrefix || this.name;
  this.srcPath = srcPath;
  this.pattern = options.pattern || "**/*";
  this.globOpts = merge(
    // default glob options
    {
      follow: true,
      nodir: true
    },
    // with the custom options
    options.globOpts,
    // but the following cannot be overridden by options.globOpts
    {
      cwd: this.srcPath,
      root: this.srcPath
    }
  );
}

/**
  * returns an assets found in the given source
  * @param    {String} namespace - the namespace
  * @returns  {Object} the object containing the namespace and array of discovered files
  */
AssetsSource.prototype.getAssets = function(namespace) {
  namespace = this.name || namespace;
  var files = glob.sync(this.pattern, this.globOpts).map(function(file) {

    var uri = uriUtils.join(this.httpPrefix, namespace, file);

    return {
      name: uriUtils.normalize.web(file),
      path: uriUtils.normalize.system(path.join(this.srcPath, file)),
      uri: uriUtils.normalize.web(uri)
    };
  }.bind(this));

  return {
    namespace: namespace,
    files: files
  };
};

// TODO - doc
AssetsSource.prototype.toString = function() {
  return this.srcPath + "/" + this.pattern;
};

module.exports = AssetsSource;
