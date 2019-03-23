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

const EYEGLASS_INFO_PER_ADDON = new WeakMap<object, EyeglassAddonInfo>();
const EYEGLASS_INFO_PER_APP = new WeakMap<object, EyeglassAppInfo>();
const apps = new Array<any>();

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

interface EyeglassProjectInfo {
  apps: Array<any>;
}
interface EyeglassAddonInfo {
  name: string;
  parentPath: string;
  isApp: boolean;
  app: any; // is this safe to cache across builds?
}
interface EyeglassAppInfo {
  assets: BroccoliSymbolicLinker;
  sessionCache: Map<string, string | number>;
}

const EMBER_CLI_EYEGLASS = {
  name: 'ember-cli-eyeglass',
  included(parent) {
    this._super.included.apply(this, arguments);
    this.initSelf();
  },
  initSelf() {
    if (EYEGLASS_INFO_PER_ADDON.has(this)) return;
    let app = findHost(this);
    if (!app) return;
    let isApp = (this.app === app);
    let name = app.name;
    if (!isApp) {
      let thisName = typeof this.parent.name === "function" ? this.parent.name() : this.parent.name;
      name = `${name}/${thisName}`
    }
    let parentPath = this.parent.root;
    if (isApp) {
      apps.push(app);
      // we create the symlinker in persistent mode because there's not a good
      // way yet to recreate the symlinks when sass files are cached. I would
      // worry about it more but it seems like the dist directory is cumulative
      // across builds anyway.
      EYEGLASS_INFO_PER_APP.set(app, {
        sessionCache: new Map(),
        assets: new BroccoliSymbolicLinker({}, {annotation: app.name, persistentOutput: true})
      });
    }
    let addonInfo = {isApp, name, parentPath, app};
    EYEGLASS_INFO_PER_ADDON.set(this, addonInfo);
  },
  postBuild(result) {
    Eyeglass.resetGlobalCaches();
    for (let app of apps) {
      let appInfo = EYEGLASS_INFO_PER_APP.get(app);
      if (appInfo) {
        appInfo.assets.reset();
        appInfo.sessionCache.clear();
      } else {
        // eslint-disable-next-line no-console
        console.warn("eyeglass app info is missing during postBuild.");
      }
    }
  },
  postprocessTree(type, tree) {
    let addonInfo = EYEGLASS_INFO_PER_ADDON.get(this);
    if (type === "all" && addonInfo.isApp) {
      let appInfo = EYEGLASS_INFO_PER_APP.get(addonInfo.app);
      return new MergeTrees([tree, appInfo.assets], {overwrite: true});
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
        let {app} = EYEGLASS_INFO_PER_ADDON.get(this);
        let extracted = this.extractConfig(app, addon);
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

  linkAsset(srcFile: string, destUri: string): string {
    if (path.posix.isAbsolute(destUri)) {
      destUri = path.posix.relative("/", destUri);
    }

    if (process.platform === "win32") {
      destUri = url.fileURLToPath(`file://${destUri}`)
    }
    let {app} = EYEGLASS_INFO_PER_ADDON.get(this);
    let {assets} = EYEGLASS_INFO_PER_APP.get(app);
    return assets.ln_s(srcFile, destUri);
  },

  setupConfig(config: ConstructorParameters<typeof EyeglassCompiler>[1], options) {
    let {isApp, app, parentPath} = EYEGLASS_INFO_PER_ADDON.get(this);
    let {sessionCache} = EYEGLASS_INFO_PER_APP.get(app);
    config.sessionCache = sessionCache;
    config.annotation = `EyeglassCompiler(${parentPath})`;
    if (!config.sourceFiles && !config.discover) {
      config.sourceFiles = [isApp ? 'app.scss' : 'addon.scss'];
    }
    config.assets = ['public', 'app'].concat(config.assets || []);
    config.eyeglass = config.eyeglass || {}
    config.eyeglass.httpRoot = config.eyeglass.httpRoot || config["httpRoot"];
    if (config.persistentCache) {
      let cacheDir = parentPath.replace(/\//g, "$");
      config.persistentCache += `/${cacheDir}`;
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
      if (isApp) {
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