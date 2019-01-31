"use strict";

import * as path from "path";
import merge = require("lodash.merge");
import { URI } from "./URI";
import  { IOptions as GlobOptions } from "glob";
import {
  SassImplementation,
  Options as SassOptions,
  isSassImplementation
} from "./SassImplementation";

type DeprecateFn = Function;

declare module "node-sass" {
  interface Options {
    eyeglass?: EyeglassSpecificOptions;
  }
}

interface AssetSourceOptions {
  directory: string;
  globOpts: GlobOptions;
}

interface AssetOptions {
  sources?: Array<AssetSourceOptions>;
  httpPrefix?: string;
  relativeTo?: string;
}

interface Engines {
  sass?: SassImplementation;
  [engine: string]: any;
}

interface EyeglassConfig extends Required<EyeglassSpecificOptions> {
  engines: Required<Engines>;
  fsSandbox: false | Array<string>;
}

interface EyeglassSpecificOptions {
  assets?: AssetOptions;
  engines?: Engines;
  modules?: Array<any>;
  enableImportOnce?: boolean;
  normalizePaths?: boolean;
  root?: string;
  httpRoot?: string;
  cacheDir?: string;
  buildDir?: string;
  strictModuleVersions?: boolean;
  useGlobalModuleCache?: boolean;
  fsSandbox?: true | false | string | Array<string>;
}
interface DeprecatedOptions {
  /** @deprecated Since 0.8. */
  root?: string;
  /** @deprecated Since 0.8 */
  httpRoot?: string;
  /** @deprecated Since 0.8 */
  cacheDir?: string;
  /** @deprecated Since 0.8 */
  buildDir?: string;
  /** @deprecated Since 0.8 */
  strictModuleVersions?: boolean;
  /** @deprecated Since 0.8 */
  assetsHttpPrefix?: string;
  /** @deprecated Since 0.8 */
  assetsRelativeTo?: string;
}

type Options = SassOptions | DeprecatedOptions & SassOptions;
type Config = SassOptions & { eyeglass: EyeglassConfig };

/* eslint-disable-next-line no-unused-vars */
export default function Options(...args: [Options, Function, SassImplementation]) {
  // get the normalized Sass options
  let options = getSassOptions(...args);

  // merge the incoming options onto the instance
  merge(this, options);
}

function eyeglassOptionsFromNodeSassArg(arg: SassImplementation | undefined, deprecate: DeprecateFn): Pick<EyeglassConfig, "engines"> | void {
  if (isSassImplementation(arg)) {
    // throw a deprecation warning
    deprecate("0.8.0", "0.9.0", [
      "You should no longer pass `sass` directly to Eyeglass. Instead pass it as an option:",
      "var options = eyeglass({",
      "  /* sassOptions */",
      "  ...",
      "  eyeglass: {",
      "    engines: {",
      "      sass: require('node-sass')",
      "    }",
      "  }",
      "});"
    ].join("\n  "));

    // and convert it the correct format
    return {
      engines: {
        sass: arg
      }
    };
  }
}

function includePathsFromEnv(): Array<string> {
  return normalizeIncludePaths(process.env.SASS_PATH, process.cwd());
}

function migrateEyeglassOptionsFromSassOptions(sassOptions: DeprecatedOptions & SassOptions, eyeglassOptions: EyeglassSpecificOptions, deprecate: DeprecateFn) {
  // migrates the following properties from sassOptions to eyeglassOptions
  [
    "root",
    "cacheDir",
    "buildDir",
    "httpRoot",
    "strictModuleVersions"
  ].forEach(function(option: keyof DeprecatedOptions) {
    if (eyeglassOptions[option] === undefined && sassOptions[option] !== undefined) {
      deprecate("0.8.0", "0.9.0", [
        "`" + option + "` should be passed into the eyeglass options rather than the sass options:",
        "var options = eyeglass({",
        "  /* sassOptions */",
        "  ...",
        "  eyeglass: {",
        "    " + option + ": ...",
        "  }",
        "});"
      ].join("\n  "));

      eyeglassOptions[option] = sassOptions[option];
      delete sassOptions[option];
    }
  });
}

function migrateAssetOption<FromOpt extends "assetsHttpPrefix" | "assetsRelativeTo">(
  sassOptions: DeprecatedOptions,
  eyeglassOptions: EyeglassSpecificOptions,
  deprecate: DeprecateFn,
  fromOption: FromOpt,
  toOption: typeof fromOption extends "assetsHttpPrefix" ? "httpPrefix" : "relativeTo"
) {
  if ((eyeglassOptions.assets === undefined ||
    (eyeglassOptions.assets && eyeglassOptions.assets[toOption] === undefined)) &&
    sassOptions[fromOption] !== undefined) {
    deprecate("0.8.0", "0.9.0", [
      "`" + fromOption +
      "` has been renamed to `" + toOption +
      "` and should be passed into the eyeglass asset options rather than the sass options:",
      "var options = eyeglass({",
      "  /* sassOptions */",
      "  ...",
      "  eyeglass: {",
      "    assets: {",
      "      " + toOption + ": ...",
      "    }",
      "  }",
      "});"
    ].join("\n  "));

    if (eyeglassOptions.assets === undefined) {
      eyeglassOptions.assets = {};
    }
    eyeglassOptions.assets[toOption] = sassOptions[fromOption];
    delete sassOptions[fromOption];
  }
}

