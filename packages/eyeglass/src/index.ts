// TODO: Convert to TS
// TODO: Annotate Types
"use strict";
/* eslint-disable @typescript-eslint/no-var-requires,
                  @typescript-eslint/no-use-before-define,
                  @typescript-eslint/restrict-plus-operands */
import EyeglassModules from "./modules/EyeglassModules";
import ModuleFunctions from "./modules/ModuleFunctions";
import ModuleImporter from "./importers/ModuleImporter";
import AssetImporter from "./importers/AssetImporter";
import FSImporter from "./importers/FSImporter";
import Options, { Config } from "./util/Options";
import Assets from "./assets/Assets";
import deprecator, { DeprecateFn } from "./util/deprecator";
import semverChecker from "./util/semverChecker";
import * as fs from "fs-extra";
const pkg = require("../package.json");

interface Eyeglass {
  modules: any;
  deprecate: DeprecateFn;
  options: Config;
  assets: Assets;
}

function Eyeglass(this: Eyeglass, options, deprecatedNodeSassArg): void {
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

function checkMissingDependencies() {
  var missing = this.modules.issues.dependencies.missing;
  if (missing.length) {
    var warning = ["The following dependencies were not found:"];
    warning.push.apply(warning, missing.map(function(dep) {
      return "  " + dep;
    }));
    warning.push("You might need to `npm install` the above.");

    // eslint-disable-next-line no-console
    console.warn(warning.join("\n"));
  }
}

function addImporters() {
  var fsImporter = FSImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.importer
  );
  var assetImporter = AssetImporter(
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

function addFunctions() {
  this.options.functions = ModuleFunctions(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.functions
  );
}

module.exports = Eyeglass;

function deprecateProperties(properties) {
  properties.forEach(function(prop) {
    Object.defineProperty(this, prop, {
      get: function() {
        this.deprecate("0.8.0", "0.9.0",
          "The property `" + prop + "` should no longer be accessed directly on eyeglass. " +
          "Instead, you'll find the value on `eyeglass.options.eyeglass." + prop + "`"
        );
        return this.options.eyeglass[prop];
      },
      set: function(value) {
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
  }.bind(this));
}

// export deprecated interfaces for back-compat
Eyeglass.prototype.sassOptions = function() {
  this.deprecate("0.8.0", "0.9.0",
    "#sassOptions() is deprecated. Instead, you should access the sass options on #options"
  );
  return this.options;
};

module.exports.Eyeglass = function(options, deprecatedNodeSassArg) {
  var eyeglass = new Eyeglass(options, deprecatedNodeSassArg);
  deprecateMethodWarning.call(eyeglass, "Eyeglass");
  return eyeglass;
};

module.exports.decorate = function(options, deprecatedNodeSassArg) {
  var eyeglass = new Eyeglass(options, deprecatedNodeSassArg);
  deprecateMethodWarning.call(eyeglass, "decorate");
  return eyeglass.options;
};

function deprecateMethodWarning(method) {
  this.deprecate("0.8.0", "0.9.0",
    "`require('eyeglass')." + method + "` is deprecated. " +
    "Instead, use `require('eyeglass')`"
  );
}

/* eslint-enable @typescript-eslint/no-var-requires,
                 @typescript-eslint/no-use-before-define,
                 @typescript-eslint/restrict-plus-operands */