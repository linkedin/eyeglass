import { Config, Options, EyeglassOptions } from "./util/Options";
import { Options as SassOptions } from "./util/SassImplementation";
import Assets from "./assets/Assets";
import { DeprecateFn } from "./util/deprecator";
import EyeglassModules from "./modules/EyeglassModules";
import { SassImplementation } from "./util/SassImplementation";
export interface IEyeglass {
  modules: EyeglassModules;
  deprecate: DeprecateFn;
  options: Config;
  assets: Assets;
}
