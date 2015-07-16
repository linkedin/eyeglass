/* jshint node: true */
'use strict';

var EyeglassCompiler = require("broccoli-eyeglass");
var stew = require("broccoli-stew");

module.exports = {
  name: 'ember-cli-eyeglass',

  config: function(env, baseConfig) {
    var defaults = {eyeglass: {}};
    if (env != "production") {
      defaults.eyeglass.verbose = false
    }
    if (baseConfig.eyeglass && !(baseConfig.eyeglass.sourceFiles || baseConfig.eyeglass.discover)) {
      defaults.eyeglass.sourceFiles = ["app.s[ac]ss"]
    }
    return defaults;
  },

  setupPreprocessorRegistry: function(type, registry) {
    var addon = this;
    registry.add('css', {
      name: 'eyeglass',
      ext: 'scss',
      toTree: function(tree, inputPath, outputPath, options) {
        // These start with a slash and that messes things up.
        var cssDir = outputPath.slice(1);
        var sassDir = inputPath.slice(1);

        // limit to only files in the sass directory.
        tree = stew.find(tree, {include: [sassDir + "/**/*"]});

        // setup eyeglass for this project's configuration
        var config = addon.project.config(addon.app.env).eyeglass || {};
        config.cssDir = cssDir;
        config.sassDir = sassDir;
        config.assets = "public"

        // rename app.css to <project>.css per ember conventions.
        var originalGenerator = config.optionsGenerator;
        config.optionsGenerator = function(sassFile, cssFile, sassOptions, compilationCallback) {
          cssFile = cssFile.replace(/app\.css$/, addon.app.name + ".css");
          if (originalGenerator) {
            originalGenerator(sassFile, cssFile, sassOptions, compilationCallback);
          } else {
            compilationCallback(cssFile, sassOptions);
          }
        };
        return new EyeglassCompiler(tree, config);
      }
    });
  }
};
