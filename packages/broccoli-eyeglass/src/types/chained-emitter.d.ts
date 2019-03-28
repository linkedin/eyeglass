export class EventEmitter {
  constructor(conf?: any);
  newListener: any;
  addListener(type: any, listener: any): any;
  emit(...args: any[]): Promise<any>;
  listeners(type: any): any;
  listenersAny(): any;
  many(event: any, ttl: any, fn: any): any;
  off(type: any, listener: any): any;
  offAny(fn: any): any;
  on(type: any, listener: any): any;
  onAny(fn: any): any;
  once(event: any, fn: any): any;
  removeAllListeners(type: any, ...args: any[]): any;
  removeListener(type: any, listener: any): any;
  setMaxListeners(n: any): void;
}
