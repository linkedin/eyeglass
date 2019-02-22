"use strict";

import { IOptions as GlobOptions } from "glob";
import * as path from "path";
import { ModuleSpecifier } from "../modules/EyeglassModule";
import { DeprecateFn } from "./deprecator";
import { isSassImplementation, Options as SassOptions, SassImplementation } from "./SassImplementation";
import { URI } from "./URI";
import merge = require("lodash.merge");
import { Importer, FunctionDeclarations } from "node-sass";

export const DEFAULT_EYEGLASS_COMPAT = "^2.0";

export interface AssetSourceOptions {
  /**
   * The namespace of this asset source.
   */
  name?: string;
  /**
   * The httpPrefix of this source relative to the httpPrefix of all assets.
   * If not provided, the namespace of this source is used.
   */
  httpPrefix?: string;
  /**
   * The directory of this asset source.
   */
  directory: string;
  /**
   * Options for globbing files within the directory.
   */
  globOpts?: GlobOptions;
  /**
   * Pattern for globbing files within the directory.
   * Defaults to "**\/*"
   */
  pattern?: string;
}

export interface AssetOptions {
  /**
   * A list of asset sources.
   */
  sources?: Array<AssetSourceOptions>;
  /**
   * The httpPrefix for all assets relative to the project's httpRoot.
   */
  httpPrefix?: string;
  /**
   * A http prefix directory that assets urls will be relative to.
   * This would usually be set to the directory from which the CSS file being
   * rendered is served.
   *
   */
  relativeTo?: string;
}

export interface Engines {
  /**
   * If not provided, eyeglass will require `node-sass` at the version it
   * currently depends.
   */
  sass?: SassImplementation;
  [engine: string]: unknown;
}

export interface EyeglassConfig extends Required<EyeglassSpecificOptions<never>> {
  engines: Required<Engines>;
}

export interface EyeglassSpecificOptions<ExtraSandboxTypes = true | string> {
  /**
   * Where to find assets for the eyeglass project.
   */
  assets?: AssetOptions;
  /**
   * Implementations provided to eyeglass that can be used by eyeglass itself
   * or by custom functions in an eyeglass module.
   */
  engines?: Engines;
  /**
   * Manually declare an eyeglass modules for sass libraries that do not
   * declare themselves to be eyeglass modules.
   */
  modules?: Array<ModuleSpecifier>;
  /**
   * Whether to only import a sass file once per css output file.
   * Defaults to true.
   */
  enableImportOnce?: boolean;
  /**
   * Whether to install assets using symlinks or file copies.
   * Setting this to true is good for performance.
   * Defaults to false.
   */
  installWithSymlinks?: boolean;
  /**
   * Whether to normalize paths on windows.
   * Defaults to true or to the value of the environment variable
   * `EYEGLASS_NORMALIZE_PATHS`.
   */
  normalizePaths?: boolean;
  /**
   * Directory from which sass files are imported for this project.
   */
  root?: string;
  /**
   * The directory in the URL from which css files are served for this project.
   */
  httpRoot?: string;
  /**
   * Directory where eyeglass should store cache information during and across builds.
   * This will be created if it does not exist.
   */
  cacheDir?: string;
  /**
   * Directory where files are output once built.
   */
  buildDir?: string;
  /**
   * Whether to raise an error if the same eyeglass module is a dependency
   * more than once with incompatible semantic versions.
   */
  strictModuleVersions?: boolean | "warn";
  /**
   * When strictModuleVersions checking is enabled,
   * this asserts that the modules installed are compatible with the
   * version of eyeglass specified, in contradiction to those module's
   * own declaration of the version of eyeglass that they say they need.
   * This is helpful when eyeglass major releases occur and eyeglass modules
   * that you depend on haven't yet been updated, but appear to work regardless.
   *
   * The value can be any semver dependency specifier. For instance, if
   * eyeglass 3.0 is released, you can set this to "^3.0.0" and any eyeglass
   * 3.x release will be assumed ok but a 4.0 release will cause things to
   * break again.
   */
  assertEyeglassCompatibility?: string;
  /**
   * Whether to cache eyeglass modules across the entire javascript process.
   */
  useGlobalModuleCache?: boolean;
  /**
   * Ignore deprecations that started being issued at or below this version.
   */
  ignoreDeprecations?: string;
  /**
   * Whether to allow filesystem reads and if so, from which directories.
   * * `false` - allows reads from the entire filesystem (insecure).
   * * `true` - only allows reads from the `root` directory.
   * * `<string>` - a directory from which reads are allowed.
   * * `Array<string>` - A list of directories from which to allow access.
   * *   An empty list disables filesystem access (default).
   */
  fsSandbox?: ExtraSandboxTypes | false | Array<string>;
}

export interface SimpleDeprecatedOptions {
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
}

export interface DeprecatedOptions extends SimpleDeprecatedOptions {
  /** @deprecated Since 0.8 */
  assetsHttpPrefix?: string;
  /** @deprecated Since 0.8 */
  assetsRelativeTo?: string;
}

