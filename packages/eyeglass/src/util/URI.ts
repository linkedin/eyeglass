import * as path from "path";
import * as stringUtils from "./strings";
import { SassImplementation } from "./SassImplementation";

const stdSep = "/";
const rAllPathSep = /[/\\]+/g;
const rIsRelative = /^\.{1,2}/;
const rUriFragments =  /^([^?#]+)(\?[^#]*)?(#.*)?/;
const rSearchDelim = /^[?&]*/;

function shouldNormalizePathSep(): boolean {
  // normalize if the path separator is a backslash or we haven't explicitly disabled normalization
  return path.sep === "\\" || process.env.EYEGLASS_NORMALIZE_PATHS !== "false";
}

function convertSeparator(uri: string, sep: string): string {
  return shouldNormalizePathSep() ? uri.replace(rAllPathSep, sep) : uri;
}

/**
  * Provides an interface for working with URIs
  *
  * @constructor
  * @param    {String} uri - the original URI
  * @param    {String} sep - the target separator to use when representing the pathname
  */
export class URI {
  sep: "/" | "\\";
  path: string;
  search: string;
  hash: string;
  constructor(uri: string, sep: "/" | "\\" | null = null) {
    this.sep = sep || stdSep;
    this.path = "";
    this.search = "";
    this.hash = ""

    let uriFragments = rUriFragments.exec(uri);
    if (!uriFragments) {
      throw new Error(`Malformed URI: ${uri}`);
    }
    this.setPath(uriFragments[1]);
    this.setQuery(uriFragments[2]);
    this.setHash(uriFragments[3]);
  }

  /**
    * sets the new pathname for the URI
    * @param    {String} pathname - the new pathname to set
    */
  setPath(pathname: string): void {
    // convert the path separator to standard system paths
    pathname = convertSeparator(pathname, path.sep);
    // then normalize the path
    pathname = path.normalize(pathname);
    // then set it using the specified path
    this.path = convertSeparator(pathname, this.sep);
  }

  /**
    * gets the pathname of the URI
    * @param sep - the separator to use to represent the pathname
    * @param relativeTo - if set, returns the pathname relative to this base path
    */
  getPath(sep?: string, relativeTo?: string): string {
    let pathname = this.path;
    if (relativeTo) {
      pathname = convertSeparator(pathname, path.sep);
      relativeTo = convertSeparator(relativeTo, path.sep);
      if (pathname.indexOf(relativeTo) === 0) {
        pathname = path.relative(relativeTo, pathname);
      }
    }
    return convertSeparator(pathname, sep || this.sep);
  }

  /**
    * adds a query string to the URI
    * @param    {String} search - the query string to append
    */
  addQuery(search: string): void {
    if (!search) {
      return;
    }
    // append the new search string
    // ensuring the leading character is the appropriate delimiter
    this.search += search.replace(rSearchDelim, this.search ? "&" : "?");
  }

  /**
    * replaces the query string on the URI
    * @param    {String} search - the query string to set
    */
  setQuery(search: string): void {
    // reset the search
    this.search = "";
    // then add the new one
    this.addQuery(search);
  }

  /**
    * replaces the hash string on the URI
    * @param    {String} hash - the hash string to set
    */
  setHash(hash: string): void {
    this.hash = hash === undefined ? "" : hash;
  }

  /**
    * returns the URI as a string
    * @returns  {String} the full URI
    */
  toString(): string {
    return this.path + this.search + this.hash;
  }

  /**
    * given any number of path fragments, joins the non-empty fragments
    * @returns  {String} the joined fragments
    */
  static join(...fragments: Array<string | undefined | null>): string {
    // join all the non-empty paths
    let uri = new URI(fragments.filter((fragment) => {
      return !!fragment;
    }).join(stdSep));
    return uri.getPath();
  }

  /**
    * whether or not a given URI is relative
    * @param    {String} uri - the URI to check
    * @returns  {Boolean} whether or not the URI is relative like
    */
  static isRelative(uri: string): boolean {
    return rIsRelative.test(uri);
  }

  /**
    * normalizes the URI for use as a web URI
    * @param    {String} uri - the URI to normalize
    * @returns  {String} the normalized URI
    */
  static web(uri: string): string {
    return (new URI(uri)).toString();
  }

  /**
    * normalizes the URI for use as a system path
    * @param    {String} uri - the URI to normalize
    * @returns  {String} the normalized URI
    */
  static system(uri: string): string {
    // convert the path separator to standard system paths
    let pathname = convertSeparator(uri, path.sep);
    // then normalize the path
    return path.normalize(pathname);
  }

  /**
    * ensures that the URI is able to be cleanly exported to a SassString
    * @param    {String} uri - the URI to normalize
    * @returns  {String} the normalized URI
    */
  static sass(sassImpl: SassImplementation, uri: string): string {
    // escape all backslashes for Sass string and quote it
    //  "C:\foo\bar.png" -> "C:\\foo\\bar.png"
    // actual backslash, for real this time http://www.xkcd.com/1638/
    return stringUtils.quoteJS(sassImpl, uri.replace(/\\/g, "\\\\"));
  }

  /**
    * decorates a URI to preserve special characters
    * @param    {String} uri - the URI to decorate
    * @returns  {String} the decorated URI
    */
  static preserve(uri: string): string {
    return uri.replace(/\\/g, "<BACKSLASH>");
  }

  /**
    * restores a URI to restore special characters (opposite of URI.preserve)
    * @param    {String} uri - the URI to restore
    * @returns  {String} the restored URI
    */
  static restore(uri: string): string {
    return uri.replace(/<BACKSLASH>/g, "\\");
  }
}
