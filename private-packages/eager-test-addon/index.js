'use strict';

const path = require('path');
const assetsDir = path.join(__dirname, '/public/assets');
const EngineAddon = require('ember-engines/lib/engine-addon'); // eslint-disable-line node/no-extraneous-require

module.exports = EngineAddon.extend({
  name: 'eager-test-addon',

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
