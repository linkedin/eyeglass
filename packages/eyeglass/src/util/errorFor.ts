import { unreachable } from "./assertions";

interface HasMessage {
  message: string;
}
function hasMessage(o: unknown): o is HasMessage {
  return typeof o === "object"
      && o !== null
      && typeof (o as HasMessage).message === "string";
}
function errorMessageFor(err: unknown): string {
  switch(typeof err) {
    case "bigint":
    case "boolean":
    case "number":
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
      Symbol.keyFor(err) || "The cause is unknown.";
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
    return err;
  }
  let message = errorMessageFor(err);
  return new Error(messagePrefix ? `${messagePrefix}: ${message}` : message);
}