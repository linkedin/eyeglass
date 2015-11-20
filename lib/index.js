"use strict";

var EyeglassModules = require("./util/eyeglass_modules");
var ModuleImporter = require("./module_importer");
var AssetImporter = require("./assets_importer");
var Functions = require("./function_loader");
var Options = require("./options");
var engineChecks = require("./semver_checker");
var fs = require("fs");

function Eyeglass(sassOptions, eyeglassOptions) {
  // if it's not an instance, create one and return only the sass options
  if (!(this instanceof Eyeglass)) {
    return (new Eyeglass(sassOptions, eyeglassOptions)).options.sass;
  }

  this.options = new Options(this, sassOptions, eyeglassOptions);
  this.assets = require("./assets")(this, this.options.eyeglass.engines.sass);

  this.modules = new EyeglassModules(this.options.eyeglass.root);

  mkdirpSync(this.options.eyeglass.cacheDir);

  engineChecks(this, this.options.eyeglass.engines.sass, this.options.eyeglass);

  checkMissingDependencies.call(this);

  // add importers and functions
  addImporters.call(this);
  addFunctions.call(this);

  // deprecated stuff
  deprecateProperties.call(this, ["enableImportOnce"]);
}

function mkdirpSync(dir) {
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
    this.options.sass.importer
  );
  this.options.sass.importer = new ModuleImporter(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    assetImporter
  );
}

function addFunctions() {
  this.options.sass.functions = new Functions(
    this,
    this.options.eyeglass.engines.sass,
    this.options,
    this.options.sass.functions
  );
}

module.exports = Eyeglass;

function deprecateProperties(properties) {
  properties.forEach(function(prop) {
    Object.defineProperty(this, prop, {
      get: function() {
        console.warn("TODO - get moved for", prop);
        return this.options.eyeglass[prop];
      },
      set: function(value) {
        console.warn("TODO - set moved for", prop);
        this.options.eyeglass[prop] = value;
      }
    });
  }.bind(this));
}

// export deprecated interfaces for back-compat
Eyeglass.prototype.sassOptions = function() {
  //console.warn("#sassOptions is deprecated");
  return this.options.sass;
};

module.exports.Eyeglass = function(sassOptions, eyeglassOptions) {
  deprecateMethodWarning("Eyeglass");
  return new Eyeglass(sassOptions, eyeglassOptions);
};

module.exports.decorate = function(sassOptions, eyeglassOptions) {
  deprecateMethodWarning("decorate");
  return Eyeglass(sassOptions, eyeglassOptions);
};

function deprecateMethodWarning(method) {
  /*
  console.warn(
    "`require('eyeglass')." + method + "` is deprecated. " +
    "Instead, use `require('eyeglass')`"
 );
  */
}
