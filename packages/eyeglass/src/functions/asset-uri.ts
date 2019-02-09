import { IEyeglass } from "../IEyeglass";
import { SassImplementation, typeError, isType, isSassList, isSassError } from "../util/SassImplementation";
import { SassFunctionCallback, FunctionDeclarations } from "node-sass";
import * as sass from "node-sass";
import { EyeglassFunctions } from "./EyeglassFunctions";
import { isPresent } from "../util/typescriptUtils";
import { errorMessageFor } from "../util/errorFor";

const assetFunctions: EyeglassFunctions =
function(eyeglass: IEyeglass, sass: SassImplementation): FunctionDeclarations {
  return {
    "eyeglass-asset-uri($registered-assets, $relative-path)": function($assets: sass.types.Value, $uri: sass.types.Value, done: SassFunctionCallback) {
      let $assetMap: sass.types.Map;
      if (!isType(sass, $assets, "map")) {
        return done(typeError(sass, "map", $assets));
      }
      if (isSassList(sass, $assets)) {
        $assetMap = sass.types.Map(0);
      } else {
        $assetMap = $assets;
      }
      eyeglass.assets.resolveAsset($assetMap, $uri, function(error, assetUri) {
        let result: sass.types.Error | sass.types.String;
        if (error || !isPresent(assetUri)) {
          if (isSassError(sass, error)) {
            result = error;
          } else if (isPresent(error)) {
            result = sass.types.Error(errorMessageFor(error));
          } else {
            result = sass.types.Error("[internal error] A uri was not returned");
          }
        } else {
          result = sass.types.String(assetUri);
        }
        done(result);
      });
    }
  };
};
export default assetFunctions;