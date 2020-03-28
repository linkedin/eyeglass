import * as packageUtils from "../util/package";
import merge = require("lodash.merge");
import includes = require("lodash.includes");
import * as path from "path";
import { IEyeglass } from "../IEyeglass";
import { SassImplementation } from "../util/SassImplementation";
import type { FunctionDeclarations } from "node-sass";
import packageJson = require("package-json");
import AssetsCollection from "../assets/AssetsCollection";
import { Dict, isPresent } from "../util/typescriptUtils";
import { realpathSync } from "../util/perf";
import { SemVer } from "semver";

type PackageJson = packageJson.FullVersion;

const rInvalidName = /\.(?:sass|s?css)$/;
const EYEGLASS_KEYWORD: "eyeglass-module" = "eyeglass-module";

export interface DiscoverOptions {
  isRoot: boolean;
  dir: string;
  pkg?: packageUtils.Package;
}

export interface EyeglassModuleExports {
  name?: string;
  functions?: FunctionDeclarations;
  assets?: AssetsCollection;
  sassDir?: string;
  eyeglass?: {
    needs?: string;
  };
}

interface EyeglassModuleOptionsFromPackageJSON {
  inDevelopment?: boolean;
  name?: string;
  exports?: string | false;
  sassDir?: string;
  needs?: string;
}

interface PackageEyeglassOption {
  eyeglass?: string | EyeglassModuleOptionsFromPackageJSON;
}
type PackageJsonWithEyeglassOptions = PackageJson & PackageEyeglassOption;

type EyeglassOptionInPackageJSON = PackageJsonWithEyeglassOptions["eyeglass"];

export type EyeglassModuleMain =
  (eyeglass: IEyeglass, sass: SassImplementation) => EyeglassModuleExports;

export type ModuleSpecifier = ModuleReference | ManualModuleOptions;

export interface ModuleReference {
  path: string;
  /**
   * XXX I don't think dependencies are ever actually
   * passed along with a path reference but the code allows it.
   */
  dependencies?: Array<EyeglassModule>;
  isEyeglassModule?: boolean;
}
export interface ManualModuleOptions {
  /**
   * The name of the module.
   */
  name?: string;
  /**
   * The function that would normally be exported from the
   * eyeglass exports file.
   */
  main?: EyeglassModuleMain | null;
  /**
   * If a main function is provided this path to the
   * filename where it is defined should be provided
   * for better error messages in some situations.
   */
  mainPath?: string | undefined;
  /**
   * The directory where sass files are found for this module.
   */
  sassDir?: string;
  /**
   * A version for this manual module.
   */
  version?: string;
  eyeglass?: {
    /**
     * The name of the module for the purpose of importing
     * from sass files.
     */
    name?: string;
    /**
     * Alternative way to specify the directory where sass files are found for
     * this module.
     */
    sassDir?: string;
    /**
     * The semver dependency on eyeglass's module API.
     */
    needs?: string;
  };
}

interface IEyeglassModule {
  inDevelopment: boolean;
  /**
   * The resolved name of the eyeglass module.
   */
  name: string;
  /**
   * The name of the package which may be different from the name of the
   * eyeglass module.
   */
  rawName: string;
  /**
   * Options for the module that were passed from package.json
   */
  eyeglass: EyeglassModuleOptionsFromPackageJSON;
  /**
   * The absolute path to this module.
   */
  path: string;
  /**
   * The exports function used to help initialize this module.
   */
  main?: EyeglassModuleMain | null;
  /**
   * The path to main/exports function. Used for debugging.
   */
  mainPath?: string | null;
  /**
   * Whether this is an eyeglass module. Manual modules
   * and the application itself are modules where this is false.
   */
  isEyeglassModule: boolean;
  /**
   * Whether this is the project root.
   */
  isRoot: boolean;
  /**
   * The version of this module.
   */
  version: string | undefined;
  /**
   * The other modules this module depends on. The dependency tree is
   * eventually flattened with a semver resolution to select a single instance
   * of shared transitive dependencies.
   */
  dependencies: Dict<EyeglassModule>;
  /**
   * Where the sass files are. `@import "<module name>"` would import the index
   * sass file from that directory. Imports of paths relative to the module
   * name are imported relative to this directory.
   */
  sassDir?: string;
}

export function isModuleReference(mod: unknown): mod is ModuleReference {
  return typeof mod === "object" && mod !== null && typeof (<ModuleReference>mod).path === "string";
}

export default class EyeglassModule implements IEyeglassModule, EyeglassModuleExports {
  inDevelopment: boolean;
  dependencies: Dict<EyeglassModule>;
  eyeglass: EyeglassModuleOptionsFromPackageJSON;
  isEyeglassModule: boolean;
  isRoot: boolean;
  name: string;
  path: string;
  rawName: string;
  version: string | undefined;
  sassDir?: string;
  main?: EyeglassModuleMain | null;
  mainPath?: string | null;
  /** only present after calling `init()` */
  functions?: FunctionDeclarations;
  /** only present after calling `init()` */
  assets?: AssetsCollection;
  semver: SemVer;

