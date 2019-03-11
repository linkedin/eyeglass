import * as fs from "fs";
import LRU = require("lru-cache");

export function resetGlobalCaches(): void {
  realpathSync.resetCache();
  existsSync.resetCache();
}

/* cache real path locations so we don't hit the filesystem
 more than once for the same path every 5 min. We cap this
 cache at ~1MB of memory.*/
const realpathCache = new LRU<string, string>({
  max: 1024 * 1024,
  length: (value, key) => value.length + key!.length,
  maxAge: 5 * 60 * 1000 /* 5 min */,
});

export function realpathSync(path: string): string {
  let value = realpathCache.get(path);
  if (value) {
    return value;
  }
  value = fs.realpathSync(path);
  realpathCache.set(path, value);
  return value;
}

realpathSync.resetCache = () => {
  realpathCache.reset();
};

let existsCache = Object.create(null);

export function existsSync(path: string): boolean {
  let result = existsCache[path]
  if (result === true || result === false) {
    return result;
  } else {
    result = fs.existsSync(path);
    existsCache[path] = result;
    return result;
  }
}

existsSync.resetCache = () => {
  existsCache = Object.create(null);
}
