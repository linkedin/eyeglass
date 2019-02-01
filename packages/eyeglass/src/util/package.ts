var PACKAGE_JSON = "package.json";
import { PackageJson } from "package-json";
import * as path from "path";
import { existsSync } from "fs";
import { URI } from "./URI";

export function getPackageData(pkgPath: string): PackageJson {
  try {
    return require(pkgPath);
  } catch (e) {
    /* istanbul ignore next - not really worth writing a test for */
    return null;
  }
}

interface Package {
  path: string;
  data: PackageJson;
}

export function getPackage(dir: string): Package {
  var pkgPath = getPackagePath(dir);
  return {
    path: pkgPath,
    data: getPackageData(pkgPath)
  };
}

export function getPackagePath(dir: string): string {
  dir = URI.system(dir);
  return (path.basename(dir) === PACKAGE_JSON) ? dir : path.join(dir, PACKAGE_JSON);
}

function unreachable(): never {
  throw new Error("Unreachable code location was reached.")
}

export function findNearestPackage(dir: string): string {
  dir = URI.system(dir);
  var prevDir;
  while (dir !== prevDir) {
    if (existsSync(getPackagePath(dir))) {
      return dir;
    }
    prevDir = dir;
    dir = path.dirname(dir);
  }

  /* istanbul ignore next - should never happen and not possible to test */
  unreachable();
}
