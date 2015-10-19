"use strict";

var resolve = require("./resolve");
var merge = require("lodash.merge");
var semver = require("semver");
var path = require("path");
var fs = require("fs");

var PACKAGE_JSON = "package.json";
var EYEGLASS_KEYWORD = "eyeglass-module";

function readJSON(jsonFile) {
  try {
    return JSON.parse(fs.readFileSync(jsonFile));
  } catch (e) {
    return null;
  }
}

function getPackagePath(dir) {
  return path.join(dir, PACKAGE_JSON);
}

function getPackage(dir) {
  var jsonFile = getPackagePath(dir);
  return {
    path: jsonFile,
    data: readJSON(jsonFile)
  };
}

function getEyeglassModuleDef(dir) {
  var pkg = getPackage(dir);
  if (isEyeglassPlugin(pkg.data)) {
    return resolvedModuleDef(pkg.data, pkg.path, dir);
  }
}

function getEyeglassName(moduleDef) {
  return (typeof moduleDef.eyeglass === "object" && moduleDef.eyeglass.name) ||
    moduleDef.name;
}

function isEyeglassPlugin(pkg) {
  return pkg && pkg.keywords && pkg.keywords.indexOf(EYEGLASS_KEYWORD) !== -1;
}

function getEyeglassDef() {
  var eyeglassDir = path.resolve(__dirname, "..", "..");
  var eyeglassPkg = getPackage(eyeglassDir);
  return resolvedModuleDef(eyeglassPkg.data, eyeglassPkg.path, eyeglassDir);
}

function eyeglassExports(eyeglass, packageName) {
  var exportsFile;

  if (eyeglass) {
    if (typeof eyeglass == "string") {
      exportsFile = eyeglass;
    } else if (typeof eyeglass == "object") {
      exportsFile = eyeglass.exports;
    }
  }

  if (exportsFile && packageName === "./") {
    exportsFile = packageName + exportsFile;
  } else if (exportsFile) {
    exportsFile = path.join(packageName, exportsFile);
  } else {
    exportsFile = packageName; // use node default
  }

  return exportsFile;
}

function resolvedModuleDef(pkg, parent, inDir, parentName, parentVersion) {
  var packageName = parentName ? pkg.name : "./";

  var ege = eyeglassExports(pkg.eyeglass, packageName);

  var resolvedPkg = {
    name: pkg.name,
    version: pkg.version,
    main: resolve(ege, parent, inDir),
    eyeglassName: getEyeglassName(pkg),
    eyeglass: pkg.eyeglass || {}
  };

  if (typeof pkg.eyeglass == "object") {
    resolvedPkg.eyeglass = pkg.eyeglass;
  }

  if (parentName) {
    resolvedPkg.origin = {
      name: parentName,
      version: parentVersion
    };
  }

  return resolvedPkg;
}

function getPackageDependencies(pkg, includeDevDependencies) {
  return Object.keys(merge(
    {},
    pkg.dependencies,
    includeDevDependencies ? pkg.devDependencies : null
  ));
}

function getModuleSignature(pkg) {
  return pkg && (pkg.name + "@" + pkg.version);
}

function discover(dir, shallow, includeDevDependencies) {
  var seen = {};
  var allModules = [];

  function scan(inDir, parentName, parentVersion) {
    var pkg = getPackage(inDir);
    var data = pkg.data;
    var moduleSignature = getModuleSignature(data);

    // if this isn't an eyeglass module OR we've already seen it...
    if (!data || !isEyeglassPlugin(data) || seen[moduleSignature]) {
      // just return the empty array
      return [];
    }

    // record that we've seen it
    seen[moduleSignature] = true;

    // resolve the module
    var module = resolvedModuleDef(pkg.data, pkg.path, inDir, parentName, parentVersion);
    // and add it to our collection of modules
    var modules = [module];

    var dependencies = !shallow && getPackageDependencies(data);

    // if the module had dependencies and we're not doing a shallow resolution
    if (dependencies) {
      // with each dependency...
      modules = dependencies.reduce(function(collection, dependency) {
        // resolve the dependency path
        var resolvedPath = resolve(getPackagePath(dependency), pkg.pth, inDir);
        // recurse and scan the dependency
        var depModules = scan(path.dirname(resolvedPath), pkg.name, pkg.version);
        // add all of the discovered modules onto our collection of modules and return
        return collection.concat(depModules);
      }, modules);
    }

    return modules;
  }

  // add eyeglass package as a module
  allModules.push(getEyeglassDef());

  // get the top package info
  var topPackage = getPackage(dir);
  if (topPackage.data) {
    // look at top package and add itself if it's an eyeglass plugin.
    if (isEyeglassPlugin(topPackage.data)) {
      allModules.push(resolvedModuleDef(topPackage.data, topPackage.path, dir));
    }

    var dependencies = getPackageDependencies(topPackage.data, includeDevDependencies);

    // look at all dependencies and find the eyeglass plugins
    dependencies.forEach(function(dependency) {
      var dependencyPath = resolve(getPackagePath(dependency), topPackage.path, dir);
      allModules = allModules.concat(scan(path.dirname(dependencyPath)));
    });
  }

  return allModules;
}

function simplify(modules) {
  var errors = [];
  var result = [];

  var registry = modules.reduce(function(reg, mod) {
    reg[mod.name] = reg[mod.name] || {};
    reg[mod.name][mod.version] = mod;
    return reg;
  }, {});

  Object.keys(registry).forEach(function(name) {
    var versions = Object.keys(registry[name]).sort(semver.lt);
    var high = versions.shift();
    var highHat = "^" + high;

    result.push(registry[name][high]);

    versions.forEach(function(version) {
      if (!semver.satisfies(version, highHat)) {
        errors.push({
          name: name,
          left: registry[name][version],
          right: registry[name][high]
        });
      }
    });
  });

  return {
    modules: result,
    errors: errors
  };
}

function getModules(dir, shallow, includeDevDependencies) {
  return simplify(discover(dir, shallow, includeDevDependencies));
}

function getSimple(dir, shallow, includeDevDependencies) {
  var results = [];
  var modules = getModules(dir, shallow, includeDevDependencies).modules;
  for (var i = 0; i < modules.length; i++) {
    results.push(modules[i].main);
  }
  return results;
}

module.exports = {
  all: getModules,
  simple: getSimple,
  getEyeglassModuleDef: getEyeglassModuleDef,
  getEyeglassDef: getEyeglassDef
};
