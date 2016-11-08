"use strict";

var packageUtils = require("../util/package");
var merge = require("lodash.merge");
var includes = require("lodash.includes");
var path = require("path");
var fs = require("fs");
var rInvalidName = /\.(?:sass|s?css)$/;

var EYEGLASS_KEYWORD = "eyeglass-module";

function EyeglassModule(mod, discoverModules, isRoot) {
  // some defaults
  mod = merge({
    // eyeglass config
    eyeglass: {}
  }, mod);

  // if we were given a path, resolve it to the package.json
  if (mod.path) {
    var pkg = packageUtils.getPackage(mod.path);

    // if pkg.data is empty, this is an invalid path, so throw an error
    if (!pkg.data) {
      throw new Error("Could not find a valid package.json at " + mod.path);
    }

    var modulePath = fs.realpathSync(path.dirname(pkg.path));
    mod.path = modulePath;

    mod = merge(
      {
        isEyeglassModule: EyeglassModule.isEyeglassModule(pkg.data)
      },
      mod,
      {
        path: modulePath,
        name: getModuleName(pkg),
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
      var moduleMain = getModuleExports(pkg.data, modulePath);
      merge(mod, {
        main: moduleMain && require(moduleMain),
        mainPath: moduleMain
      });

      if (rInvalidName.test(mod.name)) {
        throw new Error("An eyeglass module cannot contain an extension in it's name: " + mod.name);
      }
    }
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
  * whether or not the given package is an eyeglass module
  *
  * @param   {Object} pkg - the package.json
  * @returns {Boolean} whether or not it is an eyeglass module
  */
EyeglassModule.isEyeglassModule = function(pkg) {
  return !!(pkg && includes(pkg.keywords, EYEGLASS_KEYWORD));
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
