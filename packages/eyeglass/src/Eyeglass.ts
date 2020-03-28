import EyeglassModules, { resetGlobalCaches as resetGlobalModuleCaches } from "./modules/EyeglassModules";
import ModuleFunctions from "./modules/ModuleFunctions";
import ModuleImporter from "./importers/ModuleImporter";
import AssetImporter from "./importers/AssetImporter";
import FSImporter from "./importers/FSImporter";
import Options, {Options as Opts, Config, ForbiddenOptions, EyeglassConfig} from "./util/Options";
import Assets from "./assets/Assets";
import deprecator, { DeprecateFn } from "./util/deprecator";
import semverChecker from "./util/semverChecker";
import * as fs from "fs-extra";
import { IEyeglass } from "./IEyeglass";
import type { SassFunction, AsyncImporter } from "node-sass";
import { SassImplementation, helpers as sassHelpers, isSassImplementation } from "./util/SassImplementation";
import { UnsafeDict, Dict } from "./util/typescriptUtils";
import heimdall = require("heimdalljs");
import { SimpleCache } from "./util/SimpleCache";
import { resetGlobalCaches as resetGlobalFSCaches } from "./util/perf";
import eyeglassVersion from "./util/version";
import debugGenerator from "debug";

const debug = debugGenerator("eyeglass:initialization");

export function resetGlobalCaches(): void {
  resetGlobalModuleCaches();
  resetGlobalFSCaches();
}

export default class Eyeglass implements IEyeglass {
  static VERSION: string = eyeglassVersion.string;

  deprecate: DeprecateFn;
  options: Config;
  assets: Assets;
  modules: EyeglassModules;
  private onceCache: SimpleCache<true>;

  constructor(options: Opts) {
    if (arguments.length === 2) {
      _forbidNodeSassArg(arguments[1]);
    }
    let timer = heimdall.start("eyeglass:instantiation");
    this.onceCache = new SimpleCache<true>();
    try {
      // an interface for deprecation warnings
      this.deprecate = deprecator(options);

      this.options = new Options(options);
      this.assets = new Assets(this, this.options.eyeglass.engines.sass);
      this.modules = new EyeglassModules(
        this.options.eyeglass.root,
        this.options,
        this.options.eyeglass.modules,
      );

      fs.mkdirpSync(this.options.eyeglass.cacheDir);

      semverChecker(this, this.options.eyeglass.engines.sass, this.options.eyeglass, Eyeglass.VERSION);

      checkMissingDependencies.call(this);

      checkDependencyConflicts.call(this);

      // initialize all the modules
      this.modules.init(this, this.options.eyeglass.engines.sass);

      // add importers and functions
      addImporters.call(this);
      addFunctions.call(this);

      forbidProperties.call(this, ["enableImportOnce"]);

      // auto-add asset paths specified via options
      if (this.options.eyeglass.assets.sources) {
        for (let assetSource of this.options.eyeglass.assets.sources) {
          this.assets.addSource(assetSource.directory, assetSource);
        }
      }
    } catch(e) {
      // typescript needs this catch & throw to convince it that the instance properties are initialized.
      throw e;
    } finally {
      timer.stop();
    }
  }

  static helpers(sass: SassImplementation): ReturnType<typeof sassHelpers> {
    return sassHelpers(sass);
  }

  once<R>(key: string, firstTime: () => R): R | undefined;
  // eslint-disable-next-line no-dupe-class-members
  once<R>(key: string, firstTime: () => R, otherwise: () => R): R;
  // eslint-disable-next-line no-dupe-class-members
  once<R>(key: string, firstTime: () => R, otherwise?: () => R): R | undefined {
    if (this.onceCache.has(key)) {
      if (otherwise) {
        return otherwise();
      } else {
        return;
      }
    } else {
      this.onceCache.set(key, true);
      return firstTime();
    }
  }
}

export function _forbidNodeSassArg(arg: unknown): Pick<EyeglassConfig, "engines"> | void {
  if (isSassImplementation(arg)) {
    // throw an error
    throw new Error([
      "You may no longer pass `sass` directly to Eyeglass. Instead pass it as an option:",
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
  }
}


const VERSION_WARNINGS_ISSUED: Dict<boolean> = {};

function checkDependencyConflicts(this: IEyeglass): void {
  let conflicts = this.modules.issues.dependencies.versions;
  let strictMode = this.options.eyeglass.strictModuleVersions;
  if (typeof strictMode === "undefined") {
    strictMode = "warn";
  }
  for (let conflict of conflicts) {
    let message = `Version conflict for eyeglass module '${conflict.name}': ${conflict.requested.version} was requested but it was globally resolved to ${conflict.resolved.version}.`;
    if (strictMode === false) {
      debug(message);
    } else if (strictMode === "warn") {
      if (!VERSION_WARNINGS_ISSUED[message]) {
        console.error(`WARNING: ${message}`);
        VERSION_WARNINGS_ISSUED[message] = true;
      }
    } else if (strictMode === true) {
      throw new Error(message);
    }
  }
}

function checkMissingDependencies(this: IEyeglass): void {
  let missing = this.modules.issues.dependencies.missing;
  if (missing.length) {
    let warning = ["The following dependencies were not found:"];
    warning.push.apply(warning, missing.map(function(dep) {
      return "  " + dep;
    }));
    warning.push("You might need to `npm install` the above.");

    // eslint-disable-next-line no-console
    console.warn(warning.join("\n"));
  }
}

function addImporters(this: IEyeglass): void {
  let fsImporter = FSImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.importer as AsyncImporter
  );
  let assetImporter = AssetImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    fsImporter
  );
  this.options.importer = ModuleImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    assetImporter
  );
}

function addFunctions(this: IEyeglass): void {
  this.options.functions = ModuleFunctions(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.functions as UnsafeDict<SassFunction> // The type of @types/node-sass/Options["functions"] is bad.
  );
}

function forbidProperties(this: IEyeglass, properties: Array<keyof ForbiddenOptions | "enableImportOnce">): void {
  for (let prop of properties) {
    Object.defineProperty(this, prop, {
      get: function(this: IEyeglass) {
        throw new Error(
          "The property `" + prop + "` may no longer be accessed directly on eyeglass. " +
          "Instead, you'll find the value on `eyeglass.options.eyeglass." + prop + "`"
        );
      },
      set: function(this: IEyeglass, _value: EyeglassConfig[typeof prop]) {
        throw new Error(
          "The property `" + prop + "` may no longer be set directly on eyeglass. " +
          "Instead, you should pass this as an option to eyeglass:" +
          "\n  var options = eyeglass({" +
          "\n    /* sassOptions */" +
          "\n    ..." +
          "\n    eyeglass: {" +
          "\n      "  + prop + ": ..." +
          "\n    }" +
          "\n  });"
        );
      }
    });
  }
}
