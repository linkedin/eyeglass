var Module = require('module'),
    path = require("path");

/*
 * Resolves a node module into a path. This uses
 * the node.js internals from the Module API, but the
 * API is marked "5 - Locked" and shouldn't change
 * from here on out. This was done to remove the dependency on
 * node-resolve.
 * API docs: http://nodejs.org/api/modules.html
 * node.js code: https://sourcegraph.com/github.com/joyent/node/
 *   .CommonJSPackage/node/.def/commonjs/lib/module.js/-/_resolveFilename
 */
var resolve = function(id, parent, parentDir) {
  return Module._resolveFilename(id, {
    paths: Module._nodeModulePaths(parentDir),
    filename: parent,
    id: parent
  });
};

module.exports = resolve;
