/**
  * A simple caching implementation
  */
export class SimpleCache {
  cache: {[key: string]: any};
  constructor() {
    this.cache = {};
  }

  /**
    * Returns the current cached value
    *
    * @param   {String} key - they cache key to lookup
    * @returns {*} the cached value
    */
  get(key) {
    return this.cache[key];
  }

  /**
    * Sets the cached value
    *
    * @param    {String} key - they cache key to update
    * @param    {*} value - they value to store
    */
  set(key, value) {
    this.cache[key] = value;
  }

  /**
    * Whether or not the cache has a value for a given key
    *
    * @param    {String} key - they cache key to lookup
    * @returns  {Boolean} whether or not the key is set
    */
  has(key) {
    return this.cache.hasOwnProperty(key);
  }

  /**
    * Gets the current value from the cache (if it exists), otherwise invokes the callback
    *
    * @param    {String} key - they cache key lookup
    * @param    {Function} callback - the callback to be invoked when the key is not in the cache
    * @returns
    */
  getOrElse(key, callback) {
    // if we do not yet have a result, generate it and store it in the cache
    if (!this.has(key)) {
      this.set(key, callback());
    }

    // return the result from the cache
    return this.get(key);
  }

  /**
    * Purges the cache
    */
  purge() {
    this.cache = {};
  }
}