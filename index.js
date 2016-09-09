/* jshint node: true */
'use strict';

var EyeglassCompiler = require("broccoli-eyeglass");
var path = require("path");
var stew = require("broccoli-stew");

/* addon.addons forms a tree(graph?) of addon objects that allow us to traverse the
 * ember addon dependencies.  However there's no path information in the addon object,
 * but each addon object has some disconnected metadata in addon.addonPackages
 * with the path info. Unfortunately there's no shared information that would
 * allow us to connect which addon packages are actually which addon objects.
 * It would be great if ember-cli didn't throw that information on the ground
 * while building these objects. It would also be marvelous if we knew which
 * addons came from a local addon declaration and which ones came from node
 * modules.
 **/
function localEyeglassAddons(addon) {
  var paths = [];
  if (typeof(addon.addons) !== "object" ||
      typeof(addon.addonPackages) !== "object") {
    return paths;
  }

  var packages = Object.keys(addon.addonPackages);

  for (var i = 0; i < packages.length; i++) {
    var p = addon.addonPackages[packages[i]];
    // Note: this will end up creating manual addons for things in node modules
    // that are actually auto discovered, these manual modules will get deduped
    // out.  but we need to add all of them because the some eyeglass modules
    // for addons & engines won't get autodiscovered otherwise unless the
    // addons/engines are themselves eyeglass modules (which we don't want to require).
    if (p.pkg.keywords.some(function(kw) {return kw == "eyeglass-module";})) {
      paths.push({path: p.path})
    }
  }
  // TODO: if there's a cycle in the addon graph don't recurse.
  for (var i = 0; i < addon.addons.length; i++) {
    paths = paths.concat(localEyeglassAddons(addon.addons[i]));
  }
  return paths;
}

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

        if (config.eyeglass.modules) {
          config.eyeglass.modules.concat(localEyeglassAddons(addon.parent));
        } else {
          config.eyeglass.modules = localEyeglassAddons(addon.parent);
        }

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
