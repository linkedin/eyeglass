export = SyncDiskCache;
declare class SyncDiskCache {
  constructor(key: any, _?: any);
  tmpdir: any;
  compression: any;
  key: any;
  root: any;
  clear(...args: any[]): any;
  compress(...args: any[]): any;
  decompress(...args: any[]): any;
  get(...args: any[]): any;
  has(...args: any[]): any;
  pathFor(...args: any[]): any;
  remove(...args: any[]): any;
  set(...args: any[]): any;
}
