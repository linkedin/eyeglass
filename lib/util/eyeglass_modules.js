"use strict";

var resolve = require("./resolve");
var packageUtils = require("./package");
var path = require("path");
var merge = require("lodash.merge");
var includes = require("lodash.includes");
var semver = require("semver");
var archy = require("archy");

var EYEGLASS_KEYWORD = "eyeglass-module";

/**
  * Discovers all of the modules for a given directory
  *
  * @constructor
  * @param   {String} dir - the directory to discover modules in
  */
function EyeglassModules(dir) {
  this.issues = {
    dependencies: {
      versions: [],
      missing: []
    },
    engine: {
      missing: [],
      incompatible: []
    }
  };

  dir = packageUtils.findNearestPackage(path.resolve(dir));

  var moduleTree = resolveModule.call(this, dir, true);

  var collection = dedupeModules.call(this, flattenModules(moduleTree));

  this.collection = collection;
  this.list = Object.keys(collection).map(function(name) {
    return collection[name];
  });
  this.tree = pruneModuleTree.call(this, moduleTree);
  this.projectName = moduleTree.name;
  this.eyeglass = this.find("eyeglass");

  checkForIssues.call(this);
}

/**
  * Checks whether or not a given location has access to a given module
  *
  * @param   {String} name - the module name to find
  * @param   {String} origin - the location of the originating request
  * @returns {Object} the module reference if access is granted, null if access is prohibited
  */
EyeglassModules.prototype.access = function(name, origin) {
  var mod = this.find(name);

  if (mod && !canAccessModule.call(this, name, origin)) {
    return null;
  }

  return mod;
};

/**
  * Finds a module reference by the module name
  *
  * @param   {String} name - the module name to find
  * @returns {Object} the module reference
  */
EyeglassModules.prototype.find = function(name) {
  return getFinalModule.call(this, name);
};

/**
  * Finds a module reference by the module path
  *
  * @param   {String} dir - the path of the module to find
  * @returns {Object} the module reference
  */
EyeglassModules.prototype.findByPath = function(dir) {
  return this.list.find(function(mod) {
    if (mod.path === dir) {
      return getFinalModule.call(this, mod.name);
    }
  }.bind(this));
};

/**
  * Returns a formatted string of the module hierarchy
  *
  * @returns {String} the module hierarchy
  */
EyeglassModules.prototype.getGraph = function() {
  var hierarchy = getHierarchy(this.tree);
  hierarchy.label = getDecoratedRootName.call(this);
  return archy(hierarchy);
};

/**
  * checks for any issues in the modules we've discovered
  *
  * @this {EyeglassModules}
  *
  */
function checkForIssues() {
  this.list.forEach(function(mod) {
    // check engine compatibility
    if (!mod.eyeglass || !mod.eyeglass.needs) {
      // if `eyeglass.needs` is not present...
      // add the module to the missing engines list
      this.issues.engine.missing.push(mod);
    } else if (!semver.satisfies(this.eyeglass.version, mod.eyeglass.needs)) {
      // if the current version of eyeglass does not satify the need...
      // add the module to the incompatible engines list
      this.issues.engine.incompatible.push(mod);
    }
  }.bind(this));
}

/**
  * gets the root name and decorates it
  *
  * @this {EyeglassModules}
  *
  * @returns {String} the decorated name
  */
function getDecoratedRootName() {
  return ":root" + ((this.projectName) ? "(" + this.projectName + ")" : "");
}

/**
  * given a set of dependencies, gets the hierarchy nodes
  *
  * @param  {Object} dependencies - the dependencies
  * @returns {Object} the corresponding hierarchy nodes (for use in archy)
  */
function getHierarchyNodes(dependencies) {
  if (dependencies) {
    return Object.keys(dependencies).map(function(name) {
      return getHierarchy(dependencies[name]);
    });
  }
}

/**
  * gets the archy hierarchy for a given branch
  *
  * @param  {Object} branch - the branch to traverse
  * @returns {Object} the corresponding archy hierarchy
  */
function getHierarchy(branch) {
  if (branch) {
    return {
      label: branch.name + (branch.version ? "@" + branch.version : ""),
      nodes: getHierarchyNodes(branch.dependencies)
    };
  }
}

/**
  * rewrites the module tree to reflect the deduped modules
  *
  * @this {EyeglassModules}
  *
  * @param  {Object} moduleTree - the tree to prune
  * @returns {Object} the pruned tree
  */
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

/**
  * find a branch in a tree with a given path
  *
  * @param  {Object} tree - the module tree to traverse
  * @param  {String} dir - the path to search for
  * @returns {Object} the module reference
  */
