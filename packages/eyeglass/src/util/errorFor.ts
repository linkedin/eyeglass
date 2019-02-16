import { unreachable } from "./assertions";

interface HasMessage {
  message: string;
}
function hasMessage(o: unknown): o is HasMessage {
  return typeof o === "object"
      && o !== null
      && typeof (o as HasMessage).message === "string";
}
export function errorMessageFor(err: unknown): string {
  switch(typeof err) {
    case "bigint":
      return err.toString();
    case "boolean":
      return err.toString();
    case "number":
      return err.toString();
    case "string":
      return err.toString();
    case "function":
      return unreachable();
    case "object":
      if (hasMessage(err)) {
        return err.message || "The cause is unknown.";
      } else if (err !== null) {
        // [Object object] unless they've customized the toString behavior.
        return err.toString();
      } else {
        return "The cause is unknown.";
      }
    case "symbol":
      return Symbol.keyFor(err) || "The cause is unknown.";
    case "undefined":
      return "The cause is unknown.";
    default:
      return unreachable();
  }
}

export default function errorFor(err: unknown, messagePrefix?: string): Error | null {
  if (err === null || typeof err === "undefined") return null;
  if (typeof err === "function") {
    try {
      err = err();
    } catch (e) {
      err = e;
    }
  }
  if (err instanceof Error) {
    if (messagePrefix) {
      err.message = `${messagePrefix}: ${err.message}`;
    }
    return err;
  }
  let message = errorMessageFor(err);
  return new Error(messagePrefix ? `${messagePrefix}: ${message}` : message);
}