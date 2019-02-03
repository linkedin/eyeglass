import {inspect} from "util";
export function unreachable(argument?: never, argmentName?: string): never {
  if (argmentName) {
    throw new Error(`Unexpected value for ${argmentName}: ${inspect(argument)}`);
  } else {
    throw new Error(`Unreachable code location was reached: ${inspect(argument)}`);
  }
}
