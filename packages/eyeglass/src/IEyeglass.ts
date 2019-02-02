import { Config } from "./util/Options";
import Assets from "./assets/Assets";
import { DeprecateFn } from "./util/deprecator";
export interface IEyeglass {
  modules: any;
  deprecate: DeprecateFn;
  options: Config;
  assets: Assets;
}
