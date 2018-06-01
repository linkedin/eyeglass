'use strict';

const path = require('path');
const EngineAddon = require('ember-engines/lib/engine-addon');
const assetsDir = path.join(__dirname, '/public/assets');

module.exports = EngineAddon.extend({
  name: 'lazy',

  eyeglass: Object.freeze({
    discover: true,
    assets: assetsDir,
  }),

  lazyLoading: Object.freeze({
    enabled: true
  }),

  isDevelopingAddon() {
    return true;
  }
});
