/* jshint node: true */
'use strict';

var EyeglassCompiler = require("broccoli-eyeglass");
var findHost = require("./lib/findHost");
var funnel = require("broccoli-funnel");
var merge = require("broccoli-merge-trees");
var path = require("path");

function getDefaultAssetHttpPrefix(parent) {
  // the default http prefix differs between Ember app and lazy Ember engine
  // iterate over the parent's chain and look for a lazy engine or there are
  // no more parents, which means we've reached the Ember app project
  var current = parent;

  while(current.parent) {
    if (current.lazyLoading === true && current.useDeprecatedIncorrectCSSProcessing !== true) {
      // only lazy engines with disabled deprecated CSS processing will inline their assets in
      // the engines-dist folder
      return '/engines-dist/' + current.name + '/assets';
    }
    current = current.parent;
  }

  // at this point, the highlevel container is Ember app and we should use the default "assets" prefix
  return 'assets';
}

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
        var host = findHost(addon);
        var inApp = (host === addon.app);

        // These start with a slash and that messes things up.
        var cssDir = outputPath.slice(1);
        var sassDir = inputPath.slice(1);
        var parentName = typeof addon.parent.name === "function" ? addon.parent.name() : addon.parent.name;

        // If cssDir and sassDir are now empty, that means they point to the
        // root directory of the tree.
        cssDir = cssDir || './';
        sassDir = sassDir || './';

        // limit to only files in the sass directory.
        tree = funnel(tree, {include: [path.join(sassDir, "/**/*")]});

        var projectConfig = addon.project.config(host.env);
        if (addon.parent && addon.parent.engineConfig) {
          projectConfig = addon.parent.engineConfig(host.env, projectConfig);
        }
        // setup eyeglass for this project's configuration
        var config = projectConfig.eyeglass || {};
        config.annotation = "EyeglassCompiler: " + parentName;
        if (!config.sourceFiles && !config.discover) {
          config.sourceFiles = [inApp ? 'app.scss' : 'addon.scss'];
        }
        config.cssDir = cssDir;
        config.sassDir = sassDir;
        config.assets = ["public", "app"].concat(config.assets || []);
        config.eyeglass = config.eyeglass || {}
        config.eyeglass.httpRoot = config.eyeglass.httpRoot ||
                                   config.httpRoot ||
                                   projectConfig.rootURL;
        config.assetsHttpPrefix = config.assetsHttpPrefix || getDefaultAssetHttpPrefix(addon.parent);

        if (config.eyeglass.modules) {
          config.eyeglass.modules =
            config.eyeglass.modules.concat(localEyeglassAddons(addon.parent));
        } else {
          config.eyeglass.modules = localEyeglassAddons(addon.parent);
        }

        // If building an app, rename app.css to <project>.css per Ember conventions.
        // Otherwise, we're building an addon, so rename addon.css to <name-of-addon>.css.
        var originalGenerator = config.optionsGenerator;
        config.optionsGenerator = function(sassFile, cssFile, sassOptions, compilationCallback) {
          if (inApp) {
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

        tree = new EyeglassCompiler(tree, config);

        // Ember CLI will ignore any non-CSS files returned in the tree for an
        // addon. So that non-CSS assets aren't lost, we'll store them in a
        // separate tree for now and return them in a later hook.
        if (!inApp) {
          addon.addonAssetsTree = funnel(tree, {include: ['**/*.!(css)']});
        }

        return tree;
      }
    });
  },

  treeForPublic: function(tree) {
    tree = this._super.treeForPublic(tree);

    // If we're processing an addon and stored some assets for it, add them
    // to the addon's public tree so they'll be available in the app's build
    if (this.addonAssetsTree) {
      tree = tree ? merge([tree, this.addonAssetsTree]) : this.addonAssetsTree;
      this.addonAssetsTree = null;
    }

    return tree;
  }
};
