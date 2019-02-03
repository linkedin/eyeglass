import { render, renderSync, SassError } from "node-sass";
import { types } from "util";
import { unreachable } from "./assertions";
export { Options } from "node-sass";

export type SyncSassFunction = (...$args: Array<SassValue>) => SassValue | SassError;
export type SassFunctionCallback = ($result: SassValue | SassError) => void;
export type SassFunction0 = (cb: SassFunctionCallback) => void;
export type SassFunction1 = ($arg1: SassValue, cb: SassFunctionCallback) => void;
export type SassFunction2 = ($arg1: SassValue, $arg2: SassValue, cb: SassFunctionCallback) => void;
export type SassFunction3 = ($arg1: SassValue, $arg2: SassValue, $arg3: SassValue, cb: SassFunctionCallback) => void;
export type SassFunction4 = ($arg1: SassValue, $arg2: SassValue, $arg3: SassValue, $arg4: SassValue, cb: SassFunctionCallback) => void;
export type SassFunction5 = ($arg1: SassValue, $arg2: SassValue, $arg3: SassValue, $arg4: SassValue, $arg5: SassValue, cb: SassFunctionCallback) => void;
export type SassFunction6 = ($arg1: SassValue, $arg2: SassValue, $arg3: SassValue, $arg4: SassValue, $arg5: SassValue, $arg6: SassValue, cb: SassFunctionCallback) => void;
export type SassFunction = SyncSassFunction | SassFunction0 | SassFunction1 | SassFunction2 | SassFunction3 | SassFunction4 | SassFunction5 | SassFunction6;

export type SassValue = SassNull | SassNumber | SassString | SassColor | SassBoolean | SassList | SassMap;
export function isSassValue(sass: SassImplementation, value: any): value is SassValue {
  if (value && typeof value === "object") {
    return isSassNull(sass, value)
        || isSassNumber(sass, value)
        || isSassString(sass, value)
        || isSassColor(sass, value)
        || isSassBoolean(sass, value)
        || isSassList(sass, value)
        || isSassMap(sass, value);
  } else {
    return false;
  }
}

export function toString(sass: SassImplementation, value: SassValue): string {
  if (isSassNumber(sass, value)) {
    return `${value.getValue()}${value.getUnit()}`
  } else if (isSassString(sass, value)) {
    return value.getValue();
  } else if (isSassColor(sass, value)) {
    return `rgba(${value.getR()}, ${value.getG()}, ${value.getB()}, ${value.getA()})`
  } else if (isSassBoolean(sass, value)) {
    if (value === sass.TRUE) {
      return `true`;
    } else {
      return `false`;
    }
  } else if (isSassList(sass, value)) {
    let s = "(";
    for (let i = 0; i < value.getLength(); i++) {
      if (i > 0) {
        if (value.getSeparator()) {
          s += ", ";
        } else {
          s += " ";
        }
      }
      s += toString(sass, value.getValue(i));
    }
    s += ")";
    return s;
  } else if (isSassMap(sass, value)) {
    let s = "(";
    for (let i = 0; i < value.getLength(); i++) {
      if (i > 0) {
        s += ", ";
      }
      s += toString(sass, value.getKey(i));
      s += ": ";
      s += toString(sass, value.getValue(i));
    }
    s += ")";
    return s;
  } else if (isSassNull(sass, value)) {
    return "";
  } else {
    unreachable();
  }
}

