/* eslint-env node */
'use strict';

const EyeglassCompiler = require('broccoli-eyeglass');
const findHost = require('./lib/findHost');
const Funnel = require('broccoli-funnel');
const merge = require('broccoli-merge-trees');
const path = require('path');
const cloneDeep = require('lodash.clonedeep');
const defaultsDeep = require('lodash.defaultsdeep');

function isLazyEngine(addon) {
  if (addon.lazyLoading === true) {
    // pre-ember-engines 0.5.6 lazyLoading flag
    return true;
  }
  if (addon.lazyLoading && addon.lazyLoading.enabled === true) {
    return true;
  }
  return false;
}

function getDefaultAssetHttpPrefix(parent) {
  // the default http prefix differs between Ember app and lazy Ember engine
  // iterate over the parent's chain and look for a lazy engine or there are
  // no more parents, which means we've reached the Ember app project
  let current = parent;

  while (current.parent) {
    if (isLazyEngine(current)) {
      // only lazy engines will inline their assets in the engines-dist folder
      return '/engines-dist/' + current.name + '/assets';
    }
    current = current.parent;
  }

  // at this point, the highlevel container is Ember app and we should use the default 'assets' prefix
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
  let paths = [];

  if (typeof addon.addons !== 'object' ||
    typeof addon.addonPackages !== 'object') {
    return paths;
  }

  let packages = Object.keys(addon.addonPackages);

  for (let i = 0; i < packages.length; i++) {
    let p = addon.addonPackages[packages[i]];
    // Note: this will end up creating manual addons for things in node modules
    // that are actually auto discovered, these manual modules will get deduped
    // out.  but we need to add all of them because the some eyeglass modules
    // for addons & engines won't get autodiscovered otherwise unless the
    // addons/engines are themselves eyeglass modules (which we don't want to require).
    if (p.pkg.keywords.some(kw => kw == 'eyeglass-module')) {
      paths.push({ path: p.path })
    }
  }

  // TODO: if there's a cycle in the addon graph don't recurse.
  for (let i = 0; i < addon.addons.length; i++) {
    paths = paths.concat(localEyeglassAddons(addon.addons[i]));
  }
  return paths;
}

module.exports = {
  name: 'ember-cli-eyeglass',
  setupPreprocessorRegistry(type, registry) {
    let addon = this;

    registry.add('css', {
      name: 'eyeglass',
      ext: 'scss',
      toTree(tree, inputPath, outputPath) {
        // These start with a slash and that messes things up.
        let cssDir = outputPath.slice(1) || './';
        let sassDir = inputPath.slice(1) || './';

        let host = findHost(addon);
        let inApp = (host === addon.app);

        if (path.posix.join(sassDir, '/**/*') === '**/*') {
          // limit to only files in the sass directory,
          // but don't bother funneling if we just want everything anyways e.g. **/*
          tree = new Funnel(tree, {
            include: [ path.join(sassDir, '/**/*') ]
          });
        }

        let extracted = extractConfig(host, addon);

        extracted.cssDir = cssDir;
        extracted.sassDir = sassDir;
        const config = setupConfig(extracted, {
          inApp,
          addon
        });

        tree = new EyeglassCompiler(tree, config);

        // Ember CLI will ignore any non-CSS files returned in the tree for an
        // addon. So that non-CSS assets aren't lost, we'll store them in a
        // separate tree for now and return them in a later hook.
        if (!inApp) {
          addon.addonAssetsTree = new Funnel(tree, { include: ['**/*.!(css)'] });
        }

        return tree;
      }
    });
  },

  treeForPublic(tree) {
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

module.exports.extractConfig = extractConfig;
function extractConfig(host, addon) {
  const isNestedAddon = typeof addon.parent.parent === 'object';
  // setup eyeglass for this project's configuration
  const hostConfig = cloneDeep(host.options.eyeglass || {});
  const addonConfig = isNestedAddon ? cloneDeep(addon.parent.options.eyeglass || {}) : {};
  return defaultsDeep(addonConfig, hostConfig);
}

module.exports.setupConfig = setupConfig;
function setupConfig(config, options) {
  let addon = options.addon;
  let inApp = options.inApp;

  let parentName = typeof addon.parent.name === 'function' ? addon.parent.name() : addon.parent.name;

  config.annotation = 'EyeglassCompiler: ' + parentName;
  if (!config.sourceFiles && !config.discover) {
    config.sourceFiles = [inApp ? 'app.scss' : 'addon.scss'];
  }
  config.assets = ['public', 'app'].concat(config.assets || []);
  config.eyeglass = config.eyeglass || {}
  config.eyeglass.httpRoot = config.eyeglass.httpRoot || config.httpRoot;

  config.assetsHttpPrefix = config.assetsHttpPrefix || getDefaultAssetHttpPrefix(addon.parent);

  if (config.eyeglass.modules) {
    config.eyeglass.modules =
      config.eyeglass.modules.concat(localEyeglassAddons(addon.parent));
  } else {
    config.eyeglass.modules = localEyeglassAddons(addon.parent);
  }

  // If building an app, rename app.css to <project>.css per Ember conventions.
  // Otherwise, we're building an addon, so rename addon.css to <name-of-addon>.css.
  let originalGenerator = config.optionsGenerator;
  config.optionsGenerator = function(sassFile, cssFile, sassOptions, compilationCallback) {
    if (inApp) {
      cssFile = cssFile.replace(/app\.css$/, addon.app.name + '.css');
    } else {
      cssFile = cssFile.replace(/addon\.css$/, addon.parent.name + '.css');
    }

    if (originalGenerator) {
      originalGenerator(sassFile, cssFile, sassOptions, compilationCallback);
    } else {
      compilationCallback(cssFile, sassOptions);
    }
  };

  return config;
}
