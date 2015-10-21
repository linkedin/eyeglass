"use strict";

var resolve = require("./resolve");
var path = require("path");
var merge = require("lodash.merge");
var includes = require("lodash.includes");
var semver = require("semver");
var fs = require("fs");
var uuid = require("uuid");

var PACKAGE_JSON = "package.json";
var EYEGLASS_KEYWORD = "eyeglass-module";
var ROOT_ID = ":root-" + uuid.v4();

function EyeglassModules(dir) {
  dir = findNearestPackage(path.resolve(dir));

  var pkg = getPackage(dir);

  var moduleTree = resolveModule(dir, true);

  //console.log("[moduleTree]", moduleTree);

  var collection = dedupeModules(flattenModules(moduleTree));

  this.collection = collection;
  this.list = Object.keys(collection).map(function(name) {
    return collection[name];
  });
  this.tree = pruneModuleTree.call(this, moduleTree);
  this.projectName = moduleTree.name;
}

EyeglassModules.prototype.find = function(name, location) {
  var mod = getFinalModule.call(this, name);

  if (mod && !canAccessModule.call(this, name, location)) {
    throw new Error("Could not import " + name + " from " + location);
  }

  return mod;
};

// this is mostly for debugging purposes
EyeglassModules.prototype.getGraph = function() {
  var hierarchy = getHierarchy(this.tree);
  hierarchy.label = getDecoratedRootName.call(this);
  return require("archy")(hierarchy);
};

function getDecoratedRootName() {
  return ":root" + ((this.projectName) ? "(" + this.projectName + ")" : "");
}

function getHierarchyNodes(branch) {
  if (branch) {
    return Object.keys(branch).map(function(name) {
      return getHierarchy(branch[name]);
    });
  }
}

function getHierarchy(branch) {
  if (branch) {
    return {
      label: branch.name,
      nodes: getHierarchyNodes(branch.dependencies)
    };
  }
}

function pruneModuleTree(moduleTree) {
  var finalModule = moduleTree.name && getFinalModule.call(this, moduleTree.name);
  var branch = {
    name: finalModule && finalModule.name || moduleTree.name,
    path: finalModule && finalModule.path || moduleTree.path
  };
  var dependencies = moduleTree.dependencies;
  if (dependencies) {
    branch.dependencies = Object.keys(dependencies).reduce(function(tree, name) {
      tree[name] = pruneModuleTree.call(this, dependencies[name]);
      return tree;
    }.bind(this), {});
  }
  return branch;
}

function doesFileExist(file) {
  return fs.existsSync(file);
}

function findNearestPackage(dir) {
  var prevDir;
  while (dir !== prevDir) {
    if (doesFileExist(getPackagePath(dir))) {
      return dir;
    }
    prevDir = dir;
    dir = path.dirname(dir);
  }
  return false;
}

function findBranchesByPath(modules, match) {
  if (modules) {
    return Object.keys(modules).reduce(function(branches, name) {
      var mod = modules[name];
      if (mod.path === match) {
        branches.push(mod);
      }
      if (mod.dependencies) {
        branches.push.apply(branches, findBranchesByPath(mod.dependencies, match));
      }
      return branches;
    }, []);
  }
  return [];
}

function canAccessModule(name, origin) {
  if (origin === true) {
    return true;
  }
  origin = findNearestPackage(origin);
  var branches = findBranchesByPath({
    dependencies: this.tree
  }, origin);
  return branches.some(function(branch) {
    if (branch.name === name || branch.dependencies[name]) {
      return true;
    }
  });
}

function flattenModules(branch, registry) {
  if (branch) {
    // if the branch itself is a module, add it...
    if (branch.isEyeglassModule) {
      registry = registry || {};
      registry[branch.name] = registry[branch.name] || [];
      registry[branch.name].push(branch);
    }

    var dependencies = branch.dependencies;

    if (dependencies) {
      var result = Object.keys(dependencies).reduce(function(registry, name) {
        return flattenModules(dependencies[name], registry);
      }, registry || {});
      return result;
    }
  }

  return registry;
}

