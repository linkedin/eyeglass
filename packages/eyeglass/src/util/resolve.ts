/*eslint no-underscore-dangle:0*/
// underscores allowed in this file for calling privately into node.js

import Module = require("module");

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
export default function resolve(id: string, parent: string, parentDir: string): string {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (Module as any)._resolveFilename(id, {
    paths: (Module as any)._nodeModulePaths(parentDir),
    filename: parent,
    id: parent
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
