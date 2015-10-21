"use strict";

var PACKAGE_JSON = "package.json";

var path = require("path");
var fs = require("fs");

function existsSync(file) {
  return fs.existsSync(file);
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

function findNearestPackage(dir) {
  var prevDir;
  while (dir !== prevDir) {
    if (existsSync(getPackagePath(dir))) {
      return dir;
    }
    prevDir = dir;
    dir = path.dirname(dir);
  }
  return false;
}


module.exports = {
  getPackage: getPackage,
  getPackageData: getPackageData,
  getPackagePath: getPackagePath,
  findNearestPackage: findNearestPackage
};
