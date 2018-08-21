"use strict";

var PACKAGE_JSON = "package.json";

var path = require("path");
var URI = require("./URI");
var fileUtils = require("./files");

function getPackageData(pkgPath) {
  try {
    return require(pkgPath);
  } catch (e) {
    /* istanbul ignore next - not really worth writing a test for */
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
  dir = URI.system(dir);
  return (path.basename(dir) === PACKAGE_JSON) ? dir : path.join(dir, PACKAGE_JSON);
}

function findNearestPackage(dir) {
  dir = URI.system(dir);
  var prevDir;
  while (dir !== prevDir) {
    if (fileUtils.existsSync(getPackagePath(dir))) {
      return dir;
    }
    prevDir = dir;
    dir = path.dirname(dir);
  }
  /* istanbul ignore next - should never happen and not possible to test */
  return false;
}


module.exports = {
  getPackage: getPackage,
  getPackageData: getPackageData,
  getPackagePath: getPackagePath,
  findNearestPackage: findNearestPackage
};
