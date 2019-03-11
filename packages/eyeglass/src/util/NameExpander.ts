import {
  format as formatPath,
  join as joinPaths,
  parse as parsePath,
  ParsedPath,
  sep as PATH_SEPARATOR,
} from "path";

const SASS_FILE_EXT = /^\.(s[ac]|c)ss$/

/**
  * provides an interface for expanding a given URI to valid import locations
  *
  * @constructor
  * @param   {String} uri - the base URI to be expanded
  */
export class NameExpander {
  uri: string;
  _possibleFiles: Set<string>;
  locations: Array<string>;

  constructor(uri: string) {
    // normalize the uri
    this.uri = normalizeURI(uri);
    this.locations = new Array<string>();
    // the collection of possible files
    this._possibleFiles = new Set();
  }

  get files(): Set<string> {
    if (this._possibleFiles.size === 0) {
      this.calculatePossibleFiles();
    }
    return this._possibleFiles;
  }

  /**
    * given a location, expands the collection of possible file imports
    *
    * @param   {String} location - the location path the expand the URI against
    */
  addLocation(location: string): void {
    /* istanbul ignore else - defensive conditional, don't care about else-case */
    if (!location || location === "stdin") {
      return;
    }
    this.locations.push(location);
    if (this._possibleFiles.size > 0) {
      this._possibleFiles = new Set<string>();
    }
  }
  private calculatePossibleFiles(): void {
    for (let location of this.locations) {
      // get the full path to the uri
      let fullLocation = joinPaths(location, this.uri);

      let path = parsePath(fullLocation);
      let indexPath = getIndexPath(path)
      this._possibleFiles.add(fileVariant(path, "_", ".scss"));
      if (indexPath) {
        this._possibleFiles.add(fileVariant(indexPath, "_", ".scss"));
      }

      this._possibleFiles.add(fileVariant(path, null, ".scss"));
      if (indexPath) {
        this._possibleFiles.add(fileVariant(indexPath, null, ".scss"));
      }

      this._possibleFiles.add(fileVariant(path, null, ".sass"));
      this._possibleFiles.add(fileVariant(path, null, ".css"));
      this._possibleFiles.add(fileVariant(path, "_", ".sass"));
      this._possibleFiles.add(fileVariant(path, "_", ".css"));

      if (indexPath) {
        this._possibleFiles.add(fileVariant(indexPath, null, ".sass"));
        this._possibleFiles.add(fileVariant(indexPath, null, ".css"));
        this._possibleFiles.add(fileVariant(indexPath, "_", ".sass"));
        this._possibleFiles.add(fileVariant(indexPath, "_", ".css"));
      }
    }
  }

}

function getIndexPath(
  path: ParsedPath
): ParsedPath | null {
  path = Object.create(path);
  if (path.name === "index" || path.name === "_index" || (path.ext && SASS_FILE_EXT.test(path.ext))) {
    return null;
  }
  path.dir = joinPaths(path.dir, path.name);
  path.name = "index"
  path.base = "index"
  return path;
}

/* This function returns a variant if it's allowed for the given path.
 * otherwise it returns as much of the specified variant as is allowed.
 * That means that for some paths, this returns the same output for different
 * variant arguments. It is expected that the caller will deduplicate the
 * returned values.
 *
 * It will:
 * - treat non-sass extensions as belonging to the base name.
 * 
 * It will not:
 * - change an explicit sass extension to a different sass extension
 * - remove a partial prefix (underscore)
 * - Add a partial prefix to a file that already has a partial prefix.
 * 
 */
function fileVariant(
  path: ParsedPath,
  partial: "_" | null,
  extension: ".scss" | ".sass" | ".css"
): string {
  path = Object.create(path);
  if (path.ext && !SASS_FILE_EXT.test(path.ext)) {
    path.base = path.base + path.ext;
    path.name = path.name + path.ext;
    path.ext = "";
  }
  if (!path.ext) {
    path.ext = extension;
  }
  if (partial && !path.name.startsWith(partial)) {
    path.name = partial + path.name;
  }
  path.base = path.name + path.ext;
  return formatPath(path);
}

/**
  * normalizes the URI path
  * @param    {String} uri - the URI to normalize
  * @returns  {String} the normalized URI
  */
function normalizeURI(uri: string): string {
  // update the separator to use the OS separator
  return uri.replace(/\//g, PATH_SEPARATOR);
}
