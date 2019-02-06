export interface Dict<T> {
  [key: string]: T;
}

export function isPresent<T>(v: T): v is Exclude<T, undefined | null> {
  return typeof v !== "undefined" && v !== null
}
