import { Dict } from "./typescriptUtils";

/**
  * A simple caching implementation
  */
export class SimpleCache<T> {
  cache: Dict<T>;
  constructor() {
    this.cache = {};
  }

  /**
    * Returns the current cached value
    *
    * @param   {String} key - they cache key to lookup
    * @returns {*} the cached value
    */
  get(key: string): T | undefined {
    return this.cache[key];
  }

  /**
    * Sets the cached value
    *
    * @param    {String} key - they cache key to update
    * @param    {*} value - they value to store
    */
  set(key: string, value: T): void {
    this.cache[key] = value;
  }

  /**
    * Whether or not the cache has a value for a given key
    *
    * @param    {String} key - they cache key to lookup
    * @returns  {Boolean} whether or not the key is set
    */
  has(key: string): boolean {
    return this.cache.hasOwnProperty(key);
  }

  /**
    * Gets the current value from the cache (if it exists), otherwise invokes the callback
    *
    * @param    {String} key - they cache key lookup
    * @param    {Function} callback - the callback to be invoked when the key is not in the cache
    * @returns
    */
  getOrElse(key: string, callback: () => T): T {
    // if we do not yet have a result, generate it and store it in the cache
    if (!this.has(key)) {
      let v = callback();
      this.set(key, v);
      return v;
    }

    // return the result from the cache
    return this.get(key)!;
  }

  /**
    * Purges the cache
    */
  purge(): void {
    this.cache = {};
  }
}