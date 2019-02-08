import { Config } from "./util/Options";
import Assets from "./assets/Assets";
import { DeprecateFn } from "./util/deprecator";
import EyeglassModules from "./modules/EyeglassModules";

export interface IEyeglass {
  modules: EyeglassModules;
  deprecate: DeprecateFn;
  options: Config;
  assets: Assets;
}
