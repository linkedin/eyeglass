export function unreachable(): never {
  throw new Error("Unreachable code location was reached.")
}
