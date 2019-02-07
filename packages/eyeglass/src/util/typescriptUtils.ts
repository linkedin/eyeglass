export interface Dict<T> {
  [key: string]: T | undefined;
}

export interface UnsafeDict<T> {
  [key: string]: T;
}

export function isPresent<T>(v: T | undefined | null): v is T {
  return typeof v !== "undefined" && v !== null
}
