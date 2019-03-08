interface Stats {
  [k: string]: number;
}
interface StatsSchema<T> {
  new (): T;
}
export class Cookie {
  readonly stats: Stats;
  stop(): void;
  resume(): void;
}
export function start(name: string): Cookie;
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