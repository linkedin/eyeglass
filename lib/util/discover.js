"use strict";

var resolve = require("./resolve");
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

function discover(dir) {
  return (function() {
    var seen = {};
    var allModules = [];
    var topPackage = getPackage(dir);
    var topParent = path.join(dir, "package.json");

    if (!topPackage) {
      return allModules;
    }

    function scan(inDir, parentName, parentVersion) {
      var pkg = getPackage(inDir);
      var parent = path.join(inDir, "package.json");
      var modules = [];

      if (!pkg) {
        return modules;
      }
      if (!pkg.keywords || pkg.keywords.indexOf("eyeglass-module") === -1) {
        return modules;
      }
      if (seen[pkg.name + "@" + pkg.version]) {
        return modules;
      }

      seen[pkg.name + "@" + pkg.version] = 1;
      modules.push({
        name: pkg.name,
        version: pkg.version,
        origin: {
          name: parentName,
          version: parentVersion
        },
        main: resolve(pkg.name, parent, inDir)
      });

      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach(function(dep) {
          var p = resolve(dep + "/package.json", parent, inDir);
          modules = modules.concat(scan(path.dirname(p),
                                   pkg.name,
                                   pkg.version));
        });
      }

      return modules;
    }

    if (topPackage.dependencies) {
      Object.keys(topPackage.dependencies).forEach(function(dep) {
        var p = resolve(dep + "/package.json", topParent, dir);
        allModules = allModules.concat(scan(path.dirname(p)));
      });
    }

    return allModules;

  }());
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

function getModules(dir) {
  var allModules = discover(dir);
  var results = simplify(allModules);
  return results;
}

function getSimple(dir) {
  var results = [];
  var modules = getModules(dir).modules;
  for (var i = 0; i < modules.length; i++) {
    results.push(modules[i].main);
  }
  return results;
}

module.exports.all = getModules;
module.exports.simple = getSimple;
