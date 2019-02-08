import * as semver from "semver";
import {Options} from "./Options"
const DEFAULT_VERSION = "0.0.0";

export class Deprecator {
  ignoreDeprecations: string | undefined;
  enabled: boolean | undefined;
  constructor(options: Options) {
    this.ignoreDeprecations = options && options.eyeglass && options.eyeglass.ignoreDeprecations;
  }

  isEnabled(sinceVersion: string): boolean {
    // if `enabled` is undefined, try to set it
    if (this.enabled === undefined) {
      // if `disableDeprecations`, we fallback to the env variable
      if (this.ignoreDeprecations === undefined) {
        // return early and don't set `enabled`, as we'll check the env every time
        // TODO: Ask eugene why we need to worry about the env variable changing.
        return !semver.lte(sinceVersion, process.env.EYEGLASS_DEPRECATIONS || DEFAULT_VERSION);
      }
      this.enabled = !semver.lte(sinceVersion, this.ignoreDeprecations || DEFAULT_VERSION);
    }

    return this.enabled;
  }

  deprecate(sinceVersion: string, removeVersion: string, message: string): void {
    if (this.isEnabled(sinceVersion)) {
      // eslint-disable-next-line no-console
      console.warn(
        "[eyeglass:deprecation]",
        "(deprecated in " + sinceVersion + ", will be removed in " + removeVersion + ")",
        message);
    }
  }
}

export type DeprecateFn = Deprecator["deprecate"];

export interface DeprecatorFactory {
  (options: Options): DeprecateFn;
}


const factory: DeprecatorFactory = (options: Options): DeprecateFn => {
  let deprecator = new Deprecator(options);
  return deprecator.deprecate.bind(deprecator);
}

export default factory;
