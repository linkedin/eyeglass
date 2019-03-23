import { Config } from "./util/Options";
import Assets from "./assets/Assets";
import { DeprecateFn } from "./util/deprecator";
import EyeglassModules from "./modules/EyeglassModules";

export interface IEyeglass {
  once<R>(key: string, firstTime: () => R): R | undefined;
  once<R>(key: string, firstTime: () => R, otherwise: () => R): R;
  modules: EyeglassModules;
  deprecate: DeprecateFn;
  options: Config;
  assets: Assets;
}
