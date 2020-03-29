import * as stringUtils from "../util/strings";
import { SassImplementation, isSassString, typeError } from "../util/SassImplementation";
import type * as nodeSass from "node-sass";
import { EyeglassFunctions } from "./EyeglassFunctions";
import { IEyeglass } from "../IEyeglass";

const version: EyeglassFunctions = function(eyeglass: IEyeglass, sass: SassImplementation): nodeSass.FunctionDeclarations {
  return {
    "eyeglass-version($module: eyeglass)": function($module: nodeSass.types.Value): nodeSass.types.ReturnValue {
      if (!isSassString(sass, $module)) {
        return typeError(sass, "string", $module);
      }
      let name = stringUtils.unquoteJS(sass, $module);
      let mod = eyeglass.modules.find(name);

      if (mod) {
        return new sass.types.String(mod.version || "unversioned");
      } else {
        return sass.types.Null.NULL;
      }
    }
  };
};

export default version;
