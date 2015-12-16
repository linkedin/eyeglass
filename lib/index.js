"use strict";

var EyeglassModules = require("./util/eyeglass_modules");
var ModuleImporter = require("./module_importer");
var AssetImporter = require("./assets_importer");
var Functions = require("./function_loader");
var Options = require("./options");
var Assets = require("./assets");
var Deprecator = require("./util/deprecator");
var engineChecks = require("./semver_checker");
var fs = require("fs");

function Eyeglass(options, deprecatedNodeSassArg) {
  // if it's not an instance, create one and return only the sass options
  if (!(this instanceof Eyeglass)) {
    return (new Eyeglass(options, deprecatedNodeSassArg)).options;
  }

  // an interface for deprecation warnings
  this.deprecate = new Deprecator(options);

  this.options = new Options(options, this.deprecate, deprecatedNodeSassArg);
  this.assets = new Assets(this, this.options.eyeglass.engines.sass);
  this.modules = new EyeglassModules(this.options.eyeglass.root);

  mkdirpSync(this.options.eyeglass.cacheDir);

  engineChecks(this, this.options.eyeglass.engines.sass, this.options.eyeglass);

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

function mkdirpSync(dir) {
  /* istanbul ignore next - might consider adding a with an existing cache dir */
  if (!existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

// TODO - move to util
// Returns whether a file exists.
function existsSync(file) {
  // This fs method is going to be deprecated but can be re-implemented with fs.accessSync later.
  return fs.existsSync(file);
}

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
  var assetImporter = new AssetImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.importer
  );
  this.options.importer = new ModuleImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    assetImporter
  );
}

function addFunctions() {
  this.options.functions = new Functions(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.functions
  );
}

Eyeglass.VERSION = engineChecks.eyeglassVersion;

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
