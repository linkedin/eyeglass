"use strict";

var path = require("path");
var deprecate = require("./util/deprecate");

function Options(eyeglass, sassOptions, eyeglassOptions) {
  // setup empty options containers
  this.sass = {};
  this.eyeglass = {};

  // then normalize the options we've been given
  processOptions.call(this, sassOptions, eyeglassOptions, eyeglass);
}

function eyeglassOptionsFromNodeSassArg(arg) {
  // if it looks like node-sass...
  if (arg.render && arg.renderSync && arg.info) {
    // throw a deprecation warning
    deprecate([
      "You should no longer pass `sass` directly to Eyeglass. Instead pass it as an option:",
      "var options = eyeglass(sassOptions, {",
      "  engines: {",
      "    sass: require('node-sass')",
      "  }",
      "});"
    ].join("\n  "));

    // and convert it the correct format
    return {
      engines: {
        sass: arg
      }
    };
  }

  // otherwise just return whatever was passed in
  return arg;
}

function includePathsFromEnv() {
  if (process.env.SASS_PATH) {
    return process.env.SASS_PATH.split(path.delimiter).map(function(dir) {
      return path.resolve(process.cwd(), dir);
    });
  }
}

function migrateEyeglassOptionsFromSassOptions(sassOptions, eyeglassOptions) {
  // migrates the following properties from sassOptions to eyeglassOptions
  [
    "root",
    "cacheDir",
    "buildDir",
    "httpRoot",
    "assetsHttpPrefix",
    "assetsRelativeTo",
    "strictModuleVersions"
  ].forEach(function(option) {
    if (eyeglassOptions[option] === undefined && sassOptions[option] !== undefined) {
      deprecate([
        "`" + option + "` should be passed into the eyeglass options rather than the sass options:",
        "var options = eyeglass(\/* sassOptions *\/, {",
        "  " + option + ": ...",
        "});"
      ].join("\n  "));

      eyeglassOptions[option] = sassOptions[option];
      delete sassOptions[option];
    }
  });
}

function defaultSassOptions(options) {
  options.includePaths = defaultValue(options.includePaths, includePathsFromEnv() || []);
  return options;
}

function defaultEyeglassOptions(options) {
  options.root = defaultValue(options.root, process.cwd());
  options.cacheDir = defaultValue(options.cacheDir, path.join(options.root, ".eyeglass_cache"));
  options.engines = defaultValue(options.engines, {});
  options.engines.sass = defaultValue(options.engines.sass, require("node-sass"));
  options.assets = defaultValue(options.assets, []);
  options.httpRoot = defaultValue(options.httpRoot, "/");
  options.enableImportOnce = defaultValue(options.enableImportOnce, true);
  return options;
}

function processOptions(sassOptions, eyeglassOptions, eyeglass) {
  sassOptions = sassOptions || {};
  eyeglassOptions = eyeglassOptions || {};

  // we used to support passing `node-sass` as the second argument to eyeglass,
  //  this should now be an options object
  // if the eyeglassOptions looks like node-sass, convert it into an object
  // this can be removed when we fully deprecate this support
  eyeglassOptions = eyeglassOptionsFromNodeSassArg(eyeglassOptions);

  migrateEyeglassOptionsFromSassOptions(sassOptions, eyeglassOptions);

  sassOptions = defaultSassOptions(sassOptions);
  eyeglassOptions = defaultEyeglassOptions(eyeglassOptions);

  // in some cases includePaths is a path delimited string
  if (typeof sassOptions.includePaths === "string") {
    sassOptions.includePaths = sassOptions.includePaths.split(path.delimiter);
  }

  // make all relative include paths absolute against the project root.
  sassOptions.includePaths = sassOptions.includePaths.map(function(dir) {
    return path.resolve(eyeglassOptions.root, dir);
  });

  // export the final options
  this.sass = sassOptions;
  this.eyeglass = eyeglassOptions;
}

function defaultValue(item, value) {
  return (item === undefined) ? value : item;
}


module.exports = Options;
