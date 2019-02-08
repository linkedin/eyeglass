import { EyeglassConfig } from "./Options"
import { SassImplementation } from "./SassImplementation";
import { IEyeglass } from "../IEyeglass";

export default function(eyeglass: IEyeglass, _sass: SassImplementation, options: EyeglassConfig, version: string): void {
  let strictMode: boolean | "warn" = options.strictModuleVersions;
  let modules = eyeglass.modules;
  let issues = modules.issues.engine;

  // default to `warn`
  strictMode = (typeof strictMode === "undefined") ? "warn" : strictMode;

  // return early if not strictMode
  if (!strictMode) {
    return;
  }

  // if there are incompatible needs...
  if (issues.incompatible.length) {
    let incompatible = ["The following modules are incompatible with eyeglass " + version + ":"];
    incompatible.push.apply(incompatible, issues.incompatible.map(function(mod) {
      return `  ${mod.name} needed eyeglass ${mod.eyeglass.needs}`;
    }));

    // eslint-disable-next-line no-console
    console.error(incompatible.join("\n"));
  }

  // if there are missing needs...
  if (issues.missing.length) {
    let missing = ["The following modules did not declare an eyeglass version:"];
    missing.push.apply(missing, issues.missing.map(function(mod) {
      return "  " + mod.name;
    }));
    missing.push("Please add the following to the module's package.json:");
    missing.push("  \"eyeglass\": { \"needs\": \"^" + version + "\" }");

    // eslint-disable-next-line no-console
    console.warn(missing.join("\n"));
  }

  // if have any issues and `strictMode === true`...
  if ((issues.incompatible.length > 0 || issues.missing.length > 0) && strictMode === true) {
    // throw an error
    throw new Error("Cannot proceed with errors/warning and options.strictModuleVersions");
  }
}
