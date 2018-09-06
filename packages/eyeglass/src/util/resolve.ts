/*eslint no-underscore-dangle:0*/
// underscores allowed in this file for calling privately into node.js

const Module = require("module");

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
export default function resolve(id, parent, parentDir) {
  return Module._resolveFilename(id, {
    paths: Module._nodeModulePaths(parentDir),
    filename: parent,
    id: parent
  });
};
