import { IEyeglass } from "../IEyeglass";
import { SassImplementation, typeError, isType, isSassList, isSassError } from "../util/SassImplementation";
import type { SassFunctionCallback, FunctionDeclarations } from "node-sass";
import type * as nodeSass from "node-sass";
import { EyeglassFunctions } from "./EyeglassFunctions";
import { isPresent } from "../util/typescriptUtils";
import { errorMessageFor } from "../util/errorFor";

const assetFunctions: EyeglassFunctions =
function(eyeglass: IEyeglass, sass: SassImplementation): FunctionDeclarations {
  return {
    "eyeglass-asset-uri($registered-assets, $relative-path)": function($assets: nodeSass.types.Value, $uri: nodeSass.types.Value, done: SassFunctionCallback) {
      let $assetMap: nodeSass.types.Map;
      if (!isType(sass, $assets, "map")) {
        return done(typeError(sass, "map", $assets));
      }
      if (isSassList(sass, $assets)) {
        $assetMap = new sass.types.Map(0);
      } else {
        $assetMap = $assets;
      }
      eyeglass.assets.resolveAsset($assetMap, $uri, function(error, assetUri) {
        let result: nodeSass.types.Error | nodeSass.types.String;
        if (error || !isPresent(assetUri)) {
          if (isSassError(sass, error)) {
            result = error;
          } else if (isPresent(error)) {
            result = new sass.types.Error(errorMessageFor(error));
          } else {
            result = new sass.types.Error("[internal error] A uri was not returned");
          }
        } else {
          result = new sass.types.String(assetUri);
        }
        done(result);
      });
    }
  };
};
export default assetFunctions;