import EyeglassCompiler = require('broccoli-eyeglass');
import Eyeglass = require('eyeglass');
import findHost from "./findHost";
import Funnel = require('broccoli-funnel');
import MergeTrees = require('broccoli-merge-trees');
import * as path from 'path';
import * as url from 'url';
import cloneDeep = require('lodash.clonedeep');
import defaultsDeep = require('lodash.defaultsdeep');
import {BroccoliSymbolicLinker} from "./broccoli-ln-s";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLazyEngine(addon: any): boolean {
  if (addon.lazyLoading === true) {
    // pre-ember-engines 0.5.6 lazyLoading flag
    return true;
  }
  if (addon.lazyLoading && addon.lazyLoading.enabled === true) {
    return true;
  }
  return false;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDefaultAssetHttpPrefix(parent: any): string {
  // the default http prefix differs between Ember app and lazy Ember engine
  // iterate over the parent's chain and look for a lazy engine or there are
  // no more parents, which means we've reached the Ember app project
  let current = parent;

  while (current.parent) {
    if (isLazyEngine(current)) {
      // only lazy engines will inline their assets in the engines-dist folder
      return `/engines-dist/${current.name}/assets`;
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
function localEyeglassAddons(addon): Array<{path: string}> {
  let paths = new Array<{path: string}>();

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

interface EyeglassAddon {
  _eyeglass: {
    isApp: boolean;
    app: {
      name: string;
      _eyeglass: {
        assets: BroccoliSymbolicLinker;
      };
    };
  };
  [stuff: string]: any;
}

const EMBER_CLI_EYEGLASS = {
  name: 'ember-cli-eyeglass',
  included(parent) {
    this._super.included.apply(this, arguments);
    let app = findHost(this);
    let isApp = (this.app === app);
    let name = app.name;
    if (!isApp) {
      let thisName = typeof this.parent.name === "function" ? this.parent.name() : this.parent.name;
      name = `${name}/${thisName}`
    }
    // we create the symlinker in persistent mode because there's not a good way
    // yet to recreate the symlinks when sass files are cached.
    // I would worry about it more but it seems like the dist directory is cumulative across builds anyway.
    app._eyeglass = app._eyeglass || {assets: new BroccoliSymbolicLinker({}, {annotation: app.name, persistentOutput: true})};
    this._eyeglass = {app, isApp, name};
  },

  postBuild(result) {
    if (this._eyeglass) {
      this._eyeglass.app._eyeglass.assets.reset();
    } else {
    // eslint-disable-next-line no-console
      console.warn("eyeglass addon info is missing during postBuild. Cannot invalidate asset links.");
    }
    Eyeglass.resetGlobalCaches();
  },
  postprocessTree(type, tree) {
    if (type === "all" && this._eyeglass.isApp) {
      return new MergeTrees([tree, this._eyeglass.app._eyeglass.assets], {overwrite: true});
    } else {
      return tree;
    }
  },
  setupPreprocessorRegistry(type, registry) {
    let addon = this;

    registry.add('css', {
      name: 'eyeglass',
      ext: 'scss',
      toTree: (tree, inputPath, outputPath) => {
        // These start with a slash and that messes things up.
        let cssDir = outputPath.slice(1) || './';
        let sassDir = inputPath.slice(1) || './';

        let host = findHost(addon);
        let inApp = (host === addon.app);

        let extracted = this.extractConfig(host, addon);

        extracted.cssDir = cssDir;
        extracted.sassDir = sassDir;
        const config = this.setupConfig(extracted);

        let compiler = new EyeglassCompiler(tree, config);
        compiler.events.on("cached-asset", (absolutePathToSource, httpPathToOutput) => {
          this.linkAsset(absolutePathToSource, httpPathToOutput);
        });
        return compiler;
      }
    });
  },

  extractConfig(host, addon) {
    const isNestedAddon = typeof addon.parent.parent === 'object';
    // setup eyeglass for this project's configuration
    const hostConfig = cloneDeep(host.options.eyeglass || {});
    const addonConfig = isNestedAddon ? cloneDeep(addon.parent.options.eyeglass || {}) : {};
    return defaultsDeep(addonConfig, hostConfig);
  },

  linkAsset(this: EyeglassAddon, srcFile: string, destUri: string): string {
    if (path.posix.isAbsolute(destUri)) {
      destUri = path.posix.relative("/", destUri);
    }

    if (process.platform === "win32") {
      destUri = url.fileURLToPath(`file://${destUri}`)
    }
    return this._eyeglass.app._eyeglass.assets.ln_s(srcFile, destUri);
  },
  
  setupConfig(config: ConstructorParameters<typeof EyeglassCompiler>[1], options) {

    config.annotation = `EyeglassCompiler(${this._eyeglass.name})`;
    if (!config.sourceFiles && !config.discover) {
      config.sourceFiles = [this._eyeglass.isApp ? 'app.scss' : 'addon.scss'];
    }
    config.assets = ['public', 'app'].concat(config.assets || []);
    config.eyeglass = config.eyeglass || {}
    config.eyeglass.httpRoot = config.eyeglass.httpRoot || config["httpRoot"];
    if (config.persistentCache) {
      config.persistentCache += `-${this._eyeglass.name}`
      if (this._eyeglass.isApp) {
        // If we don't scope this a cache reset of the app deletes the addon caches
        config.persistentCache += "/app";
      }
    }

    config.assetsHttpPrefix = config.assetsHttpPrefix || getDefaultAssetHttpPrefix(this.parent);

    if (config.eyeglass.modules) {
      config.eyeglass.modules =
        config.eyeglass.modules.concat(localEyeglassAddons(this.parent));
    } else {
      config.eyeglass.modules = localEyeglassAddons(this.parent);
    }
    let originalConfigureEyeglass = config.configureEyeglass;
    config.configureEyeglass = (eyeglass, sass, details) => {
      eyeglass.assets.installer((file, uri, fallbackInstaller, cb) => {
        cb(null, this.linkAsset(file, uri))
      });
      if (originalConfigureEyeglass) {
        originalConfigureEyeglass(eyeglass, sass, details);
      }
    };

    // If building an app, rename app.css to <project>.css per Ember conventions.
    // Otherwise, we're building an addon, so rename addon.css to <name-of-addon>.css.
    let originalGenerator = config.optionsGenerator;
    config.optionsGenerator = (sassFile, cssFile, sassOptions, compilationCallback) => {
      if (this._eyeglass.isApp) {
        cssFile = cssFile.replace(/app\.css$/, `${this.app.name}.css`);
      } else {
        cssFile = cssFile.replace(/addon\.css$/, `${this.parent.name}.css`);
      }

      if (originalGenerator) {
        originalGenerator(sassFile, cssFile, sassOptions, compilationCallback);
      } else {
        compilationCallback(cssFile, sassOptions);
      }
    };

    return config;
  }
};

export = EMBER_CLI_EYEGLASS;