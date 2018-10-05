"use strict";

var resolve = require("../util/resolve");
var packageUtils = require("../util/package");
var EyeglassModule = require("./EyeglassModule");
var SimpleCache = require("../util/SimpleCache");
var debug = require("../util/debug");
var path = require("path");
var merge = require("lodash.merge");
var semver = require("semver");
var archy = require("archy");
var fs = require("fs");
var URI = require("../util/URI");

var globalModuleCache = new SimpleCache();

/**
  * Discovers all of the modules for a given directory
  *
  * @constructor
  * @param   {String} dir - the directory to discover modules in
  * @param   {Array} modules - the explicit modules to include
  * @param   {Boolean} useGlobalModuleCache - whether or not to use the global module cache
  */
function EyeglassModules(dir, modules, useGlobalModuleCache) {
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

  this.cache = {
    access: new SimpleCache(),
    modules: useGlobalModuleCache ? globalModuleCache : new SimpleCache()
  };

  // find the nearest package.json for the given directory
  dir = packageUtils.findNearestPackage(path.resolve(dir));

  // resolve the current location into a module tree
  var moduleTree = resolveModule.call(this, dir, true);

  // if any modules were passed in, add them to the module tree
  if (modules && modules.length) {
    moduleTree.dependencies = modules.reduce(function(dependencies, mod) {
      mod = new EyeglassModule(merge(mod, {
        isEyeglassModule: true
      }), discoverModules.bind(this));
      dependencies[mod.name] = mod;
      return dependencies;
    }.bind(this), moduleTree.dependencies);
  }

  // convert the tree into a flat collection of deduped modules
  var collection = dedupeModules.call(this, flattenModules(moduleTree));

  // expose the collection
  this.collection = collection;
  // convert the collection object into a simple array for easy iteration
  this.list = Object.keys(collection).map(function(name) {
    return collection[name];
  });
  // prune and expose the tree
  this.tree = pruneModuleTree.call(this, moduleTree);
  // set the current projects name
  this.projectName = moduleTree.name;
  // expose a convenience reference to the eyeglass module itself
  this.eyeglass = this.find("eyeglass");

  // check for any issues we may have encountered
  checkForIssues.call(this);

  /* istanbul ignore next - don't test debug */
  debug.modules && debug.modules("discovered modules\n\t" + this.getGraph().replace(/\n/g, "\n\t"));
}

/**
  * initializes all of the modules with the given engines
  *
  * @param   {Eyeglass} eyeglass - the eyeglass instance
  * @param   {Function} sass - the sass engine
  */
EyeglassModules.prototype.init = function(eyeglass, sass) {
  this.list.forEach(function(mod) {
    mod.init(eyeglass, sass);
  });
};

/**
  * Checks whether or not a given location has access to a given module
  *
  * @param   {String} name - the module name to find
  * @param   {String} origin - the location of the originating request
  * @returns {Object} the module reference if access is granted, null if access is prohibited
  */
EyeglassModules.prototype.access = function(name, origin) {
  var mod = this.find(name);

  // if we have a module, ensure that we can access it from the origin
  if (mod && !canAccessModule.call(this, name, origin)) {
    // if not, return null
    return null;
  }

  // otherwise, return the module reference
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
    // for each dependency, recurse and get it's hierarchy
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
  // return an object the confirms to the archy expectations
  return {
    // if the branch has a version on it, append it to the label
    label: branch.name + (branch.version ? "@" + branch.version : ""),
    nodes: getHierarchyNodes(branch.dependencies)
  };
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
  var finalModule = moduleTree.isEyeglassModule && this.find(moduleTree.name);
  // normalize the branch
  var branch = {
    name: finalModule && finalModule.name || moduleTree.name,
    version: finalModule && finalModule.version || moduleTree.version,
    path: finalModule && finalModule.path || moduleTree.path
  };
  // if the tree has dependencies
  var dependencies = moduleTree.dependencies;
  if (dependencies) {
    // copy them into the branch after recursively pruning
    branch.dependencies = Object.keys(dependencies).reduce(function(tree, name) {
      tree[name] = pruneModuleTree.call(this, dependencies[name]);
      return tree;
    }.bind(this), {});
  }
  return branch;
}

/**
  * find a branches in a tree with a given path
  *
  * @param  {Object} tree - the module tree to traverse
  * @param  {String} dir - the path to search for
  * @returns {Object} the branches of the tree that contain the path
  */
