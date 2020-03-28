import { URI } from  "../util/URI";
import { IEyeglass } from "../IEyeglass";
import { SassImplementation, isSassString, typeError, isSassMap } from "../util/SassImplementation";
import type { SassFunctionCallback, FunctionDeclarations } from "node-sass";
import type * as nodeSass from "node-sass";
const IS_WINDOWS = /win32/.test(require("os").platform());

const normalizeURI = function(_eyeglass: IEyeglass, sass: SassImplementation): FunctionDeclarations {
  let methods: FunctionDeclarations = {
    "eyeglass-uri-preserve($uri)": function($uri: nodeSass.types.Value, done: SassFunctionCallback) {
      if (!isSassString(sass, $uri)) {
        return done(typeError(sass, "string", $uri));
      }
      let uri = $uri.getValue();
      // decorate the uri
      uri = URI.preserve(uri);
      done(new sass.types.String(uri));
    },
    "eyeglass-uri-restore($uri)": function($uri: nodeSass.types.Value, done: SassFunctionCallback) {
      if (!isSassString(sass, $uri)) {
        return done(typeError(sass, "string", $uri));
      }
      let uri = $uri.getValue();
      // restore the uri
      uri = URI.restore(uri);
      done(new sass.types.String(uri));
    }
  };

  if (IS_WINDOWS || process.env.EYEGLASS_NORMALIZE_PATHS) {
    let $web = new sass.types.String("web");
    let $system = new sass.types.String("system");
    let egNormalizeUri = function($uri: nodeSass.types.Value, $type: nodeSass.types.Value): nodeSass.types.String {
      if (!isSassString(sass, $type)) {
        throw typeError(sass, "string", $type);
      }
      if (!isSassString(sass, $uri)) {
        throw typeError(sass, "string", $uri);
      }
      let type = $type.getValue() as "web" | "system" | "preserve" | "restore";
      let uri = $uri.getValue();
      // normalize the uri for the given type
      uri = URI[type](uri);
      return new sass.types.String(uri);
    };
    methods["-eyeglass-normalize-uri($uri, $type: web)"] = function($uri: nodeSass.types.Value, $type: nodeSass.types.Value, done: SassFunctionCallback) {
      try {
        done(egNormalizeUri($uri, $type));
      } catch (e) {
        done(e);
      }
    };
    methods["-eyeglass-normalize-assets($assets)"] = function($assets: nodeSass.types.Value, done: SassFunctionCallback): void {
      if (!isSassMap(sass, $assets)) {
        done($assets);
        return;
      }
      let size = $assets.getLength();
      let $newAssets = new sass.types.Map(size);
      for (let i = 0; i < size; i++) {
        let $url = $assets.getKey(i);
        if (isSassString(sass, $url)) {
          $url = egNormalizeUri($url, $web);
        }
        $newAssets.setKey(i, $url)
        let $assetProps = $assets.getValue(i);
        if (isSassMap(sass, $assetProps)) {
          let numAssetProps = $assetProps.getLength();
          let $newAssetProps = new sass.types.Map(numAssetProps);
          for (let pi = 0; pi < numAssetProps; pi++) {
            let $propName = $assetProps.getKey(pi);
            let $propValue = $assetProps.getValue(pi);
            $newAssetProps.setKey(pi, $propName);
            if (isSassString(sass, $propName)) {
              let propName = $propName.getValue();
              try {
                switch (propName) {
                  case "filepath":
                    $newAssetProps.setValue(pi, egNormalizeUri($propValue, $system));
                    break;
                  case "uri":
                    $newAssetProps.setValue(pi, egNormalizeUri($propValue, $web));
                    break;
                  default:
                    $newAssetProps.setValue(pi, $propValue);
                }
              } catch(e) {
                done(e);
                return;
              }
            } else {
              $newAssetProps.setValue(pi, $propValue);
            }
          }
          $newAssets.setValue(i, $newAssetProps);
        } else {
          $newAssets.setValue(i, $assetProps);
        }
      }
      done($newAssets);
    };
  }

  return methods;
};

export default normalizeURI;