  constructor(
    modArg: ModuleReference | ManualModuleOptions,
    discoverModules?: (opts: DiscoverOptions) => Dict<EyeglassModule> | null,
    isRoot: boolean = false
  ) {
    // some defaults
    let mod: IEyeglassModule = merge({
      eyeglass: {}
    }, modArg as IEyeglassModule);


    // if we were given a path, resolve it to the package.json
    if (isModuleReference(mod)) {
      let pkg = packageUtils.getPackage<PackageEyeglassOption>(mod.path);

      // if pkg.data is empty, this is an invalid path, so throw an error
      if (!pkg.data) {
        throw new Error("Could not find a valid package.json at " + mod.path);
      }

      let modulePath = realpathSync(path.dirname(pkg.path));
      mod = merge(
        {
          isEyeglassModule: EyeglassModule.isEyeglassModule(pkg.data),
          inDevelopment: false,
          isRoot
        },
        mod,
        {
          path: modulePath,
          name: getModuleName(pkg.data),
          rawName: pkg.data.name,
          version: pkg.data.version,
          // only resolve dependencies if we were given a discoverModules function
          dependencies: discoverModules && discoverModules({
            dir: modulePath,
            isRoot: isRoot
          }) || mod.dependencies, // preserve any passed in dependencies
          eyeglass: normalizeEyeglassOptions(pkg.data.eyeglass, modulePath)
        }
      );

      if (mod.isEyeglassModule) {
        let moduleMain = getModuleExports(pkg.data, modulePath);
        let mainInfo: Pick<EyeglassModule, "main" | "mainPath"> = {
          main: moduleMain && (require(moduleMain) as EyeglassModuleMain) || null,
          mainPath: moduleMain
        };
        merge(mod, mainInfo);

        if (rInvalidName.test(mod.name)) {
          throw new Error("An eyeglass module cannot contain an extension in it's name: " + mod.name);
        }
      }
    }

    // if a sassDir is specified in eyeglass options, it takes precedence
    mod.sassDir = mod.eyeglass.sassDir || mod.sassDir;

    // set the rawName if it's not already set
    mod.rawName = mod.rawName || mod.name;

    // these are handled by merge but are here to make the compiler happy
    // TODO: Rewrite this to not use the intermediate object.
    this.dependencies = mod.dependencies;
    this.eyeglass = mod.eyeglass;
    this.isEyeglassModule = mod.isEyeglassModule;
    this.name = mod.name;
    this.path = mod.path;
    this.rawName = mod.rawName;
    this.version = mod.version;
    this.inDevelopment = mod.inDevelopment;
    this.isRoot = mod.isRoot;

    // merge the module properties into the instance
    merge(this, mod);
    if (this.version) {
      this.semver = new SemVer(this.version);
    } else {
      this.semver = new SemVer("0.0.0");
    }
  }

  /**
    * initializes the module with the given engines
    *
    * @param   {Eyeglass} eyeglass - the eyeglass instance
    * @param   {Function} sass - the sass engine
    */
  init(eyeglass: IEyeglass, sass: SassImplementation): void {
    merge(this, this.main && this.main(eyeglass, sass));
  }

  /**
    * whether or not the given package is an eyeglass module
    *
    * @param   {Object} pkg - the package.json
    * @returns {Boolean} whether or not it is an eyeglass module
    */
  static isEyeglassModule(pkg: PackageJson | undefined | null): boolean {
    return !!(isPresent(pkg) && includes(pkg.keywords, EYEGLASS_KEYWORD));
  }

  hasModulePath(path: string): boolean {
    if (this.path === path) {
      return true;
    }
    let keys = this.dependencies ? Object.keys(this.dependencies) : [];
    for (let depKey of keys) {
      let dep = this.dependencies[depKey];
      if (dep instanceof EyeglassModule && dep.hasModulePath(path)) {
        return true;
      }
    }
    return false;
  }
}



/**
  * given a package.json reference, gets the Eyeglass module name
  *
  * @param   {Object} pkg - the package.json reference
  * @returns {String} the name of the module
  */
function getModuleName(pkg: PackageJson & PackageEyeglassOption): string | undefined {
  // check for `eyeglass.name` first, otherwise use `name`
  return normalizeEyeglassOptions(pkg.eyeglass).name || pkg.name;
}

/**
  * normalizes a given `eyeglass` reference from a package.json
  *
  * @param   {Object} options - The eyeglass options from the package.json
  * @param   {String} pkgPath - The location of the package.json.
  * @returns {Object} the normalized options
  */
function normalizeEyeglassOptions(options: EyeglassOptionInPackageJSON, pkgPath?: string): EyeglassModuleOptionsFromPackageJSON {
  let normalizedOpts: EyeglassModuleOptionsFromPackageJSON;
  if (typeof options === "object") {
    normalizedOpts = options;
  } else if (typeof options === "string") {
    // if it's a string, treat it as the export
    normalizedOpts = {
      exports: options
    };
  } else {
    normalizedOpts = {};
  }

  if (pkgPath && normalizedOpts.sassDir) {
    normalizedOpts.sassDir = path.resolve(pkgPath, normalizedOpts.sassDir);
  }

  return normalizedOpts;
}

/**
  * gets the export from a given `eyeglass` reference from a package.json
  *
  * @param   {Object} options - the eyeglass options from the package.json
  * @returns {Object} the normalized options
  */
function getExportsFileFromOptions(options: EyeglassOptionInPackageJSON): string | false | undefined {
  return normalizeEyeglassOptions(options).exports;
}

/**
  * gets the export for a given package.json
  *
  * @param   {Object} pkg - the package.json
  * @param   {String} modulePath - the path to the module
  * @returns {String} the export file to use
  */
function getModuleExports(pkg: PackageJsonWithEyeglassOptions, modulePath: string): string | null {
  let exportsFile = getExportsFileFromOptions(pkg.eyeglass);

  if (exportsFile === false) {
    return null;
  } else {
    exportsFile = exportsFile || pkg.main;
  }

  if (exportsFile) {
    return path.join(modulePath, exportsFile);
  } else {
    return null;
  }
}
