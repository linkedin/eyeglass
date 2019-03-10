interface Stats {
  [k: string]: number;
}
interface StatsSchema<T> {
  new (): T;
}
export class Cookie<StatsType = Stats> {
  readonly stats: StatsType;
  stop(): void;
  resume(): void;
}
export function start<
  Schema extends object = Stats
>(name: string, Schema?: StatsSchema<Schema>): Cookie<Schema>;

export function node<Return, Context = undefined>(
  name: string,
  callback: (this: Context, stats: Stats) => Return | Promise<Return>,
  context?: Context
): Promise<Return>;
export function node<Return, Schema extends object, Context = undefined>(
  name: string,
  schema: StatsSchema<Schema>,
  callback: (this: Context, stats: Schema) => Return | Promise<Return>,
  context?: Context
): Promise<Return>;

export function hasMonitor(name: string): boolean;
export function registerMonitor(name: string, Schema: {new (): any}): void;
export function statsFor<Schema = Stats>(name: string): Schema;