function findBranchesByPath(tree, dir) {
  if (tree) {
    return Object.keys(tree).reduce(function(branches, name) {
      var mod = modules[name];
      if (mod.path === dir) {
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

/**
  * whether or not a module can be accessed by the origin request
  *
  * @this {EyeglassModules}
  *
  * @param   {String} name - the module name to find
  * @param   {String} origin - the location of the originating request
  * @returns {Boolean} whether or not access is permitted
  */
function canAccessModule(name, origin) {
  if (origin === true) {
    return true;
  }
  origin = packageUtils.findNearestPackage(origin);
  var branches = findBranchesByPath({
    dependencies: this.tree
  }, origin);
  return branches.some(function(branch) {
    if (branch.name === name || branch.dependencies[name]) {
      return true;
    }
  });
}

/**
  * given a branch of modules, flattens them into a collection
  *
  * @param   {Object} branch - the module branch
  * @param   {Object} collection - the incoming collection
  * @returns {Object} the resulting collection
  */
function flattenModules(branch, collection) {
  if (branch) {
    // if the branch itself is a module, add it...
    if (branch.isEyeglassModule) {
      collection = collection || {};
      registry[branch.name] = registry[branch.name] || [];
      registry[branch.name].push(branch);
    }

    var dependencies = branch.dependencies;

    if (dependencies) {
      var result = Object.keys(dependencies).reduce(function(registry, name) {
        return flattenModules(dependencies[name], registry);
      }, collection || {});
      return result;
    }
  }

  return registry;
}

/**
  * given a set of versions, checks if there are any compat issues
  *
  * @param   {Array<Object>} modules - the various modules to check
  * @param   {String} finalModule - the final module to check against
  * @returns {Array<Object>} the array of any issues found
  */
function getDependencyVersionIssues(modules, finalModule) {
  return modules.map(function(mod) {
    if (!semver.satisfies(mod.version, "^" + finalModule.version)) {
      return {
        name: mod.name,
        left: mod,
        right: latest
      };
    }
  });
}

/**
  * dedupes a collection of modules to a single version
  *
  * @this {EyeglassModules}
  *
  * @param   {Object} module - the collection of modules
  * @returns {Object} the deduped module collection
  */
function dedupeModules(modules) {
  if (!modules) {
    return [];
  }
  return Object.keys(modules).reduce(function(deduped, name) {
    var versions = modules[name].sort(function(a, b) {
      return semver.lt(a.version, b.version);
    });
    deduped[name] = versions.shift();
    this.issues.dependencies.versions.push.apply(
      this.issues.dependencies.versions,
      getDependencyVersionIssues(versions, deduped[name])
    );
    return deduped;
  }.bind(this), {});
}

/**
  * given a package.json reference, gets the Eyeglass module name
  *
  * @param   {Object} pkg - the package.json reference
  * @returns {String} the name of the module
  */
function getModuleName(pkg) {
  return normalizeEyeglassOptions(pkg.data.eyeglass).name || pkg.data.name;
}

/**
  * normalizes a given `eyeglass` reference from a package.json
  *
  * @param   {Object} options - the eyeglass options from the package.json
  * @returns {Object} the normalized options
  */
function normalizeEyeglassOptions(options) {
  if (typeof options === "string") {
    return {
      exports: options
    };
  }
  return typeof options === "object" ? options : {};
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
  var exportsFile = getExportsFileFromOptions(pkg.eyeglass) || pkg.main;
  return path.join(modulePath, exportsFile || "");
}

/**
  * whether or not the given package is an eyeglass module
  *
  * @param   {Object} pkg - the package.json
  * @returns {Boolean} whether or not it is an eyeglass module
  */
function isEyeglassModule(pkg) {
  return !!(pkg && includes(pkg.keywords, EYEGLASS_KEYWORD));
}

/**
  * gets the final module from the collection
  *
  * @this {EyeglassModules}
  *
  * @param   {String} name - the module name to find
  * @returns {Object} the module reference
  */
function getFinalModule(name) {
  return this.collection[name];
}

/**
  * resolves the module and it's dependencies
  *
  * @param   {String} pkg - the path to the modules package.json location
  * @param   {Boolean} isRoot - whether or not it's the root of the project
  * @returns {Object} the resolved module definition
  */
function resolveModule(pkg, isRoot) {
  pkg = packageUtils.getPackage(pkg);
  var isEyeglassMod = isEyeglassModule(pkg.data);
  if (isEyeglassMod || (pkg.data && isRoot)) {
    var modulePath = path.dirname(pkg.path);
    return {
      name: getModuleName(pkg),
      rawName: pkg.data.name,
      path: modulePath,
      version: pkg.data.version,
      main: getModuleExports(pkg.data, modulePath),
      isEyeglassModule: isEyeglassMod,
      dependencies: discoverModules.call(this, {
        dir: modulePath,
        isRoot: isRoot
      }),
      eyeglass: normalizeEyeglassOptions(pkg.data.eyeglass)
    };
  }
}

/**
  * resolves the eyeglass module itself
  *
  * @returns {Object} the resolved eyeglass module definition
  */
function getEyeglassSelf() {
  var eyeglassDir = path.resolve(__dirname, "..", "..");
  var eyeglassPkg = packageUtils.getPackage(eyeglassDir);

  var resolvedPkg = resolve(eyeglassPkg.path, eyeglassPkg.path, eyeglassDir);

  return resolveModule.call(this, resolvedPkg);
}

/**
  * resolves the package for a given module
  *
  * @see resolve()
  */
function resolveModulePackage() {
  try {
    return resolve.apply(null, arguments);
  } catch (e) {}
}

/**
  * discovers all the modules for a given set of options
  *
  * @param    {Object} options - the options to use
  * @returns  {Object} the discovered modules
  */
function discoverModules(options) {
  var pkg = options.pkg || packageUtils.getPackage(options.dir);

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
    var resolvedPkg = resolveModulePackage(
      packageUtils.getPackagePath(dependency),
      pkg.path,
      options.dir
    );
    if (!resolvedPkg) {
      this.issues.dependencies.missing.push(dependency);
    } else {
      var resolvedModule = resolveModule.call(this, resolvedPkg);
      if (resolvedModule) {
        modules[resolvedModule.name] = resolvedModule;
      }
    }
    return modules;
  }.bind(this), {});

  // if it's the root...
  if (options.isRoot) {
    // ensure eyeglass itself is a direct dependency
    dependencies.eyeglass = dependencies.eyeglass || getEyeglassSelf.call(this, options);
  }

  return Object.keys(dependencies).length ? dependencies : null;
}

module.exports = EyeglassModules;
