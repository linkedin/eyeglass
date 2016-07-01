/* jshint node: true */
'use strict';

var EyeglassCompiler = require("broccoli-eyeglass");
var path = require("path");
var stew = require("broccoli-stew");

module.exports = {
  name: 'ember-cli-eyeglass',

  config: function(env, baseConfig) {
    var defaults = {eyeglass: {}};
    if (env != "production") {
      defaults.eyeglass.verbose = false
    }
    return defaults;
  },

  setupPreprocessorRegistry: function(type, registry) {
    var addon = this;

    registry.add('css', {
      name: 'eyeglass',
      ext: 'scss',
      toTree: function(tree, inputPath, outputPath, options) {
        var isApp = (addon._findHost() === addon.app);
        // These start with a slash and that messes things up.
        var cssDir = outputPath.slice(1);
        var sassDir = inputPath.slice(1);

        // If cssDir and sassDir are now empty, that means they point to the
        // root directory of the tree.
        cssDir = cssDir || './';
        sassDir = sassDir || './';

        // limit to only files in the sass directory.
        tree = stew.find(tree, {include: [path.join(sassDir, "/**/*")]});

        var projectConfig = addon.app ? addon.project.config(addon.app.env) : {};
        // setup eyeglass for this project's configuration
        var config = projectConfig.eyeglass || {};
        if (!config.sourceFiles && !config.discover) {
          config.sourceFiles = [isApp ? 'app.scss' : 'addon.scss'];
        }
        config.cssDir = cssDir;
        config.sassDir = sassDir;
        config.assets = ["public", "app"].concat(config.assets || []);
        config.eyeglass = config.eyeglass || {}
        config.eyeglass.httpRoot = config.eyeglass.httpRoot ||
                                   config.httpRoot ||
                                   projectConfig.baseURL;
        config.assetsHttpPrefix = config.assetsHttpPrefix || "assets";

        // If building an app, rename app.css to <project>.css per Ember conventions.
        // Otherwise, we're building an addon, so rename addon.css to <name-of-addon>.css.
        var originalGenerator = config.optionsGenerator;
        config.optionsGenerator = function(sassFile, cssFile, sassOptions, compilationCallback) {
          if (isApp) {
            cssFile = cssFile.replace(/app\.css$/, addon.app.name + ".css");
          } else {
            cssFile = cssFile.replace(/addon\.css$/, addon.parent.name + ".css");
          }
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
