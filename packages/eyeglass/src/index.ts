import { Options as Opts, Config } from "./util/Options";
import { IEyeglass } from "./IEyeglass";
import { SassImplementation } from "./util/SassImplementation";
import EyeglassImpl from "./Eyeglass";
/* eslint-disable @typescript-eslint/no-namespace, no-inner-declarations, no-redeclare */

function deprecateMethodWarning(this: IEyeglass, method: string): void {
  this.deprecate("0.8.0", "0.9.0",
    "`require('eyeglass')." + method + "` is deprecated. " +
    "Instead, use `require('eyeglass')`"
  );
}

interface DeprecatedFunctions {
  Eyeglass(options: Opts, deprecatedNodeSassArg?: SassImplementation): EyeglassImpl;
  decorate(options: Opts, deprecatedNodeSassArg?: SassImplementation): Config;
}

type PublicConstructor =
  typeof EyeglassImpl
  & DeprecatedFunctions
  & ((options: Opts, deprecatedNodeSassArg?: SassImplementation) => Config);

// This is how we convince typescript that there's an object that is
// both a constructor and a function that returns options.
function newOrOptions(): PublicConstructor {
  const __Eyeglass = function (this: undefined | object, options: Opts, deprecatedNodeSassArg?: SassImplementation): EyeglassImpl | Config {
    let instance = new EyeglassImpl(options, deprecatedNodeSassArg);
    if (this) {
      // the implicit this object is thrown away :engineer-shrugging:
      return instance;
    } else {
      return instance.options;
    }
  }
  __Eyeglass.prototype = EyeglassImpl.prototype;
  __Eyeglass.VERSION = EyeglassImpl.VERSION;
  __Eyeglass.helpers = EyeglassImpl.helpers;
  Object.assign(__Eyeglass, {
    Eyeglass(options: Opts, deprecatedNodeSassArg?: SassImplementation): EyeglassImpl {
      let eyeglass = new EyeglassImpl(options, deprecatedNodeSassArg);
      deprecateMethodWarning.call(eyeglass, "Eyeglass");
      return eyeglass;
    },
    decorate(options: Opts, deprecatedNodeSassArg?: SassImplementation): Config {
      let eyeglass = new EyeglassImpl(options, deprecatedNodeSassArg);
      deprecateMethodWarning.call(eyeglass, "decorate");
      return eyeglass.options;
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return __Eyeglass as any; // we have to cast through any otherwise typescript thinks this function doesn't implement the full API of EyeglassImpl.
}

type Eyeglass = EyeglassImpl;
const Eyeglass = newOrOptions();

namespace Eyeglass {
  export type EyeglassOptions = Opts;
  export type EyeglassConfig = Config;
}
export = Eyeglass;

/* eslint-enable @typescript-eslint/no-namespace */
