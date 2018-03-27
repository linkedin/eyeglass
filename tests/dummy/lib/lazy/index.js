/* eslint-env node */
'use strict';

const path = require('path');
const EngineAddon = require('ember-engines/lib/engine-addon');
const assetsDir = path.join(__dirname, '/public/assets');

module.exports = EngineAddon.extend({
  name: 'lazy',

  eyeglass: {
    discover: true,
    assets: assetsDir,
  },

  lazyLoading: {
    enabled: true
  },

  isDevelopingAddon() {
    return true;
  }
});
