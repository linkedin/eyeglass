import * as stringUtils from "../util/strings";
import { SassValue, SassImplementation, isSassString, typeError } from "../util/SassImplementation";
import { EyeglassFunctions } from "./EyeglassFunctions";
import { IEyeglass } from "../IEyeglass";

const $version: EyeglassFunctions = function(eyeglass: IEyeglass, sass: SassImplementation) {
  return {
    "eyeglass-version($module: eyeglass)": function($module: SassValue): SassValue {
      if (!isSassString(sass, $module)) {
        return typeError(sass, "string", $module);
      }
      let name = stringUtils.unquoteJS(sass, $module);
      let mod = eyeglass.modules.find(name);

      if (mod) {
        return sass.types.String(mod.version || "unversioned");
      } else {
        return sass.types.Null();
      }
    }
  };
};

export default $version;
