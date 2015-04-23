"use strict";

var resolve = require("./resolve");
var hash = require("./hash");
var semver = require("semver");
var path = require("path");
var fs = require("fs");

function getPackage(dir) {
  var pjson = path.join(dir, "package.json");
  var data;
  try {
    data = fs.readFileSync(pjson);
  } catch(e) {
    return false;
  }
  return JSON.parse(data);
}

function discover(dir, shallow, includeDevDependencies) {
    var seen = {};
    var allModules = [];

    var topPackage = getPackage(dir);
    var topParent = path.join(dir, "package.json");

    function isEyeglassPlugin(pkg) {
      return pkg.keywords && pkg.keywords.indexOf("eyeglass-module") >= 0;
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

      var resolvedPkg = {
        name: pkg.name,
        version: pkg.version,
        main: resolve(eyeglassExports(pkg.eyeglass, packageName), parent, inDir)
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

    function scan(inDir, parentName, parentVersion) {
      var pkg = getPackage(inDir);
      var parent = path.join(inDir, "package.json");
      var modules = [];

      if (!pkg) {
        return modules;
      }
      if (!isEyeglassPlugin(pkg)) {
        return modules;
      }
      if (seen[pkg.name + "@" + pkg.version]) {
        return modules;
      }

      seen[pkg.name + "@" + pkg.version] = 1;

      modules.push(resolvedModuleDef(pkg, parent, inDir,
                                     parentName, parentVersion));

      if (pkg.dependencies && !shallow) {
        Object.keys(pkg.dependencies).forEach(function(dep) {
          var p = resolve(dep + "/package.json", parent, inDir);
          modules = modules.concat(scan(path.dirname(p),
                                        pkg.name,
                                        pkg.version));
        });
      }

      return modules;
    }

    // Add eyeglass itself.
    var eyeglassDir = path.resolve(__dirname, "..", "..");
    var eyeglassPkgPath = path.join(eyeglassDir, "package.json");
    var eyeglassPkg = getPackage(eyeglassDir);
    allModules.push(resolvedModuleDef(eyeglassPkg, eyeglassPkgPath, eyeglassDir));

    if (topPackage) {
      // look at top package and add itself if it's an eyeglass plugin.
      if (isEyeglassPlugin(topPackage)) {
        allModules.push(resolvedModuleDef(topPackage, topParent, dir));
      }

      var deps = {};
      hash.merge(deps, topPackage.dependencies || {});
      if (includeDevDependencies) {
        hash.merge(deps, topPackage.devDependencies || {});
      }

      // look at all dependencies and find the eyeglass plugins.
      Object.keys(deps).forEach(function(dep) {
        var p = resolve(dep + "/package.json", topParent, dir);
        allModules = allModules.concat(scan(path.dirname(p)));
      });
    }

    return allModules;
}

function simplify(modules) {
  var result = [];
  var index = {};
  var errors = [];

  modules.forEach(function(mod) {
    index[mod.name] = index[mod.name] || {};
    index[mod.name][mod.version] = mod;
  });
  Object.keys(index).forEach(function(name) {
    var versions = Object.keys(index[name]).sort(function(a, b) {
      return semver.lt(a, b);
    });
    var high = versions[0];

    result.push(index[name][high]);

    if (versions.length === 1) {
      return;
    }

    for (var i = 1; i < versions.length; i++) {
      if (!semver.satisfies(versions[i], "^" + high)) {
        errors.push({
          name: name,
          left: index[name][versions[i]],
          right: index[name][high]
        });
      }
    }
  });

  return {
    modules: result,
    errors: errors
  };
}

function getModules(dir, shallow, includeDevDependencies) {
  return simplify(discover(dir, shallow, includeDevDependencies));
}

function getSimple(dir, shallow) {
  var results = [];
  var modules = getModules(dir, shallow).modules;
  for (var i = 0; i < modules.length; i++) {
    results.push(modules[i].main);
  }
  return results;
}

module.exports.all = getModules;
module.exports.simple = getSimple;
