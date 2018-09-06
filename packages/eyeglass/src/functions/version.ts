"use strict";

import * as stringUtils from "../util/strings";

export default function(eyeglass, sass) {
  return {
    "eyeglass-version($module: eyeglass)": function(moduleName) {
      var name = stringUtils.unquote(moduleName.getValue());
      var mod = eyeglass.modules.find(name);

      if (mod) {
        return sass.types.String(mod.version || "unversioned");
      } else {
        return sass.types.Null();
      }
    }
  };
};
