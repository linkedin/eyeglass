'use strict'

/**
 * Finds the host app under which an addon is running.
 *
 * This allows us to easily look up the host app from a nested addon (an addon
 * running under another addon).
 */
module.exports = function findHost(addon) {
  // If the addon has the _findHost() method (in ember-cli >= 2.7.0), we'll just
  // use that.
  if (typeof addon._findHost === 'function') {
    return addon._findHost();
  }

  // Otherwise, we'll use this implementation borrowed from the _findHost()
  // method in ember-cli.
  let current = addon;
  let app;

  // Keep iterating upward until we don't have a grandparent.
  // Has to do this grandparent check because at some point we hit the project.
  do {
    app = current.app || app;
  } while (current.parent.parent && (current = current.parent));

  return app;
}
