import { existsSync } from '../util/perf';
import packageJson = require('package-json');
import * as path from 'path';

import { URI } from './URI';

type PackageJson = packageJson.FullVersion;

let PACKAGE_JSON = "package.json";
export function getPackageData<ExtraPackageData = never>(pkgPath: string): null | (PackageJson & ExtraPackageData) {
  try {
    return require(pkgPath);
  } catch (e) {
    /* istanbul ignore next - not really worth writing a test for */
    return null;
  }
}

export interface Package<ExtraPackageData = {}> {
  path: string;
  data: null | (PackageJson & ExtraPackageData);
}

export function getPackage<ExtraPackageData = {}>(dir: string): Package<ExtraPackageData> {
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
  let originalDir = dir;
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
  throw new Error(`No package.json file found in directory ${originalDir} or in any of the parent directories.`)
}
