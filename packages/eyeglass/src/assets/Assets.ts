import * as fs from "fs-extra";
import * as path from "path";

import { IEyeglass } from "../IEyeglass";
import * as debug from "../util/debug";
import { AssetSourceOptions } from "../util/Options";
import { isType, SassImplementation, SassTypeError, isSassMap, isSassString } from "../util/SassImplementation";
import type * as sass from "node-sass";
import { URI } from "../util/URI";

import AssetsCollection from "./AssetsCollection";
import { isPresent } from "../util/typescriptUtils";
import errorFor from "../util/errorFor";

type EnsureSymlinkSync = (srcFile: string, destLink: string) => void;
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const ensureSymlink: EnsureSymlinkSync = require("ensure-symlink");

interface Resolution {
  path: string;
  query?: string;
}

type ResolverCallback = (error: unknown, result?: Resolution) => unknown;
type Resolver = (assetFile: string, assetUri: string, cb: ResolverCallback) => void;
type WrappedResolver = (assetFile: string, assetUri: string, fallback: Resolver, cb: ResolverCallback) => void;

interface Resolves {
  resolve: Resolver;
}

type InstallerCallback = (error: unknown, dest?: string) => void;
type Installer = (file: string, uri: string, cb: InstallerCallback) => void;
type WrappedInstaller = (file: string, uri: string, fallback: Installer, cb: InstallerCallback) => void;
interface Installs {
  install: Installer;
}

export default class Assets implements Resolves, Installs {
  // need types for sass utils
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eyeglass: IEyeglass;
  /**
   * Assets declared by the application.
   */
  collection: AssetsCollection;
  /**
   * Assets declared by eyeglass modules.
   */
  moduleCollections: Array<AssetsCollection>;
  sassImpl: typeof sass;
  constructor(eyeglass: IEyeglass, sassImpl: SassImplementation) {
    this.sassImpl = sassImpl;
    this.eyeglass = eyeglass;
    // create a master collection
    this.collection = new AssetsCollection(eyeglass.options);
    // and keep a list of module collections
    this.moduleCollections = [];
  }

  /**
    * @see AssetsCollection#asAssetImport
    */
  asAssetImport(name: string | undefined): string {
    return this.collection.asAssetImport(name);
  }

  /**
    * @see AssetsCollection#addSource
    */
  addSource(src: string, opts: Partial<AssetSourceOptions>): AssetsCollection {
    return this.collection.addSource(src, opts);
  }

