var BroccoliSassCompiler = require("./broccoli_sass_compiler");
var RSVP = require("rsvp");
var crypto = require("crypto");
var merge = require("lodash.merge");
var path = require("path");
var sortby = require("lodash.sortby");
var stringify = require("json-stable-stringify");

function httpJoin() {
  var joined = [];
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i]) {
      var segment = arguments[i];
      if (path.sep !== "/") {
        segment = segment.replace(path.sep, "/");
      }
      joined.push(segment);
    }
  }
  var result = joined.join("/");
  result = result.replace("///", "/");
  result = result.replace("//", "/");
  return result;
}

function EyeglassCompiler(inputTrees, options) {
  options = merge({}, options);
  this.pristineOptions = merge({}, options);
  this.Eyeglass = require("eyeglass");
  if (!Array.isArray(inputTrees)) {
    inputTrees = [inputTrees];
  }
  if (options.configureEyeglass) {
    this.configureEyeglass = options.configureEyeglass;
    delete options.configureEyeglass;
  }

  this.relativeAssets = options.relativeAssets;
  delete options.relativeAssets;

  if (options.assets) {
    this.assetDirectories = options.assets;
    if (typeof this.assetDirectories === "string") {
      this.assetDirectories = [this.assetDirectories];
    }
    delete options.assets;
  }
  if (options.assetsHttpPrefix) {
    this.assetsHttpPrefix = options.assetsHttpPrefix;
    delete options.assetsHttpPrefix;
  }

  // TODO: this should not be accessed before super (ES6 Aligment);
  BroccoliSassCompiler.call(this, inputTrees, options);
  this.events.on("compiling", this.handleNewFile.bind(this));
}

EyeglassCompiler.prototype = Object.create(BroccoliSassCompiler.prototype);
EyeglassCompiler.prototype.constructor = EyeglassCompiler;
EyeglassCompiler.prototype.handleNewFile = function(details) {
  if (!details.options.eyeglass) {
    details.options.eyeglass = {};
  }
  if ((this.assetsHttpPrefix || this.assetsRelativeTo) && !details.options.eyeglass.assets) {
    details.options.eyeglass.assets = {};
  }
  if (this.assetsHttpPrefix) {
    details.options.eyeglass.assets.httpPrefix = this.assetsHttpPrefix;
  }

  if (this.relativeAssets) {
    details.options.eyeglass.assets.relativeTo =
      httpJoin(details.options.eyeglass.httpRoot || "/", path.dirname(details.cssFilename));
  }

  details.options.eyeglass.buildDir = details.destDir;
  details.options.eyeglass.engines = details.options.eyeglass.engines || {};
  details.options.eyeglass.engines.sass = details.options.eyeglass.engines.sass || this.sass;

  var eyeglass = new this.Eyeglass(details.options);

  // set up asset dependency tracking
  var self = this;
  var realResolve = eyeglass.assets.resolve;
  eyeglass.assets.resolve = function(filepath, fullUri, cb) {
    self.events.emit("dependency", filepath);
    realResolve.call(eyeglass.assets, filepath, fullUri, cb);
  };
  var realInstall = eyeglass.assets.install;
  eyeglass.assets.install = function(file, uri, cb) {
    realInstall.call(eyeglass.assets, file, uri, function(error, file) {
      if (!error) {
        self.events.emit("additional-output", file);
      }
      cb(error, file);
    });
  };

  if (this.assetDirectories) {
    for (var i = 0; i < this.assetDirectories.length; i++) {
      eyeglass.assets.addSource(path.resolve(eyeglass.options.eyeglass.root,
                                             this.assetDirectories[i]),
        {
          globOpts: {
            ignore: ["**/*.js", "**/*.s[ac]ss"]
          }
        });
    }
  }
  if (this.configureEyeglass) {
    this.configureEyeglass(eyeglass, this.sass, details);
  }
  details.options = eyeglass.options;
  details.options.eyeglass.engines.eyeglass = eyeglass;
};

EyeglassCompiler.prototype.cachableOptions = function(rawOptions) {
  rawOptions = merge({}, rawOptions);
  delete rawOptions.file;
  if (rawOptions.eyeglass) {
    delete rawOptions.eyeglass.engines;
  }
  return rawOptions;
};

EyeglassCompiler.currentVersion = function() {
   var selfDir = path.resolve(path.join(__dirname, ".."));
   var selfPkg = require(path.join(selfDir, "package.json"));
   return selfPkg.version;
};

EyeglassCompiler.prototype.dependenciesHash = function(srcDir, relativeFilename, options) {
  var self = this;
  return new RSVP.Promise(function(resolve, reject) {
    if (!self._dependenciesHash) {
      var hashForDep = require("hash-for-dep");
      var eyeglass = new self.Eyeglass(options);
      var hash = crypto.createHash("sha1");

      hash.update(stringify(self.cachableOptions(options)));
      hash.update("broccoli-eyeglass@" + EyeglassCompiler.currentVersion());
      var egModules = sortby(eyeglass.modules.list, function(m) {
        return m.name;
      });
      egModules.forEach(function(mod) {
        if (mod.inDevelopment || mod.eyeglass.inDevelopment) {
          hash.update(mod.name+"@"+hashForDep(mod.path));
        } else {
          hash.update(mod.name+"@"+mod.version);
        }
      });
      self._dependenciesHash = hash.digest("hex");
    }
    resolve(self._dependenciesHash);
  });
};

EyeglassCompiler.prototype.keyForSourceFile = function(srcDir, relativeFilename, options) {
  var keyPromise = BroccoliSassCompiler.prototype.keyForSourceFile.call(this,
    srcDir, relativeFilename, options);
  var dependenciesPromise = this.dependenciesHash(srcDir, relativeFilename, options);
  return RSVP.all([keyPromise, dependenciesPromise]).then(function(results) {
    var mungedKey = results[0] + "+" + results[1];
    return mungedKey;
  });
};

module.exports = EyeglassCompiler;
