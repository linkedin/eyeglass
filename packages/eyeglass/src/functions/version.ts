import * as stringUtils from "../util/strings";
import { SassImplementation, isSassString, typeError } from "../util/SassImplementation";
import * as sass from "node-sass";
import { EyeglassFunctions } from "./EyeglassFunctions";
import { IEyeglass } from "../IEyeglass";

const version: EyeglassFunctions = function(eyeglass: IEyeglass, sass: SassImplementation): sass.FunctionDeclarations {
  return {
    "eyeglass-version($module: eyeglass)": function($module: sass.types.Value): sass.types.Value {
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

export default version;