export interface EyeglassOptions {
  eyeglass?: EyeglassSpecificOptions;
  assetsCache?: (cacheKey: string, lazyValue: () => string) => void;
}
export type Options = (SassOptions & EyeglassOptions) | (DeprecatedOptions & SassOptions & EyeglassOptions) ;
export type Config = SassOptions & {
  eyeglass: EyeglassConfig;
  assetsCache?: (cacheKey: string, lazyValue: () => string) => string;
};

/* eslint-disable-next-line no-unused-vars */
export default class implements Config {
  file?: string;
  data?: string;
  importer?: Importer | Array<Importer>;
  functions?: FunctionDeclarations;
  includePaths?: Array<string>;
  indentedSyntax?: boolean;
  indentType?: string;
  indentWidth?: number;
  linefeed?: string;
  omitSourceMapUrl?: boolean;
  outFile?: string;
  outputStyle?: "compact" | "compressed" | "expanded" | "nested";
  precision?: number;
  sourceComments?: boolean;
  sourceMap?: boolean | string;
  sourceMapContents?: boolean;
  sourceMapEmbed?: boolean;
  sourceMapRoot?: string;
  eyeglass: EyeglassConfig;
  assetsCache?: (cacheKey: string, lazyValue: () => string) => string;

  constructor(...args: [Options, DeprecateFn, SassImplementation | undefined]) {
    let config = getSassOptions(...args)
    this.eyeglass = config.eyeglass; // this makes the compiler happy.
    merge(this, config);
  }
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

function migrateEyeglassOptionsFromSassOptions(sassOptions: DeprecatedOptions & SassOptions, eyeglassOptions: EyeglassSpecificOptions, deprecate: DeprecateFn): void {
  // migrates the following properties from sassOptions to eyeglassOptions
  const toMigrate: Array<keyof SimpleDeprecatedOptions> = [ "root", "cacheDir", "buildDir", "httpRoot", "strictModuleVersions" ];
  toMigrate.forEach(function(option) {
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
): void {
  if ((eyeglassOptions.assets === undefined ||
    (eyeglassOptions.assets && eyeglassOptions.assets[toOption] === undefined)) &&
    sassOptions[fromOption] !== undefined) {
    deprecate("0.8.0", "0.9.0", [
      `\`${fromOption }\` has been renamed to \`${toOption}\` and should be passed into the eyeglass asset options rather than the sass options:`,
      "var options = eyeglass({",
      "  /* sassOptions */",
      "  ...",
      "  eyeglass: {",
      "    assets: {",
      `      ${toOption}: ...`,
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

function migrateAssetOptionsFromSassOptions(sassOptions: DeprecatedOptions, eyeglassOptions: EyeglassSpecificOptions, deprecate: DeprecateFn): void {
  // migrates the following properties from sassOptions to eyeglassOptions
  migrateAssetOption(sassOptions, eyeglassOptions, deprecate, "assetsHttpPrefix", "httpPrefix");
  migrateAssetOption(sassOptions, eyeglassOptions, deprecate, "assetsRelativeTo", "relativeTo");
}

function defaultSassOptions(options: SassOptions): SassOptions {
  defaultValue(options, "includePaths", () => includePathsFromEnv());
  return options;
}

export function resolveConfig(options: Partial<EyeglassSpecificOptions>): EyeglassConfig {
  // default root dir
  defaultValue(options, "root", () => process.cwd());
  // default cache dir
  defaultValue(options, "cacheDir", () => path.join(options.root!, ".eyeglass_cache"));
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
  // There's no eyeglass module API changes in eyeglass 2.x so we default to silencing these warnings.
  defaultValue(options, "assertEyeglassCompatibility", () => DEFAULT_EYEGLASS_COMPAT);

  options.fsSandbox = normalizeFsSandbox(options.fsSandbox, options.root!);
  return options as EyeglassConfig;
}

function normalizeFsSandbox(sandboxOption: Partial<EyeglassSpecificOptions>["fsSandbox"], root: string): EyeglassConfig["fsSandbox"] {
  let fsSandbox: false | Array<string>;
  if (typeof sandboxOption === "undefined") {
    // default to no fs access
    fsSandbox = [];
  } else if (sandboxOption === true) {
    // support simple enabling of the sandbox.
    fsSandbox = [root];
  } else if (typeof sandboxOption === "string") {
    // support simple strings instead of requiring a list for even a single dir.
    fsSandbox = [sandboxOption];
  } else {
    fsSandbox = sandboxOption;
  }
  return fsSandbox;
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
    process.env.EYEGLASS_NORMALIZE_PATHS = `${eyeglassOptions.normalizePaths}`;
  }

  if (hasDeprecatedOptions(sassOptions)) {
    // migrate eyeglassOptions off of the sassOptions
    migrateEyeglassOptionsFromSassOptions(sassOptions, eyeglassOptions, deprecate);
    migrateAssetOptionsFromSassOptions(sassOptions, eyeglassOptions, deprecate);
  }

  defaultSassOptions(sassOptions);
  resolveConfig(eyeglassOptions);

  return normalizeSassOptions(sassOptions, resolveConfig(eyeglassOptions));
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
