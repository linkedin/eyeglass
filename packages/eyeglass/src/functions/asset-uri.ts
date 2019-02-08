import { IEyeglass } from "../IEyeglass";
import { SassImplementation, SassFunctionCallback, SassValue, typeError, isType, isSassList, SassMap, FunctionDeclarations, SassString, isSassError } from "../util/SassImplementation";
import { EyeglassFunctions } from "./EyeglassFunctions";
import { isPresent } from "../util/typescriptUtils";
import { SassError } from "node-sass";

const assetFunctions: EyeglassFunctions =
function(eyeglass: IEyeglass, sass: SassImplementation): FunctionDeclarations {
  return {
    "eyeglass-asset-uri($registered-assets, $relative-path)": function($assets: SassValue, $uri: SassValue, done: SassFunctionCallback) {
      let $assetMap: SassMap;
      if (!isType(sass, $assets, "map")) {
        return done(typeError(sass, "map", $assets));
      }
      if (isSassList(sass, $assets)) {
        $assetMap = sass.types.Map(0);
      } else {
        $assetMap = $assets;
      }
      eyeglass.assets.resolveAsset($assetMap, $uri, function(error, assetUri) {
        let result: SassError | SassString;
        if (error || !isPresent(assetUri)) {
          if (isSassError(sass, error)) {
            result = error;
          } else if (isPresent(error)) {
            result = sass.types.Error(error.message || error.toString());
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