function findBranchesByPath(tree, dir) {
  // iterate over the tree
  return Object.keys(tree).reduce(function(branches, name) {
    var mod = tree[name];
    // if the module path matches the search path, push it onto our results
    if (mod.path === dir) {
      branches.push(mod);
    }
    // if the module has dependencies, search those as well
    if (mod.dependencies) {
      branches.push.apply(branches, findBranchesByPath(mod.dependencies, dir));
    }
    return branches;
  }, []);
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
  // eyeglass can be imported by anyone, regardless of the dependency tree
  if (name === "eyeglass") {
    return true;
  }

  var canAccessFrom = function canAccessFrom(origin) {
    // find the nearest package for the origin
    var pkg = packageUtils.findNearestPackage(origin);
    var cacheKey = pkg + "!" + origin;
    return this.cache.access.getOrElse(cacheKey, function() {
      // find all the branches that match the origin
      var branches = findBranchesByPath({
        dependencies: this.tree
      }, pkg);

      var canAccess = branches.some(function(branch) {
        // if the reference is to itself (branch.name)
        // OR it's an immediate dependency (branch.dependencies[name])
        if (branch.name === name || branch.dependencies && branch.dependencies[name]) {
          return true;
        }
      });

      /* istanbul ignore next - don't test debug */
      debug.import && debug.import(
        "%s can%s be imported from %s",
        name,
        (canAccess ? "" : "not"),
        origin
      );
      return canAccess;
    }.bind(this));
  }.bind(this);

  // check if we can access from the origin...
  var canAccess = canAccessFrom(origin);

  // if not...
  if (!canAccess) {
    // check for a symlink...
    var realOrigin = fs.realpathSync(origin);
    /* istanbul ignore if */
    if (realOrigin !== origin) {
      /* istanbul ignore next */
      canAccess = canAccessFrom(realOrigin);
    }
  }

  return canAccess;
}

/**
  * given a branch of modules, flattens them into a collection
  *
  * @param   {Object} branch - the module branch
  * @param   {Object} collection - the incoming collection
  * @returns {Object} the resulting collection
  */
function flattenModules(branch, collection) {
  // if the branch itself is a module, add it...
  if (branch.isEyeglassModule) {
    collection = collection || {};
    collection[branch.name] = collection[branch.name] || [];
    collection[branch.name].push(branch);
  }

  var dependencies = branch.dependencies;

  if (dependencies) {
    return Object.keys(dependencies).reduce(function(registry, name) {
      return flattenModules(dependencies[name], registry);
    }, collection || {});
  }

  return collection;
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
    // if the versions are not identical, log it
    if (mod.version !== finalModule.version) {
      /* istanbul ignore next - don't test debug */
      debug.modules && debug.modules(
        "asked for %s@%s but using %s",
        mod.name,
        mod.version,
        finalModule.version
      );
    }
    // check that the current module version is satisfied by the finalModule version
    // if not, push an error object onto the results
    if (!semver.satisfies(mod.version, "^" + finalModule.version)) {
      return {
        name: mod.name,
        left: mod,
        right: finalModule
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
  return Object.keys(modules).reduce(function(deduped, name) {
    // first sort our modules by version
    var versions = modules[name].sort(function(a, b) {
      return semver.lt(a.version, b.version);
    });
    // then take the highest version we found
    deduped[name] = versions.shift();
    // check for any version issues
    this.issues.dependencies.versions.push.apply(
      this.issues.dependencies.versions,
      getDependencyVersionIssues(versions, deduped[name])
    );
    // and return the deduped collection
    return deduped;
  }.bind(this), {});
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
  * @param   {String} pkgPath - the path to the modules package.json location
  * @param   {Boolean} isRoot - whether or not it's the root of the project
  * @returns {Object} the resolved module definition
  */
function resolveModule(pkgPath, isRoot) {
  var cacheKey = "resolveModule~" + pkgPath + "!" + !!isRoot;
  return this.cache.modules.getOrElse(cacheKey, function() {
    var pkg = packageUtils.getPackage(pkgPath);
    var isEyeglassMod = EyeglassModule.isEyeglassModule(pkg.data);
    // if the module is an eyeglass module OR it's the root project
    if (isEyeglassMod || (pkg.data && isRoot)) {
      // return a module reference
      return new EyeglassModule({
        isEyeglassModule: isEyeglassMod,
        path: path.dirname(pkg.path)
      }, discoverModules.bind(this), isRoot);
    }
  }.bind(this));
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
function resolveModulePackage(id, parent, parentDir) {
  var cacheKey = "resolveModulePackage~" + id + "!" + parent + "!" + parentDir;
  return this.cache.modules.getOrElse(cacheKey, function() {
    try {
      return resolve(id, parent, parentDir);
    } catch (e) {}
  });
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

  // if there's package.json contents...
  /* istanbul ignore else - defensive conditional, don't care about else-case */
  if (pkg.data) {
    merge(
      dependencies,
      // always include the `dependencies` and `peerDependencies`
      pkg.data.dependencies,
      pkg.data.peerDependencies,
      // only include the `devDependencies` if isRoot
      options.isRoot && pkg.data.devDependencies
    );
  }

  // for each dependency...
  dependencies = Object.keys(dependencies).reduce(function(modules, dependency) {
    // resolve the package.json
    var resolvedPkg = resolveModulePackage.call(
      this,
      packageUtils.getPackagePath(dependency),
      pkg.path,
      URI.system(options.dir)
    );
    if (!resolvedPkg) {
      // if it didn't resolve, they likely didn't `npm install` it correctly
      this.issues.dependencies.missing.push(dependency);
    } else {
      // otherwise, set it onto our collection
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