function checkVersions(versions, latest) {
  return versions.map(function(mod) {
    if (!semver.satisfies(mod.version, "^" + latest.version)) {
      return {
        name: mod.name,
        left: mod,
        right: latest
      };
    }
  });
}

function dedupeModules(modules) {
  if (!modules) {
    return [];
  }
  var errors = [];
  return Object.keys(modules).reduce(function(deduped, name) {
    var versions = modules[name].sort(function(a, b) {
      return semver.lt(a.version, b.version);
    });
    deduped[name] = versions.shift();
    errors.push.apply(errors, checkVersions(versions, deduped[name]));
    return deduped;
  }, {});
}

function getPackageData(pkgPath) {
  try {
    return require(pkgPath);
  } catch (e) {
    return null;
  }
}

function getPackage(dir) {
  var pkgPath = getPackagePath(dir);
  return {
    path: pkgPath,
    data: getPackageData(pkgPath)
  };
}

function getPackagePath(dir) {
  return (path.basename(dir) === PACKAGE_JSON) ? dir : path.join(dir, PACKAGE_JSON);
}

function getModuleName(pkg) {
  var name = normalizeEyeglassOptions(pkg.data.eyeglass).name || pkg.data.name;
  if (!name) {
    throw new Error(tick(pkg.path) + " does not contain a valid module name");
  }
  return name;
}

function normalizeEyeglassOptions(options) {
  if (typeof options === "string") {
    return {
      exports: options
    };
  }
  return typeof options === "object" ? options : {};
}

function getFinalModule(name) {
  return this.collection[name];
}

function getExportsFileFromOptions(options) {
  return normalizeEyeglassOptions(options).exports;
}

function getModuleExports(pkg, modulePath) {
  var exportsFile = getExportsFileFromOptions(pkg.eyeglass) || pkg.main;
  return path.join(modulePath, exportsFile || "");
}

function isEyeglassModule(pkg) {
  return !!(pkg && includes(pkg.keywords, EYEGLASS_KEYWORD));
}

function resolveModule(pkg, isRoot) {
  pkg = getPackage(pkg);
  var isEyeglassMod = isEyeglassModule(pkg.data);
  if (isEyeglassMod || (pkg.data && isRoot)) {
    var modulePath = path.dirname(pkg.path);
    if (typeof pkg.data.version === "object") {
      console.log("pkg.data.version", pkg.data.version);
    }
    return {
      name: getModuleName(pkg) || (isRoot && ROOT_ID),
      rawName: pkg.data.name,
      path: modulePath,
      version: pkg.data.version,
      main: getModuleExports(pkg.data, modulePath),
      isEyeglassModule: isEyeglassMod,
      dependencies: discoverModules({
        dir: modulePath,
        isRoot: isRoot
      }),
      eyeglass: normalizeEyeglassOptions(pkg.data.eyeglass)
    };
  }
}

function getEyeglassSelf(options) {
  var eyeglassDir = path.resolve(__dirname, "..", "..");
  var eyeglassPkg = getPackage(eyeglassDir);

  var resolvedPkg = resolve(eyeglassPkg.path, eyeglassPkg.path, eyeglassDir);
  return resolveModule(resolvedPkg);
}

function discoverModules(options) {
  var pkg = options.pkg || getPackage(options.dir);

  var dependencies = {};

  // get the collection of dependencies
  // merge the devDependencies only if it's the root of the project
  if (pkg.data) {
    dependencies = merge(
      dependencies,
      pkg.data.dependencies,
      options.isRoot && pkg.data.devDependencies
    );
  }

  dependencies = Object.keys(dependencies).reduce(function(modules, dependency) {
    var resolvedPkg = resolve(getPackagePath(dependency), pkg.path, options.dir);
    var resolvedModule = resolveModule(resolvedPkg);
    if (resolvedModule) {
      modules[resolvedModule.name] = resolvedModule;
    }
    return modules;
  }, {});

  // if it's the root...
  if (options.isRoot) {
    // ensure eyeglass itself is a direct dependency
    dependencies.eyeglass = dependencies.eyeglass || getEyeglassSelf(options);
  }


  return Object.keys(dependencies).length ? dependencies : null;
}

function tick(str) {
  return "`" + str + "`";
}

module.exports = EyeglassModules;