  /**
    * @see AssetsCollection#cacheKey
    */
  cacheKey(name: string): string {
    return this.collection.cacheKey(name);
  }
  /**
    * creates a new AssetsCollection and adds the given source
    * @see #addSource
    * @param    {String} src - the source directory
    * @param    {Object} opts - the options
    * @returns  {AssetsCollection} the instance of the AssetsCollection
    */
  export(src: string, opts: AssetSourceOptions): AssetsCollection {
    let assets = new AssetsCollection(this.eyeglass.options);
    this.moduleCollections.push(assets);
    return assets.addSource(src, opts);
  }
  /**
    * resolves an asset given a uri
    * @param    {SassMap} $assetsMap - the map of registered Sass assets
    * @param    {SassString} $uri - the uri of the asset
    * @param    {Function} cb - the callback that is invoked when the asset resolves
    */
  resolveAsset($assetsMap: sass.types.Map, $uri: sass.types.Value, cb: (error: Error | null, uri?: string, file?: string) => unknown): void {
    let sass = this.eyeglass.options.eyeglass.engines.sass;
    let options = this.eyeglass.options.eyeglass;
    let assets = this.eyeglass.assets;
    if (!isType(sass, $uri, "string")) {
      cb(new SassTypeError(sass, "string", $uri))
      return;
    }

    // get a URI instance
    let originalUri = $uri.getValue();
    let uri = new URI(originalUri);

    // normalize the uri and resolve it

    let $data = this.resolveAssetDefaults($assetsMap, uri.getPath());
    if ($data) {
      let filepath: string | undefined;
      let assetUri: string | undefined;
      for (let i = 0; i < $data.getLength(); i++) {
        let k = ($data.getKey(i) as sass.types.String).getValue();
        let v = ($data.getValue(i) as sass.types.String).getValue();
        if (k === "filepath") {
          filepath = v;
        } else if (k === "uri") {
          assetUri = v;
        }
      }

      // create the URI
      let fullUri = URI.join(
        options.httpRoot,
        options.assets.httpPrefix,
        assetUri
      );

      assets.resolve(filepath!, fullUri, function(error, assetInfo) {
        if (error || !isPresent(assetInfo)) {
          cb(errorFor(error, "Unable to resolve asset"));
        } else {
          // if relativeTo is set
          if (options.assets.relativeTo) {
            // make the URI relative to the httpRoot + relativeTo path
            uri.setPath(path.relative(
              URI.join(options.httpRoot, options.assets.relativeTo),
              assetInfo.path
            ));
          } else {
            // otherwise, just update it to the path as is
            uri.setPath(assetInfo.path);
          }
          // if a query param was specified, append it to the uri query
          if (assetInfo.query) {
            uri.addQuery(assetInfo.query);
          }

          assets.install(filepath!, assetInfo.path, function(error, file) {
            if (error) {
              cb(errorFor(error, "Unable to install asset"));
            } else {
              if (file) {
                /* istanbul ignore next - don't test debug */
                debug.assets && debug.assets(
                  "%s resolved to %s with URI %s",
                  originalUri,
                  path.relative(options.root, file),
                  uri.toString()
                );
              }
              cb(null, uri.toString(), file);
            }
          });
        }
      });
    } else {
      cb(new Error("Asset not found: " + uri.getPath()));
    }
  }
  /**
    * resolves the asset uri
    * @param    {String} assetFile - the source file path
    * @param    {String} assetUri - the resolved uri path
    * @param    {Function} cb - the callback to pass the resolved uri to
    */
  resolve(_assetFile: string, assetUri: string, cb: ResolverCallback): void {
    cb(null, { path: assetUri });
  }
  /**
    * wraps the current resolver with a custom resolver
    * @param    {Function} resolver - the new resolver function
    */
  resolver(resolver: WrappedResolver): void {
    let oldResolver: Resolver = this.resolve.bind(this);
    this.resolve = function(assetFile: string, assetUri: string, cb: ResolverCallback) {
      resolver(assetFile, assetUri, oldResolver, cb);
    };
  }
  /**
    * installs the given asset
    * @param    {String} file - the source file path to install from
    * @param    {String} uri - the resolved uri path
    * @param    {Function} cb - the callback invoked after the installation is successful
    */
  install(file: string, uri: string, cb: InstallerCallback): void {
    let options = this.eyeglass.options.eyeglass;
    let httpRoot = options.httpRoot;
    if (options.buildDir) {
      // normalize the uri using the system OS path separator
      // and make it relative to the httpRoot
      uri = (new URI(uri)).getPath(path.sep, httpRoot);

      let dest = path.join(options.buildDir, uri);

      this.eyeglass.once(`install:${dest}`, () => {
        try {
          if (options.installWithSymlinks) {
            fs.mkdirpSync(path.dirname(dest));

            ensureSymlink(file, dest);
            debug.assets && debug.assets(
              "symlinked %s to %s",
              file,
              dest
            );
          } else {
            // we explicitly use copySync rather than copy to avoid starving system resources
            fs.copySync(file, dest);
            debug.assets && debug.assets(
              "copied %s to %s",
              file,
              dest
            );
          }
          cb(null, dest);
        } catch (error) {
          cb(errorFor(error, `Failed to install asset from ${file}:\n`));
        }
      }, () => {
        cb(null, dest);
      });

    } else {
      cb(null, file);
    }
  }
  /**
    * wraps the current installer with a custom installer
    * @param    {Function} installer - the new installer function
    */
  installer(installer: WrappedInstaller): void {
    let oldInstaller: Installer = this.install.bind(this);
    this.install = function(assetFile, assetUri, cb) {
      installer(assetFile, assetUri, oldInstaller, cb);
    };
  }

  // need types for sass utils
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveAssetDefaults($registeredAssetsMap: sass.types.Map, relativePath: string): sass.types.Map | undefined {

    let appAssets: sass.types.Map | undefined;
    let moduleAssets: sass.types.Map | undefined;
    let moduleName: string | undefined, moduleRelativePath: string | undefined;
    let slashAt = relativePath.indexOf("/");
    if (slashAt > 0) {
      moduleName = relativePath.substring(0,slashAt);
      moduleRelativePath = relativePath.substring(slashAt + 1)
    }

    let size = $registeredAssetsMap.getLength();
    for (let i = 0; i < size; i++) {
      let k = $registeredAssetsMap.getKey(i);
      if (k === this.sassImpl.types.Null.NULL) {
        let v = $registeredAssetsMap.getValue(i);
        if (isSassMap(this.sassImpl, v)) {
          appAssets = v;
        }
      } else if (isSassString(this.sassImpl, k) && k.getValue() === moduleName) {
        let v = $registeredAssetsMap.getValue(i);
        if (isSassMap(this.sassImpl, v)) {
          moduleAssets = v;
        }
      }
    }

    if (appAssets) {
      let size = appAssets.getLength();
      for (let i = 0; i < size; i++) {
        let k = appAssets.getKey(i);
        if (isSassString(this.sassImpl, k) && k.getValue() === relativePath) {
          let v = appAssets.getValue(i);
          if (isSassMap(this.sassImpl, v)) {
            return v;
          }
        }
      }
    }

    if (moduleAssets) {
      let size = moduleAssets.getLength();
      for (let i = 0; i < size; i++) {
        let k = moduleAssets.getKey(i);
        if (isSassString(this.sassImpl, k) && k.getValue() === moduleRelativePath) {
          let v = moduleAssets.getValue(i);
          if (isSassMap(this.sassImpl, v)) {
            return v;
          }
        }
      }
    }
    return;
  }
}


