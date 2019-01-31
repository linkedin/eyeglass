// TODO: Annotate Types
import * as semver from "semver";
const DEFAULT_VERSION = "0.0.0";

export class Deprecator {
  ignoreDeprecations: string;
  enabled: boolean;
  constructor(options) {
  this.ignoreDeprecations = options && options.eyeglass && options.eyeglass.ignoreDeprecations;
}

isEnabled(sinceVersion) {
  // if `enabled` is undefined, try to set it
  if (this.enabled === undefined) {
    // if `disableDeprecations`, we fallback to the env variable
    if (this.ignoreDeprecations === undefined) {
      // return early and don't set `enabled`, as we'll check the env everytime
      return !semver.lte(sinceVersion, process.env.EYEGLASS_DEPRECATIONS || DEFAULT_VERSION);
    }
    this.enabled = !semver.lte(sinceVersion, this.ignoreDeprecations || DEFAULT_VERSION);
  }

  return this.enabled;
}

deprecate(sinceVersion, removeVersion, message) {
  if (this.isEnabled(sinceVersion)) {
    // eslint-disable-next-line no-console
    console.warn(
      "[eyeglass:deprecation]",
       "(deprecated in " + sinceVersion + ", will be removed in " + removeVersion + ")",
       message);
  }
}
}

interface DeprecatorFactory {
  (options): Deprecator;
}

const factory: DeprecatorFactory = (options) => {
  let deprecator = new Deprecator(options);
  return deprecator.deprecate.bind(deprecator);
}

export default factory;
