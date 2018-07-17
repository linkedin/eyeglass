'use strict';

const EngineAddon = require('ember-engines/lib/engine-addon'); // eslint-disable-line node/no-extraneous-require

module.exports = EngineAddon.extend({
  name: 'eager',

  lazyLoading: Object.freeze({
    enabled: false
  }),

  isDevelopingAddon() {
    return true;
  }
});
