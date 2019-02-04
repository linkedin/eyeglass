import { existsSync } from 'fs';
import { PackageJson } from 'package-json';
import * as path from 'path';

import { unreachable } from './assertions';
import { URI } from './URI';

let PACKAGE_JSON = "package.json";
export function getPackageData<ExtraPackageData = never>(pkgPath: string): PackageJson & ExtraPackageData {
  try {
    return require(pkgPath);
  } catch (e) {
    /* istanbul ignore next - not really worth writing a test for */
    return null;
  }
}

export interface Package<ExtraPackageData = never> {
  path: string;
  data: PackageJson & ExtraPackageData;
}

export function getPackage<ExtraPackageData = never>(dir: string): Package<ExtraPackageData> {
  let pkgPath = getPackagePath(dir);
  return {
    path: pkgPath,
    data: getPackageData(pkgPath)
  };
}

export function getPackagePath(dir: string): string {
  dir = URI.system(dir);
  return (path.basename(dir) === PACKAGE_JSON) ? dir : path.join(dir, PACKAGE_JSON);
}

export function findNearestPackage(dir: string): string {
  dir = URI.system(dir);
  let prevDir;
  while (dir !== prevDir) {
    if (existsSync(getPackagePath(dir))) {
      return dir;
    }
    prevDir = dir;
    dir = path.dirname(dir);
  }

  /* istanbul ignore next - should never happen and not possible to test */
  return unreachable();
}
