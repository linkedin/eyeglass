"use strict";

var path = require("path");
var merge = require("lodash.merge");
var URI = require("./URI");

function Options(options, deprecate, sassArg) {
  // get the normalized Sass options
  options = getSassOptions.apply(null, arguments);

  // merge the incoming options onto the instance
  merge(this, options);
}

function eyeglassOptionsFromNodeSassArg(arg, deprecate) {
  // if it looks like node-sass...
  if (arg && arg.render && arg.renderSync && arg.info) {
    // throw a deprecation warning
    deprecate("0.8.0", "0.9.0", [
      "You should no longer pass `sass` directly to Eyeglass. Instead pass it as an option:",
      "var options = eyeglass({",
      "  /* sassOptions */",
      "  ...",
      "  eyeglass: {",
      "    engines: {",
      "      sass: require('node-sass')",
      "    }",
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
}

function includePathsFromEnv() {
  return normalizeIncludePaths(process.env.SASS_PATH, process.cwd());
}

function migrateEyeglassOptionsFromSassOptions(sassOptions, eyeglassOptions, deprecate) {
  // migrates the following properties from sassOptions to eyeglassOptions
  [
    "root",
    "cacheDir",
    "buildDir",
    "httpRoot",
    "strictModuleVersions"
  ].forEach(function(option) {
    if (eyeglassOptions[option] === undefined && sassOptions[option] !== undefined) {
      deprecate("0.8.0", "0.9.0", [
        "`" + option + "` should be passed into the eyeglass options rather than the sass options:",
        "var options = eyeglass({",
        "  /* sassOptions */",
        "  ...",
        "  eyeglass: {",
        "    " + option + ": ...",
        "  }",
        "});"
      ].join("\n  "));

      eyeglassOptions[option] = sassOptions[option];
      delete sassOptions[option];
    }
  });
}

function migrateAssetOptionsFromSassOptions(sassOptions, eyeglassOptions, deprecate) {
  // migrates the following properties from sassOptions to eyeglassOptions
  [
    ["assetsHttpPrefix", "httpPrefix"],
    ["assetsRelativeTo", "relativeTo"]
  ].forEach(function(optionPair) {
    var fromOption = optionPair[0];
    var toOption = optionPair[1];
    if ((eyeglassOptions.assets === undefined ||
          (eyeglassOptions.assets && eyeglassOptions.assets[toOption] === undefined)) &&
        sassOptions[fromOption] !== undefined) {
      deprecate("0.8.0", "0.9.0", [
        "`" + fromOption +
          "` has been renamed to `" + toOption +
          "` and should be passed into the eyeglass asset options rather than the sass options:",
        "var options = eyeglass({",
        "  /* sassOptions */",
        "  ...",
        "  eyeglass: {",
        "    assets: {",
        "      " + toOption + ": ...",
        "    }",
        "  }",
        "});"
      ].join("\n  "));

      if (eyeglassOptions.assets === undefined) {
        eyeglassOptions.assets = {};
      }
      eyeglassOptions.assets[toOption] = sassOptions[fromOption];
      delete sassOptions[fromOption];
    }
  });
}

function defaultSassOptions(options) {
  options.includePaths = defaultValue(options.includePaths, includePathsFromEnv());
  return options;
}

function defaultEyeglassOptions(options) {
  // default root dir
  options.root = defaultValue(options.root, process.cwd());
  // default cache dir
  options.cacheDir = defaultValue(options.cacheDir, path.join(options.root, ".eyeglass_cache"));
  // default engines
  options.engines = defaultValue(options.engines, {});
  options.engines.sass = defaultValue(options.engines.sass, require("node-sass"));
  // default assets
  options.assets = defaultValue(options.assets, {});
  // default httpRoot
  options.httpRoot = defaultValue(options.httpRoot, "/");
  // default enableImportOnce
  options.enableImportOnce = defaultValue(options.enableImportOnce, true);

  // use global module caching by default
  options.useGlobalModuleCache = defaultValue(options.useGlobalModuleCache, true);

  return options;
}

function normalizeIncludePaths(includePaths, baseDir) {
  if (!includePaths) {
    return [];
  }

  // in some cases includePaths is a path delimited string
  if (typeof includePaths === "string") {
    includePaths = includePaths.split(path.delimiter);
  }

  // filter out empty paths
  includePaths = includePaths.filter(function(dir) {
    return !!dir;
  });

  // make all relative include paths absolute
  return includePaths.map(function(dir) {
    return path.resolve(baseDir, URI.system(dir));
  });
}

function normalizeSassOptions(sassOptions, eyeglassOptions) {
  sassOptions.includePaths = normalizeIncludePaths(sassOptions.includePaths, eyeglassOptions.root);

  // merge the eyeglassOptions back onto the sassOptions namespace
  sassOptions.eyeglass = eyeglassOptions;

  return sassOptions;
}

function getSassOptions(options, deprecate, sassArg) {
  var sassOptions = options || {};
  // we used to support passing `node-sass` as the second argument to eyeglass,
  //  this should now be an options object
  // if the eyeglassOptions looks like node-sass, convert it into an object
  // this can be removed when we fully deprecate this support
  var eyeglassOptions =  merge(
    {},
    eyeglassOptionsFromNodeSassArg(sassArg, deprecate),
    sassOptions.eyeglass
  );

  // determine whether or not we should normalize URI path separators
  // @see URI
  if (eyeglassOptions.normalizePaths !== undefined) {
    process.env.EYEGLASS_NORMALIZE_PATHS = "" + eyeglassOptions.normalizePaths;
  }

  // support simple enabling of the sandbox.
  if (eyeglassOptions.fsSandbox === true) {
    eyeglassOptions.fsSandbox = [eyeglassOptions.root];
  }

  // support simple strings instead of requiring a list for even a single dir.
  if (typeof eyeglassOptions.fsSandbox === "string") {
    eyeglassOptions.fsSandbox = [eyeglassOptions.fsSandbox];
  }

  // migrate eyeglassOptions off of the sassOptions (will be deprecated)
  migrateEyeglassOptionsFromSassOptions(sassOptions, eyeglassOptions, deprecate);
  migrateAssetOptionsFromSassOptions(sassOptions, eyeglassOptions, deprecate);

  defaultSassOptions(sassOptions);
  defaultEyeglassOptions(eyeglassOptions);

  normalizeSassOptions(sassOptions, eyeglassOptions);

  // and return the options
  return sassOptions;
}

function defaultValue(item, value) {
  return (item === undefined) ? value : item;
}

module.exports = Options;
