"use strict";

import BroccoliSassCompiler, { BroccoliSassOptions, CompilationDetails, SassImplementation } from "./broccoli_sass_compiler";
import BroccoliPlugin = require("broccoli-plugin");
import crypto = require("crypto");
import merge = require("lodash.merge");
import path = require("path");
import sortby = require("lodash.sortby");
import stringify = require("json-stable-stringify");
import debugGenerator = require("debug");
import Eyeglass = require("eyeglass");
import dependencyTree = require("dependency-tree");
import { EyeglassOptions } from "eyeglass/lib/util/Options";
import EyeglassModule from "eyeglass/lib/modules/EyeglassModule";

const assetImportCacheDebug = debugGenerator("broccoli-eyeglass:asset-import-cache");
const dependencyDebug = debugGenerator("broccoli-eyeglass:file-dependencies")
const CURRENT_VERSION: string = require(path.join(__dirname, "..", "package.json")).version;

function httpJoin(...args: Array<string>): string {
  let joined = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i]) {
      let segment = args[i];
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

type BroccoliEyeglassOptions = BroccoliSassOptions & EyeglassOptions & {
  /**
   * Optional. A string or array of strings indicating the subdirectories where
   * assets for the project can be found. This calls `eyeglass.assets.addSource`
   * for each directory specified. If the options passed for these are not
   * sufficient, use the `configureEyeglass` callback to call `addSource` with the
   * options you need.
   */
  assets?: string | Array<string>;
  /**
   * The subdirectory that assets are in relative to the `httpRoot` when
   * generating urls to them.
   */
  assetsHttpPrefix?: string;
  configureEyeglass?: (eyeglass: Eyeglass, sass: SassImplementation, details: CompilationDetails) => unknown;
  /**
   * Whether to render relative links to assets. Defaults to false.
   */
  relativeAssets?: boolean;
};

class EyeglassCompiler extends BroccoliSassCompiler {
  private configureEyeglass: ((eyeglass: Eyeglass, sass: SassImplementation, details: CompilationDetails) => unknown) | undefined;
  private relativeAssets: boolean | undefined;
  private assetDirectories: Array<string> | undefined;
  private assetsHttpPrefix: string | undefined;
  private _assetImportCacheStats: { hits: number; misses: number };
  private _dependenciesHash: string | undefined;
  constructor(inputTrees: BroccoliPlugin.BroccoliNode | Array<BroccoliPlugin.BroccoliNode>, options: BroccoliEyeglassOptions) {
    options = merge({}, options);
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

    this.configureEyeglass = configureEyeglass;
    this.relativeAssets = relativeAssets;
    this.assetDirectories = assetDirectories;
    this.assetsHttpPrefix = assetsHttpPrefix;
    this.events.on("compiling", this.handleNewFile.bind(this));

    this._assetImportCacheStats = {
      hits: 0,
      misses: 0,
    };
  }

  handleNewFile(details: CompilationDetails): void {
    let options: Eyeglass.EyeglassOptions = details.options;
    if (!options.eyeglass) {
      options.eyeglass = {};
    }
    if ((this.assetsHttpPrefix || this.relativeAssets) && !options.eyeglass.assets) {
      options.eyeglass.assets = {};
    }
    if (this.assetsHttpPrefix) {
      options.eyeglass.assets!.httpPrefix = this.assetsHttpPrefix;
    }

    if (this.relativeAssets) {
      options.eyeglass.assets!.relativeTo = httpJoin(
        options.eyeglass.httpRoot || "/",
        path.dirname(details.cssFilename)
      );
    }

    options.assetsCache = this.cacheAssetImports.bind(this);

    options.eyeglass.buildDir = details.destDir;
    options.eyeglass.engines = options.eyeglass.engines || {};
    options.eyeglass.engines.sass = this.sass;
    options.eyeglass.installWithSymlinks = true;
    options.eyeglass.buildCache = this.buildCache;

    let eyeglass = new Eyeglass(options);


    if (this.assetDirectories) {
      for (var i = 0; i < this.assetDirectories.length; i++) {
        eyeglass.assets.addSource(
          path.resolve(eyeglass.options.eyeglass.root, this.assetDirectories[i]),
          {
            globOpts: {
              ignore: ["**/*.js", "**/*.s[ac]ss"],
            },
          }
        );
      }
    }

    if (this.configureEyeglass) {
      this.configureEyeglass(eyeglass, this.sass, details);
    }

    // set up asset dependency tracking
    eyeglass.assets.resolver((filepath, fullUri, realResolve, cb)  => {
      this.events.emit("dependency", filepath).then(() => {
        realResolve(filepath, fullUri, cb);
      }, cb);
    });

    eyeglass.assets.installer((file, uri, realInstall, cb) => {
      realInstall(file, uri, (error: unknown, destFile?: string) => {
        if (error) {
          cb(error, file);
        } else {
          this.events.emit("additional-output", destFile, uri, file).then(() => {
            cb(null, file);
          }, cb);
        }
      });
    });

    details.options = eyeglass.options;
    details.options.eyeglass.engines.eyeglass = eyeglass;
  }

  cachableOptions(rawOptions: Eyeglass.EyeglassOptions): Eyeglass.EyeglassOptions {
    rawOptions = merge({}, rawOptions);
    delete rawOptions.file;
    if (rawOptions.eyeglass) {
      delete rawOptions.eyeglass.engines;
      delete rawOptions.eyeglass.modules;
    }
    return rawOptions;
  }

  static currentVersion(): string {
    return CURRENT_VERSION;
  }

  dependenciesHash(_srcDir: string, _relativeFilename: string, options: Eyeglass.EyeglassOptions): string {
    if (!this._dependenciesHash) {
      let eyeglass = new Eyeglass(options);
      let hash = crypto.createHash("sha1");
      hash.update("broccoli-eyeglass@" + EyeglassCompiler.currentVersion());

      let egModules = sortby(eyeglass.modules.list, m => m.name);

      egModules.forEach(mod => {
        let name: string = mod.name;
        if (mod.inDevelopment || mod.eyeglass.inDevelopment) {
          let depHash: string = this.hashForJs(mod);
          hash.update(name + "@" + depHash);
        } else {
          let version: string = mod.version || "<unversioned>";
          hash.update(name + "@" + version);
        }
      });

      this._dependenciesHash = hash.digest("hex");
    }

    return this._dependenciesHash;
  }

  keyForSourceFile(srcDir: string, relativeFilename: string, options: Eyeglass.EyeglassOptions): string {
    let key = super.keyForSourceFile(srcDir, relativeFilename, options);
    let optsString = stringify(this.cachableOptions(options));
    let dependencies = this.dependenciesHash(srcDir, relativeFilename, options);

    return key + "+" + optsString + "+" + dependencies;
  }

  // Cache the asset import code that is generated in eyeglass
  cacheAssetImports(key: string, getValue: () => string): string {
    // if this has already been generated, return it from cache
    let assetImportKey = `assetImport(${key})`;
    let assetImport = this.buildCache.get(assetImportKey) as string | undefined;
    if (assetImport !== undefined) {
      assetImportCacheDebug("cache hit for key '%s'", key);
      this._assetImportCacheStats.hits += 1;
      return assetImport;
    }
    assetImportCacheDebug("cache miss for key '%s'", key);
    this._assetImportCacheStats.misses += 1;
    assetImport = getValue();
    this.buildCache.set(assetImportKey, assetImport);
    return assetImport;
  }

  hashForJs(mod: EyeglassModule): string {
    let jsPath = mod.mainPath;
    if (!jsPath) {
      return ""
    }
    let cacheKey = `hashForJs(${jsPath})`;
    let cachedHash = this.buildCache.get(cacheKey) as string;
    if (cachedHash) {
      return cachedHash;
    }
    let files = dependencyTree.toList({filename: jsPath, directory: path.dirname(jsPath)});
    dependencyDebug(`${jsPath} => \n\t${files.join("\n\t")}`);
    let hash = crypto.createHash("sha1");
    for (let file of files) {
      hash.update(file);
      hash.update(this.fileKey(file));
    }
    let result = hash.digest("base64");
    this.buildCache.set(cacheKey, result);
    return result;
  }
}

export = EyeglassCompiler;
