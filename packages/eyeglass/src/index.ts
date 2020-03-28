import { Options as Opts, Config } from "./util/Options";
import EyeglassImpl, { resetGlobalCaches, _forbidNodeSassArg } from "./Eyeglass";
/* eslint-disable @typescript-eslint/no-namespace, no-inner-declarations, no-redeclare */

interface AdditionalFunctions {
  resetGlobalCaches(): void;
}

type PublicConstructor =
  typeof EyeglassImpl
  & AdditionalFunctions
  & ((options: Opts) => Config);

// This is how we convince typescript that there's an object that is
// both a constructor and a function that returns options.
function newOrOptions(): PublicConstructor {
  const __Eyeglass = function (this: undefined | object, options: Opts): EyeglassImpl | Config {
    if (arguments.length === 2) {
      _forbidNodeSassArg(arguments[1]);
    }
    let instance = new EyeglassImpl(options);
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
  __Eyeglass.resetGlobalCaches = resetGlobalCaches;
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
