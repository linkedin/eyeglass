"use strict";

var packageUtils = require("./package");
var merge = require("lodash.merge");
var path = require("path");

function EyeglassModule(mod, discoverModules, isRoot) {
  // some defaults
  mod = merge({
    // always an eyeglass module unless explicitly false
    isEyeglassModule: true,
    // eyeglass config
    eyeglass: {}
  }, mod);

  // if we were given a path, resolve it to the package.json
  if (mod.path) {
    var pkg = packageUtils.getPackage(mod.path);
    var modulePath = path.dirname(pkg.path);
    var moduleMain = getModuleExports(pkg.data, modulePath);
    mod.path = modulePath;

    mod = merge({
      path: modulePath,
      name: getModuleName(pkg),
      rawName: pkg.data.name,
      version: pkg.data.version,
      main: moduleMain && require(moduleMain),
      mainPath: moduleMain,
      // only resolve dependencies if we were given a discoverModules function
      dependencies: discoverModules && discoverModules({
        dir: modulePath,
        isRoot: isRoot
      }),
      eyeglass: normalizeEyeglassOptions(pkg.data.eyeglass, modulePath)
    }, mod);
  }

  // if a sassDir is specified in eyeglass options, it takes precedence
  mod.sassDir = mod.eyeglass.sassDir || mod.sassDir;

  // set the rawName if it's not already set
  mod.rawName = mod.rawName || mod.name;

  // merge the module properties into the instance
  merge(this, mod);
}

/**
  * initializes the module with the given engines
  *
  * @param   {Eyeglass} eyeglass - the eyeglass instance
  * @param   {Function} sass - the sass engine
  */
EyeglassModule.prototype.init = function(eyeglass, sass) {
  merge(this, this.main && this.main(eyeglass, sass));
};


/**
  * given a package.json reference, gets the Eyeglass module name
  *
  * @param   {Object} pkg - the package.json reference
  * @returns {String} the name of the module
  */
function getModuleName(pkg) {
  // check for `eyeglass.name` first, otherwise use `name`
  return normalizeEyeglassOptions(pkg.data.eyeglass).name || pkg.data.name;
}

/**
  * normalizes a given `eyeglass` reference from a package.json
  *
  * @param   {Object} options - The eyeglass options from the package.json
  * @param   {String} pkgPath - The location of the package.json.
  * @returns {Object} the normalized options
  */
function normalizeEyeglassOptions(options, pkgPath) {
  var normalizedOpts;
  // if it's a string, treat it as the export
  if (typeof options === "string") {
    normalizedOpts = {
      exports: options
    };
  }
  if (typeof options !== "object") {
    normalizedOpts = {};
  } else {
    normalizedOpts = options;
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
function getExportsFileFromOptions(options) {
  return normalizeEyeglassOptions(options).exports;
}

/**
  * gets the export for a given package.json
  *
  * @param   {Object} pkg - the package.json
  * @param   {String} modulePath - the path to the module
  * @returns {String} the export file to use
  */
function getModuleExports(pkg, modulePath) {
  var exportsFile = getExportsFileFromOptions(pkg.eyeglass);

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

module.exports = EyeglassModule;
