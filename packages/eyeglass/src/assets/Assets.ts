import * as fs from "fs-extra";
import * as path from "path";
import { URI } from "../util/URI";
import * as debug from "../util/debug";
import AssetsCollection from "./AssetsCollection";
import AssetsSource from "./AssetsSource";
import { IEyeglass } from "../IEyeglass";
import { SassImplementation, SassMap, SassValue, isType, SassTypeError } from "../util/SassImplementation";

const ensureSymlink = require("ensure-symlink");

interface Resolution {
  path: string;
  query?: string;
}
type ResolverCallback = (error: Error | null, result?: Resolution) => any;
type Resolver = (assetFile: string, assetUri: string, cb: ResolverCallback) => void;
type WrappedResolver = (assetFile: string, assetUri: string, fallback: Resolver, cb: ResolverCallback) => void;

interface Resolves {
  resolve: Resolver;
}
export default class Assets implements Resolves {
  sassUtils: any;
  eyeglass: IEyeglass;
  /**
   * Assets declared by the application.
   */
  collection: AssetsCollection;
  /**
   * Assets declared by eyeglass modules.
   */
  moduleCollections: Array<AssetsCollection>;
  AssetCollection: () => any;
  AssetPathEntry: (src: any, options: any) => AssetsSource;
  constructor(eyeglass: IEyeglass, sass: SassImplementation) {
    this.sassUtils = require("node-sass-utils")(sass);
    this.eyeglass = eyeglass;
    // create a master collection
    this.collection = new AssetsCollection(eyeglass.options);
    // and keep a list of module collections
    this.moduleCollections = [];

    // Expose these temporarily for back-compat reasons
    function deprecate(method) {
      eyeglass.deprecate("0.8.3", "0.9.0", [
        "The assets." + method + " interface will be removed from the public API.",
        "If you currently use this method, please open an issue at",
        "https://github.com/sass-eyeglass/eyeglass/issues/ so we can",
        "understand and accommodate your use case"
      ].join(" "));
    }
    this.AssetCollection = function () {
      deprecate("AssetCollection");
      return new AssetsCollection(eyeglass.options);
    };
    this.AssetPathEntry = function (src, options) {
      deprecate("AssetPathEntry");
      return new AssetsSource(src, options);
    };
  }

  /**
    * @see AssetsCollection#asAssetImport
    */
  asAssetImport(name): string {
    return this.collection.asAssetImport(name);
  }

  /**
    * @see AssetsCollection#addSource
    */
  addSource(src, opts): AssetsCollection {
    return this.collection.addSource(src, opts);
  }

  /**
    * @see AssetsCollection#cacheKey
    */
  cacheKey(name): string {
    return this.collection.cacheKey(name);
  }
  /**
    * creates a new AssetsCollection and adds the given source
    * @see #addSource
    * @param    {String} src - the source directory
    * @param    {Object} opts - the options
    * @returns  {AssetsCollection} the instance of the AssetsCollection
    */
  export(src, opts): AssetsCollection {
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
  resolveAsset($assetsMap: SassMap, $uri: SassValue, cb: (error: Error | null, uri?: string, file?: string) => any) {
    let sass = this.eyeglass.options.eyeglass.engines.sass;
    let options = this.eyeglass.options.eyeglass;
    let assets = this.eyeglass.assets;
    if (!isType(sass, $uri, "string")) {
      cb(new SassTypeError(sass, "string", $uri))
      return;
    };

    // get a URI instance
    let originalUri = $uri.getValue();
    let uri = new URI(originalUri);

    // normalize the uri and resolve it

    let data = this.resolveAssetDefaults($assetsMap, uri.getPath());
    if (data) {
      let filepath = URI.restore(data.coerce.get("filepath"));

      // create the URI
      let fullUri = URI.join(
        options.httpRoot,
        options.assets.httpPrefix,
        data.coerce.get("uri")
      );

      assets.resolve(filepath, fullUri, function(error, assetInfo) {
        if (error) {
          cb(error);
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

          assets.install(filepath, assetInfo.path, function(error, file) {
            if (error) {
              cb(error);
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
  resolve(assetFile: string, assetUri: string, cb: ResolverCallback) {
    cb(null, { path: assetUri });
  }
  /**
    * wraps the current resolver with a custom resolver
    * @param    {Function} resolver - the new resolver function
    */
  resolver(resolver: WrappedResolver) {
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
  install(file, uri, cb) {
    let options = this.eyeglass.options.eyeglass;
    let httpRoot = options.httpRoot;
    if (options.buildDir) {
      // normalize the uri using the system OS path separator
      // and make it relative to the httpRoot
      uri = new URI(uri);
      uri = uri.getPath(path.sep, httpRoot);

      let dest = path.join(options.buildDir, uri);

      try {
        if (options.installWithSymlinks) {
          fs.mkdirpSync(path.dirname(dest));

          ensureSymlink(file, dest);
        } else {
          // we explicitly use copySync rather than copy to avoid starving system resources
          fs.copySync(file, dest);
        }
        cb(null, dest);
      } catch (error) {
        // eslint-disable-next-line no-ex-assign
        error = new Error("Failed to install asset from " + file + "\n" + error.toString());

        cb(error);
      }
    } else {
      cb(null, file);
    }
  }
  /**
    * wraps the current installer with a custom installer
    * @param    {Function} installer - the new installer function
    */
  installer(installer) {
    let oldInstaller = this.install.bind(this);
    this.install = function(assetFile, assetUri, cb) {
      installer(assetFile, assetUri, oldInstaller, cb);
    };
  }
  private resolveAssetDefaults(registeredAssetsMap: SassMap, relativePath: string): any {
    registeredAssetsMap = this.sassUtils.handleEmptyMap(registeredAssetsMap);
    this.sassUtils.assertType(registeredAssetsMap, "map");

    let registeredAssets = this.sassUtils.castToJs(registeredAssetsMap);

    let appAssets = registeredAssets.coerce.get(null);

    if (appAssets) {
      // XXX sassUtils.assertType(appAssets, "map");
      let appAsset = appAssets.coerce.get(relativePath);
      if (appAsset) {
        return appAsset;
      }
    }

    let segments = relativePath.split("/");
    let moduleName = segments.shift();
    let moduleRelativePath = segments.join("/");
    let moduleAssets = registeredAssets.coerce.get(moduleName);
    if (moduleAssets) {
      // XXX sassUtils.assertType(moduleAssets, "map");
      return moduleAssets.coerce.get(moduleRelativePath);
    }
  }
}


