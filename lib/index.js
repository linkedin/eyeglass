"use strict";

var EyeglassModules = require("./modules/EyeglassModules");
var ModuleFunctions = require("./modules/ModuleFunctions");
var ModuleImporter = require("./importers/ModuleImporter");
var AssetImporter = require("./importers/AssetImporter");
var FSImporter = require("./importers/FSImporter");
var Options = require("./util/Options");
var Assets = require("./assets/Assets");
var Deprecator = require("./util/deprecator");
var semverChecker = require("./util/semverChecker");
var fs = require("fs-extra");
var pkg = require("../package.json");

function Eyeglass(options, deprecatedNodeSassArg) {
  // if it's not an instance, create one and return only the sass options
  if (!(this instanceof Eyeglass)) {
    return (new Eyeglass(options, deprecatedNodeSassArg)).options;
  }

  // an interface for deprecation warnings
  this.deprecate = new Deprecator(options);

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
    this.options.eyeglass.assets.sources.forEach(function(assetSource) {

      this.assets.addSource(assetSource.directory, assetSource);
    }.bind(this));
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
    console.warn(warning.join("\n"));
  }
}

function addImporters() {
  var fsImporter = new FSImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.importer
  );
  var assetImporter = new AssetImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    fsImporter
  );
  this.options.importer = new ModuleImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    assetImporter
  );
}

function addFunctions() {
  this.options.functions = new ModuleFunctions(
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