export interface SassNumber {
  getValue(): number;
  setValue(n: number): void;
  getUnit(): string;
  setUnit(u: string): void;
}
export function isSassNumber(sass: SassImplementation, value: unknown): value is SassNumber {
  return typeof value === "object" && value.constructor === sass.types.Number;
}
export interface SassString {
  getValue(): string;
  setValue(s: string): void;
}
export function isSassString(sass: SassImplementation, value: unknown): value is SassString {
  return typeof value === "object" && value.constructor === sass.types.String;
}
export interface SassColor {
  /**
   * Get the red component of the color.
   * @returns integer between 0 and 255 inclusive;
   */
  getR(): number;
  /**
   * Set the red component of the color.
   * @returns integer between 0 and 255 inclusive;
   */
  setR(r: number): void;
  /**
   * Get the green component of the color.
   * @returns integer between 0 and 255 inclusive;
   */
  getG(): number;
  /**
   * Set the green component of the color.
   * @param g integer between 0 and 255 inclusive;
   */
  setG(g: number): void;
  /**
   * Get the blue component of the color.
   * @returns integer between 0 and 255 inclusive;
   */
  getB(): number;
  /**
   * Set the blue component of the color.
   * @param b integer between 0 and 255 inclusive;
   */
  setB(b: number): void;
  /**
   * Get the alpha transparency component of the color.
   * @returns number between 0 and 1 inclusive;
   */
  getA(): number;
  /**
   * Set the alpha component of the color.
   * @param a number between 0 and 1 inclusive;
   */
  setA(a: number): void;
}
export function isSassColor(sass: SassImplementation, value: unknown): value is SassColor {
  return typeof value === "object" && value.constructor === sass.types.Color;
}
export interface SassBoolean {
  getValue(): boolean;
}
export function isSassBoolean(sass: SassImplementation, value: unknown): value is SassBoolean {
  return typeof value === "object" && value.constructor === sass.types.Boolean;
}
interface SassBooleanFactory {
  (bool: boolean): SassBoolean;
  TRUE: SassBoolean;
  FALSE: SassBoolean;
}
export interface SassNull {
}
export function isSassNull(sass: SassImplementation, value: unknown): value is SassNull {
  return typeof value === "object" && value.constructor === sass.types.Null;
}
interface SassNullFactory {
  (): SassNull;
  NULL: SassNull;
}
export interface SassEnumerable {
  getValue(index): SassValue;
  setValue(index, value: SassValue): void;
  getLength(): number;
}
export interface SassList extends SassEnumerable {
  getSeparator(): boolean
  setSeparator(isComma: boolean): void;
}
export function isSassList(sass: SassImplementation, value: unknown): value is SassList {
  return typeof value === "object" && value.constructor === sass.types.List;
}
export interface SassMap extends SassEnumerable {
  getKey(index): string;
  setKey(index, key: string): void;
}
export function isSassMap(sass: SassImplementation, value: unknown): value is SassMap {
  return typeof value === "object" && value.constructor === sass.types.Map;
}

export function isSassMapOrEmptyList(sass: SassImplementation, value: unknown): value is SassMap | SassList {
  return typeof value === "object"
         && (
           value.constructor === sass.types.Map 
           || (isSassList(sass, value) && value.getLength() === 0));
}
interface SassTypes {
  /**
   * Constructs a new Sass number. Do not invoke with the `new` keyword.
   */
  Number(value: number, unit?: string): SassNumber;

  /**
   * Constructs a new Sass string. Do not invoke with the `new` keyword.
   */
  String(value: string): SassString;
  /**
   * Constructs a new Sass color given a 4 byte number. Do not invoke with the `new` keyword.
   *
   * If a single number is passed it is assumed to be a number that contains
   * all the components which are extracted using bitmasks and bitshifting.
   * 
   * @param hexN A number that is usually written in hexadecimal form. E.g. 0xff0088cc.
   * @returns a Sass Color instance.
   * @example
   *   // Comparison with byte array manipulation
   *   let a = new ArrayBuffer(4);
   *   let hexN = 0xCCFF0088; // 0xAARRGGBB
   *   let a32 = new Uint32Array(a); // Uint32Array [ 0 ]
   *   a32[0] = hexN;
   *   let a8 = new Uint8Array(a); // Uint8Array [ 136, 0, 255, 204 ]
   *   let componentBytes = [a8[2], a8[1], a8[0], a8[3] / 255] // [ 136, 0, 255, 0.8 ]
   *   let c = sass.types.Color(hexN);
   *   let components = [c.getR(), c.getG(), c.getR(), c.getA()] // [ 136, 0, 255, 0.8 ]
   *   assert.deepEqual(componentBytes, components); // does not raise.
   */
  Color(hexN: number): SassColor;
  /**
   * Constructs a new Sass color given the RGBA component values. Do not invoke with the `new` keyword.
   * 
   * @param r integer 0-255 inclusive
   * @param g integer 0-255 inclusive
   * @param b integer 0-255 inclusive
   * @param [a] float 0 - 1 inclusive
   * @returns a SassColor instance.
   */
  Color(r: number, g: number, b: number, a?: number): SassColor;

