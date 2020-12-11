import BroccoliPlugin = require("broccoli-plugin");
import path = require("path");
import * as fs from "fs-extra";
import tmp = require("tmp");

type EnsureSymlinkSync = (srcFile: string, destLink: string) => void;
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const ensureSymlink: EnsureSymlinkSync = require("ensure-symlink");

/**
 * An object where the keys are the files that will be created in the tree and
 * the values are the source files.
 *
 * @interface FileMap
 */
interface FileMap {
  [relativePath: string]: string;
}

type BroccoliSymbolicLinkerOptions =
  Pick<BroccoliPlugin.BroccoliPluginOptions, "annotation" | "persistentOutput">;

/**
 * Creates symlinks to the source files specified.
 *
 *  BroccoliSymbolicLinker
 */
export class BroccoliSymbolicLinker extends BroccoliPlugin {
  files: FileMap;
  fakeOutputPath: string | undefined;
  constructor(fileMap?: FileMap | undefined, options: BroccoliSymbolicLinkerOptions = {}) {
    let pluginOpts: BroccoliPlugin.BroccoliPluginOptions = {needsCache: false};
    Object.assign(pluginOpts, options);
    super([], pluginOpts);
    this.files = Object.assign({}, fileMap);
  }
  reset(fileMap?: FileMap | undefined): void {
    this.files = Object.assign({}, fileMap);
  }
  /**
   * Record that a symlink should be created from src to dest.
   *
   * This can be called many times before the build method is invoked.
   * Calling it after will not have an effect until the next time build() is
   * invoked.
   *
   * @param src The file that should be symlinked into the tree.
   * @param dest the relative path from the tree's root to the location of the
   *   symlink. the filename does not have to be the same.
   * @returns the absolute path to the location where the symlink will be created.
   */
  // eslint-disable-next-line @typescript-eslint/camelcase
  ln_s(src: string, dest: string): string {
    // console.log(`will link ${src} to ${dest}`);
    this.files[dest] = src;
    let tartgetDir = this.outputPath;
    if (!tartgetDir) {
      this.fakeOutputPath = this.fakeOutputPath || tmp.dirSync().name;
      tartgetDir = this.fakeOutputPath;
    }
    return path.join(tartgetDir, dest);
  }
  /**
   * Returns the number of symlinks that will be created.
   */
  numberOfFiles(): number {
    return Object.keys(this.files).length;
  }
  /**
   * Create the symlinks. Directories to them will be created as necessary.
   */
  build(): void {
    // eslint-disable-next-line no-console
    // console.log(`Building ${this.numberOfFiles()} symlinks for ${this["_annotation"]}.`);
    for (let dest of Object.keys(this.files)) {
      let src = this.files[dest];
      // console.log(`linking ${src} to ${dest}`);
      dest = path.join(this.outputPath, dest)
      let dir = path.dirname(dest);
      fs.mkdirpSync(dir);
      ensureSymlink(src, dest)
    }
  }
  /**
   * Output the symlinks that will be created for debugging.
   */
  debug(): string {
    return Object.keys(this.files).join("\n");
  }
}
