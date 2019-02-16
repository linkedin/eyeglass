import AssetsSource from "./AssetsSource";
import * as stringUtils from "../util/strings";
import { URI } from "../util/URI";
import { Config, AssetSourceOptions } from "../util/Options";
import { SassImplementation } from "../util/SassImplementation";

let assetRegisterTmpl = "@include asset-register(${namespace}, ${name}, ${sourcePath}, ${uri});\n";

export default class AssetsCollection {
  options: Config;
  sass: SassImplementation;
  sources: Array<AssetsSource>;

  constructor(options: Config) {
    this.options = options;
    this.sass = options.eyeglass.engines.sass;
    this.sources = [];
  }

  /**
    * adds an AssetsSource to the collection
    * @param    {String} src - the source directory of the assets
    * @param    {Object} opts - the options to pass @see AssetsSource
    * @returns  {AssetsCollection} returns the instance of AssetsCollection for chaining
    */
  addSource(src: string, opts: Partial<AssetSourceOptions>): AssetsCollection {
    this.sources.push(new AssetsSource(src, opts));
    return this;
  }

  /**
    * returns the scss to register all the assets
    * @param    {String} name - the namespace to use
    * @returns  {String} the scss representation of the asset registration
    */
  asAssetImport(name: string | undefined): string {
    // builds the scss to register all the assets
    // this will look something like...
    //  @import "eyeglass/assets";
    //  @include asset-register(
    //    "namespace",
    //    "path/to/foo.png",
    //    "/absolute/namespace/path/to/foo.png",
    //    "namespace/path/to/foo.png"
    //  );
    return this.sources.reduce((importStr, source) => {
      // get the assets for the entry
      let assets = source.getAssets(name);
      let namespace = (stringUtils.quoteJS(this.sass, assets.namespace) || "null");
      // reduce the assets into a `asset-register` calls
      return importStr + assets.files.reduce((registerStr, asset) => {
        return registerStr + stringUtils.tmpl(this.sass, assetRegisterTmpl, {
          namespace: namespace,
          name: URI.sass(this.sass, asset.name),
          sourcePath: URI.sass(this.sass, asset.sourcePath),
          uri: URI.sass(this.sass, asset.uri)
        });
      }, "");
    }, '@import "eyeglass/assets";\n');
  }

  /**
    * Build a string suitable for caching an instance of this
    * @returns {String} the cache key
    */
  cacheKey(name: string): string {
    return this.sources.map(function (source) {
      return source.cacheKey(name);
    }).sort().join("\x00");
  }
}
