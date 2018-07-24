'use strict';

// eslint-disable-next-line node/no-extraneous-require
const EngineAddon = require('ember-engines/lib/engine-addon');
const path = require('path');
const assetsDir = path.join(__dirname, '/public/assets');

module.exports = EngineAddon.extend({
  name: 'eager',

  lazyLoading: Object.freeze({
    enabled: false
  }),


  eyeglass: Object.freeze({
    discover: true,
    assets: assetsDir,
  }),

  isDevelopingAddon() {
    return true;
  }
});
