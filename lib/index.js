"use strict";

const BroccoliSassCompiler = require("./broccoli_sass_compiler");
const crypto = require("crypto");
const merge = require("lodash.merge");
const path = require("path");
const sortby = require("lodash.sortby");
const stringify = require("json-stable-stringify");
const debugGenerator = require("debug");
const persistentCacheDebug = debugGenerator("broccoli-eyeglass:persistent-cache");
const assetImportCacheDebug = debugGenerator("broccoli-eyeglass:asset-import-cache");
const CURRENT_VERSION = require(path.join(__dirname, "..", "package.json")).version;

function httpJoin() {
  let joined = [];
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i]) {
      let segment = arguments[i];
      if (path.sep !== "/") {
        segment = segment.replace(path.sep, "/");
      }
      joined.push(segment);
    }
  }
  let result = joined.join("/");
  result = result.replace("///", "/");
  result = result.replace("//", "/");
  return result;
}

module.exports = class EyeglassCompiler extends BroccoliSassCompiler {
  constructor(inputTrees, options) {
    options = merge({}, options);
    let pristineOptions = merge({}, options);
    if (!Array.isArray(inputTrees)) {
      inputTrees = [inputTrees];
    }
    let configureEyeglass, assetDirectories, assetsHttpPrefix;

    if (options.configureEyeglass) {
      configureEyeglass = options.configureEyeglass;
      delete options.configureEyeglass;
    }

    let relativeAssets = options.relativeAssets;
    delete options.relativeAssets;

    if (options.assets) {
      assetDirectories = options.assets;
      if (typeof assetDirectories === "string") {
        assetDirectories = [assetDirectories];
      }
      delete options.assets;
    }
    if (options.assetsHttpPrefix) {
      assetsHttpPrefix = options.assetsHttpPrefix;
      delete options.assetsHttpPrefix;
    }

    super(inputTrees, options);

    this.pristineOptions = pristineOptions;
    this.Eyeglass = require("eyeglass");
    this.configureEyeglass = configureEyeglass;
    this.relativeAssets = relativeAssets;
    this.assetDirectories = assetDirectories;
    this.assetsHttpPrefix = assetsHttpPrefix;
    this.events.on("compiling", this.handleNewFile.bind(this));

    this._assetImportCache = Object.create(null);
    this._assetImportCacheStats = {
      hits: 0,
      misses: 0,
    };
  }

  handleNewFile(details) {
    if (!details.options.eyeglass) {
      details.options.eyeglass = {};
    }
    if ((this.assetsHttpPrefix || this.relativeAssets) && !details.options.eyeglass.assets) {
      details.options.eyeglass.assets = {};
    }
    if (this.assetsHttpPrefix) {
      details.options.eyeglass.assets.httpPrefix = this.assetsHttpPrefix;
    }

    if (this.relativeAssets) {
      details.options.eyeglass.assets.relativeTo =
        httpJoin(details.options.eyeglass.httpRoot || "/", path.dirname(details.cssFilename));
    }

    details.options.assetsCache = this.cacheAssetImports.bind(this);

    details.options.eyeglass.buildDir = details.destDir;
    details.options.eyeglass.engines = details.options.eyeglass.engines || {};
    details.options.eyeglass.engines.sass = details.options.eyeglass.engines.sass || this.sass;
    details.options.eyeglass.installWithSymlinks = true;

    let eyeglass = new this.Eyeglass(details.options);

    // set up asset dependency tracking
    let self = this;
    let realResolve = eyeglass.assets.resolve;

    eyeglass.assets.resolve = function(filepath, fullUri, cb) {
      self.events.emit("dependency", filepath).then(() => {
        realResolve.call(eyeglass.assets, filepath, fullUri, cb);
      }, cb);
    };

    let realInstall = eyeglass.assets.install;
    eyeglass.assets.install = function(file, uri, cb) {
      realInstall.call(eyeglass.assets, file, uri, (error, file) => {
        if (error) {
          cb (error, file);
        } else {
          self.events.emit("additional-output", file).then(() => {
            cb(null, file);
          }, cb);
        }
      });
    };

    if (this.assetDirectories) {
      for (var i = 0; i < this.assetDirectories.length; i++) {
        eyeglass.assets.addSource(path.resolve(eyeglass.options.eyeglass.root,
          this.assetDirectories[i]),
          {
            globOpts: {
              ignore: ["**/*.js", "**/*.s[ac]ss"]
            }
          });
      }
    }

    if (this.configureEyeglass) {
      this.configureEyeglass(eyeglass, this.sass, details);
    }
    details.options = eyeglass.options;
    details.options.eyeglass.engines.eyeglass = eyeglass;
  }

  cachableOptions(rawOptions) {
    rawOptions = merge({}, rawOptions);
    delete rawOptions.file;
    if (rawOptions.eyeglass) {
      delete rawOptions.eyeglass.engines;
      delete rawOptions.eyeglass.modules;
    }
    return rawOptions;
  }

  static currentVersion() {
    return CURRENT_VERSION;
  }

  dependenciesHash(srcDir, relativeFilename, options) {
    if (!this._dependenciesHash) {
      let hashForDep = require("hash-for-dep");
      let eyeglass = new this.Eyeglass(options);
      let hash = crypto.createHash("sha1");
      let cachableOptions = stringify(this.cachableOptions(options));

      persistentCacheDebug("cachableOptions are %s", cachableOptions);
      hash.update(cachableOptions);
      hash.update("broccoli-eyeglass@" + EyeglassCompiler.currentVersion());

      let egModules = sortby(eyeglass.modules.list, m => m.name);

      egModules.forEach(mod => {
        if (mod.inDevelopment || mod.eyeglass.inDevelopment) {
          hash.update(mod.name + "@" + hashForDep(mod.path));
        } else {
          hash.update(mod.name + "@" + mod.version);
        }
      });

      this._dependenciesHash = hash.digest("hex");
    }

    return this._dependenciesHash;
  }

  keyForSourceFile(srcDir, relativeFilename, options) {
    let key = super.keyForSourceFile(srcDir, relativeFilename, options);
    let dependencies = this.dependenciesHash(srcDir, relativeFilename, options);

    return key + "+" + dependencies;
  }

  // Cache the asset import code that is generated in eyeglass
  cacheAssetImports(key, getValue) {
    // if this has already been generated, return it from cache
    if (this._assetImportCache[key] !== undefined) {
      assetImportCacheDebug("cache hit for key '%s'", key);
      this._assetImportCacheStats.hits += 1;
      return this._assetImportCache[key];
    }
    assetImportCacheDebug("cache miss for key '%s'", key);
    this._assetImportCacheStats.misses += 1;
    return this._assetImportCache[key] = getValue();
  }
};