function migrateAssetOptionsFromSassOptions(sassOptions: DeprecatedOptions, eyeglassOptions: EyeglassSpecificOptions, deprecate: DeprecateFn) {
  // migrates the following properties from sassOptions to eyeglassOptions
  migrateAssetOption(sassOptions, eyeglassOptions, deprecate, "assetsHttpPrefix", "httpPrefix");
  migrateAssetOption(sassOptions, eyeglassOptions, deprecate, "assetsRelativeTo", "relativeTo");
}

function defaultSassOptions(options: SassOptions): SassOptions {
  defaultValue(options, "includePaths", () => includePathsFromEnv());
  return options;
}

function defaultEyeglassOptions(options: Partial<EyeglassSpecificOptions>): EyeglassSpecificOptions {
  // default root dir
  defaultValue(options, "root", () => process.cwd());
  // default cache dir
  defaultValue(options, "cacheDir", () => path.join(options.root, ".eyeglass_cache"));
  // default engines
  defaultValue(options, "engines", () => {return {};});
  defaultValue(options.engines!, "sass", () => require("node-sass"))
  // default assets
  defaultValue(options, "assets", () => {return {};});
  // default httpRoot
  defaultValue(options, "httpRoot", () => "/");
  // default enableImportOnce
  defaultValue(options, "enableImportOnce", () => true);
  // use global module caching by default
  defaultValue(options, "useGlobalModuleCache", () => true);
  // default to no fs access
  defaultValue(options, "fsSandbox", () => []);

  return <EyeglassSpecificOptions>options;
}

function normalizeIncludePaths(
  includePaths: string | Array<string> | undefined,
  baseDir: string
): Array<string> {
  if (!includePaths) {
    return [];
  }

  // in some cases includePaths is a path delimited string
  if (typeof includePaths === "string") {
    includePaths = includePaths.split(path.delimiter);
  }

  // filter out empty paths
  includePaths = includePaths.filter((dir) => !!dir);

  // make all relative include paths absolute
  return includePaths.map((dir) => path.resolve(baseDir, URI.system(dir)));
}

function normalizeEyeglassOptions(eyeglassOptions: EyeglassSpecificOptions): EyeglassConfig {
  let fsSandbox: false | Array<string>;
  if (eyeglassOptions.fsSandbox === true) {
    // support simple enabling of the sandbox.
    fsSandbox = [eyeglassOptions.root];
  } else if (typeof eyeglassOptions.fsSandbox === "string") {
    // support simple strings instead of requiring a list for even a single dir.
    fsSandbox = [eyeglassOptions.fsSandbox];
  } else {
    fsSandbox = eyeglassOptions.fsSandbox;
  }
  return Object.assign(<EyeglassConfig>eyeglassOptions, { fsSandbox });
}

function normalizeSassOptions(sassOptions: SassOptions, eyeglassOptions: EyeglassConfig): Config {
  sassOptions.includePaths = normalizeIncludePaths(sassOptions.includePaths, eyeglassOptions.root);
  return Object.assign(sassOptions, {eyeglass: eyeglassOptions});
}

const DEPRECATED_OPTIONS = new Set<keyof DeprecatedOptions>([
  "root",
  "httpRoot",
  "cacheDir",
  "buildDir",
  "strictModuleVersions",
  "assetsHttpPrefix",
  "assetsRelativeTo",
]);

function hasDeprecatedOptions(options: Options): options is DeprecatedOptions & SassOptions {
  for (let key in options) {
    if ((DEPRECATED_OPTIONS as Set<string>).has(key)) {
      return true;
    }
  }
  return false;
}

function getSassOptions(
  options: Options | undefined,
  deprecate: DeprecateFn,
  sassArg: SassImplementation | undefined
): Config {
  let sassOptions: Options = options || {};
  // we used to support passing `node-sass` as the second argument to eyeglass,
  //  this should now be an options object
  // if the eyeglassOptions looks like node-sass, convert it into an object
  // this can be removed when we fully deprecate this support
  let eyeglassOptions: EyeglassSpecificOptions =  merge({}, eyeglassOptionsFromNodeSassArg(sassArg, deprecate));
  merge(eyeglassOptions, sassOptions.eyeglass);

  // determine whether or not we should normalize URI path separators
  // @see URI
  if (eyeglassOptions.normalizePaths !== undefined) {
    // TODO: make the code read the config from options which is defaulted from the env var
    process.env.EYEGLASS_NORMALIZE_PATHS = "" + eyeglassOptions.normalizePaths;
  }

  if (hasDeprecatedOptions(sassOptions)) {
    // migrate eyeglassOptions off of the sassOptions
    migrateEyeglassOptionsFromSassOptions(sassOptions, eyeglassOptions, deprecate);
    migrateAssetOptionsFromSassOptions(sassOptions, eyeglassOptions, deprecate);
  }

  defaultSassOptions(sassOptions);
  defaultEyeglassOptions(eyeglassOptions);

  return normalizeSassOptions(sassOptions, normalizeEyeglassOptions(eyeglassOptions));
}

function defaultValue<
  T extends object,
  K extends keyof T,
  V extends () => T[K]
>(obj: T, key: K, value: V): void {
  if (obj[key] === undefined) {
    obj[key] = value();
  }
}
