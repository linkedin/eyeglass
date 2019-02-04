import EyeglassModules from "./modules/EyeglassModules";
import ModuleFunctions from "./modules/ModuleFunctions";
import ModuleImporter from "./importers/ModuleImporter";
import AssetImporter from "./importers/AssetImporter";
import FSImporter from "./importers/FSImporter";
import Options from "./util/Options";
import Assets from "./assets/Assets";
import deprecator from "./util/deprecator";
import semverChecker from "./util/semverChecker";
import * as fs from "fs-extra";
import { IEyeglass } from "./IEyeglass";
import {PackageJson} from "package-json";
const pkg: PackageJson = require("../package.json");

function Eyeglass(this: IEyeglass, options, deprecatedNodeSassArg): void {
  // if it's not an instance, create one and return only the sass options
  if (!(this instanceof Eyeglass)) {
    return (new Eyeglass(options, deprecatedNodeSassArg)).options;
  }

  // an interface for deprecation warnings
  this.deprecate = deprecator(options);

  this.options = new Options(options, this.deprecate, deprecatedNodeSassArg);
  this.assets = new Assets(this, this.options.eyeglass.engines.sass);
  this.modules = new EyeglassModules(
    this.options.eyeglass.root,
    this.options.eyeglass.modules,
    this.options.eyeglass.useGlobalModuleCache
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

Eyeglass.VERSION = pkg.version;

function checkMissingDependencies(this: IEyeglass) {
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

function addImporters(this: IEyeglass) {
  let fsImporter = FSImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.importer
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

function addFunctions(this: IEyeglass) {
  this.options.functions = ModuleFunctions(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.functions
  );
}

module.exports = Eyeglass;

function deprecateProperties(this: IEyeglass, properties: string[]): void {
  for (let prop of properties) {
    Object.defineProperty(this, prop, {
      get: function(this: IEyeglass) {
        this.deprecate("0.8.0", "0.9.0",
          "The property `" + prop + "` should no longer be accessed directly on eyeglass. " +
          "Instead, you'll find the value on `eyeglass.options.eyeglass." + prop + "`"
        );
        return this.options.eyeglass[prop];
      },
      set: function(this: IEyeglass, value: any) {
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

// export deprecated interfaces for back-compat
Eyeglass.prototype.sassOptions = function(this: IEyeglass) {
  this.deprecate("0.8.0", "0.9.0",
    "#sassOptions() is deprecated. Instead, you should access the sass options on #options"
  );
  return this.options;
};

module.exports.Eyeglass = function(options, deprecatedNodeSassArg) {
  let eyeglass = new Eyeglass(options, deprecatedNodeSassArg);
  deprecateMethodWarning.call(eyeglass, "Eyeglass");
  return eyeglass;
};

module.exports.decorate = function(options, deprecatedNodeSassArg) {
  let eyeglass = new Eyeglass(options, deprecatedNodeSassArg);
  deprecateMethodWarning.call(eyeglass, "decorate");
  return eyeglass.options;
};

function deprecateMethodWarning(this: IEyeglass, method: string) {
  this.deprecate("0.8.0", "0.9.0",
    "`require('eyeglass')." + method + "` is deprecated. " +
    "Instead, use `require('eyeglass')`"
  );
}