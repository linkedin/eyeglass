import { IEyeglass } from "../IEyeglass";
import { SassImplementation, SassFunctionCallback, SassValue, isSassMap, typeError, isType, isSassList, SassMap, FunctionDeclarations } from "../util/SassImplementation";
import { EyeglassFunctions } from "./EyeglassFunctions";

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
        if (error) {
          if (error.constructor === sass.types.Error) {
            done(error);
          } else {
            done(sass.types.Error(error.message));
          }
        } else {
          done(sass.types.String(assetUri));
        }
      });
    }
  };
};
export default assetFunctions;