"use strict";
// TODO: Annotate Types

import * as stringUtils from "../util/strings";
import { SassValue } from "../util/SassImplementation";

export default function(eyeglass, sass) {
  return {
    "eyeglass-version($module: eyeglass)": function(moduleName: SassValue) {
      var name = stringUtils.unquoteJS(sass, moduleName);
      var mod = eyeglass.modules.find(name);

      if (mod) {
        return sass.types.String(mod.version || "unversioned");
      } else {
        return sass.types.Null();
      }
    }
  };
};