  /**
   * Returns one of the Sass Boolean singletons Boolean.TRUE or Boolean.FALSE
   * depending on the value of the argument.
   */
  Boolean: SassBooleanFactory;

  /**
   * Returns the Sass Null singleton Null.NULL.
   */
  Null: SassNullFactory;

  List(length, commaSeparator: boolean): SassList;

  Map(length): SassMap;

  Error(message): SassError;
}

export function isSassError(sass: SassImplementation, value: unknown): value is SassError {
  return typeof value === "object" && value instanceof sass.types.Number;
}

export interface SassImplementation {
  /** Async rendering of a Sass File. */
  render: typeof render;
  /** Synchronous rendering of a Sass File. */
  renderSync: typeof renderSync
  /** Constructors for Sass values. */
  types: SassTypes;
  /** Metadata about the Sass Implementation. */
  info: string;
  /** Singleton value. Also accessible as types.Boolean.TRUE */
  TRUE: SassBoolean;
  /** Singleton value. Also accessible as types.Boolean.FALSE */
  FALSE: SassBoolean;
  /** Singleton value. Also accessible as types.Null.NULL */
  NULL: SassNull;
}

export function isSassImplementation(impl: any): impl is SassImplementation {
  return (
    impl && typeof impl === "object"
    && typeof impl.render === "function"
    && typeof impl.renderSync === "function"
    && typeof impl.types === "object"
    && typeof impl.info === "string"
  );
}

const typeGuards = {
  null: isSassNull,
  string: isSassString,
  number: isSassNumber,
  map: isSassMapOrEmptyList,
  list: isSassList,
  color: isSassColor,
  boolean: isSassBoolean,
  error: isSassError,
};

interface SassType {
  null: SassNull,
  string: SassString,
  number: SassNumber,
  map: SassMap | SassList,
  list: SassList,
  color: SassColor,
  boolean: SassBoolean,
  error: SassError,
}

type SassTypeName = keyof typeof typeGuards;

function typeName(sass: SassImplementation, value: SassValue | SassError): SassTypeName {
  if (isSassString(sass, value)) return "string";
  if (isSassNumber(sass, value)) return "number";
  if (isSassMap(sass, value)) return "map";
  if (isSassList(sass, value)) return "list";
  if (isSassColor(sass, value)) return "color";
  if (isSassBoolean(sass, value)) return "boolean";
  if (isSassError(sass, value)) return "error";
  if (isSassNull(sass, value)) return "null";
}

export function isType<Name extends SassTypeName>(sass: SassImplementation, value: SassValue, name: Name): value is SassType[Name] {
  let guard = typeGuards[name];
  if (guard(sass, value)) {
    return true;
  } else {
    return false;
  }
}

export function typeError(sass: SassImplementation, expected: SassTypeName, actual: SassTypeName | SassValue): SassError {
  return sass.types.Error(`Expected ${expected}, got ${typeof actual === "string" ? actual : typeName(sass, actual)}${typeof actual === "string" ? "" : `: ${toString(sass, actual)}`}`);
}

export class SassTypeError extends Error {
  constructor(sass: SassImplementation, expected: SassTypeName, actual: SassTypeName | SassValue) {
    super(`Expected ${expected}, got ${typeof actual === "string" ? actual : typeName(sass, actual)}${typeof actual === "string" ? "" : `: ${toString(sass, actual)}`}`);
  }
}
