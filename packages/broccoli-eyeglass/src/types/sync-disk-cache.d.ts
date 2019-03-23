export = SyncDiskCache;
interface CacheHit {
  isCached: true;
  key: string;
  value: string;
}
interface CacheMiss {
  isCached: false;
  key: undefined;
  value: undefined;
}

interface SyncDiskCacheOptions {
  location?: string;
  compression?: 'deflate' | 'deflateRaw' | 'gzip';
}

declare class SyncDiskCache {
  constructor(key?: string, options?: SyncDiskCacheOptions);
  tmpdir: any;
  compression: any;
  key: any;
  root: any;
  clear(): void;
  compress(value: string): string;
  decompress(value: string): string;
  get(key: string): CacheHit | CacheMiss;
  has(key: string): boolean;
  pathFor(key: string): string;
  remove(key: string): void;
  set(key: string, value: string): string;
}
