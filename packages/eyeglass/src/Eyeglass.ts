import EyeglassModules from "./modules/EyeglassModules";
import ModuleFunctions from "./modules/ModuleFunctions";
import ModuleImporter from "./importers/ModuleImporter";
import AssetImporter from "./importers/AssetImporter";
import FSImporter from "./importers/FSImporter";
import Options, {Options as Opts, Config, SimpleDeprecatedOptions, EyeglassConfig} from "./util/Options";
import Assets from "./assets/Assets";
import deprecator, { DeprecateFn } from "./util/deprecator";
import semverChecker from "./util/semverChecker";
import * as fs from "fs-extra";
import { IEyeglass } from "./IEyeglass";
import {PackageJson} from "package-json";
import { SassFunction } from "node-sass";
import { SassImplementation, helpers as sassHelpers } from "./util/SassImplementation";
import { AsyncImporter } from "node-sass";
import { UnsafeDict } from "./util/typescriptUtils";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg: PackageJson = require("../package.json");

export default class Eyeglass implements IEyeglass {
  static VERSION = pkg.version!;

  deprecate: DeprecateFn;
  options: Config;
  assets: Assets;
  modules: EyeglassModules;

  constructor(options: Opts, deprecatedNodeSassArg?: SassImplementation) {

    // an interface for deprecation warnings
    this.deprecate = deprecator(options);

    this.options = new Options(options, this.deprecate, deprecatedNodeSassArg);
    this.assets = new Assets(this, this.options.eyeglass.engines.sass);
    this.modules = new EyeglassModules(
      this.options.eyeglass.root,
      this.options,
      this.options.eyeglass.modules,
    );

    fs.mkdirpSync(this.options.eyeglass.cacheDir);

    semverChecker(this, this.options.eyeglass.engines.sass, this.options.eyeglass, Eyeglass.VERSION);

    checkMissingDependencies.call(this);

    // initialize all the modules
    this.modules.init(this, this.options.eyeglass.engines.sass);

    // add importers and functions
    addImporters.call(this);
    addFunctions.call(this);

    // deprecated stuff
    deprecateProperties.call(this, ["enableImportOnce"]);

    // auto-add asset paths specified via options
    if (this.options.eyeglass.assets.sources) {
      for (let assetSource of this.options.eyeglass.assets.sources) {
        this.assets.addSource(assetSource.directory, assetSource);
      }
    }
  }

  // export deprecated interfaces for back-compat
  sassOptions(this: IEyeglass): Config {
    this.deprecate("0.8.0", "0.9.0",
      "#sassOptions() is deprecated. Instead, you should access the sass options on #options"
    );
    return this.options;
  }
  static helpers(sass: SassImplementation): ReturnType<typeof sassHelpers> {
    return sassHelpers(sass);
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

function deprecateProperties(this: IEyeglass, properties: Array<keyof SimpleDeprecatedOptions | "enableImportOnce">): void {
  for (let prop of properties) {
    Object.defineProperty(this, prop, {
      get: function(this: IEyeglass) {
        this.deprecate("0.8.0", "0.9.0",
          "The property `" + prop + "` should no longer be accessed directly on eyeglass. " +
          "Instead, you'll find the value on `eyeglass.options.eyeglass." + prop + "`"
        );
        return this.options.eyeglass[prop as keyof SimpleDeprecatedOptions];
      },
      set: function(this: IEyeglass, value: EyeglassConfig[typeof prop]) {
        this.deprecate("0.8.0", "0.9.0",
          "The property `" + prop + "` should no longer be set directly on eyeglass. " +
          "Instead, you should pass this as an option to eyeglass:" +
          "\n  var options = eyeglass({" +
          "\n    /* sassOptions */" +
          "\n    ..." +
          "\n    eyeglass: {" +
          "\n      "  + prop + ": ..." +
          "\n    }" +
          "\n  });"
        );
        this.options.eyeglass[prop] = value;
      }
    });
  }
}
