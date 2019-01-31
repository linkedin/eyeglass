import { render, renderSync, SassError } from "node-sass";
import { types } from "util";
export { Options } from "node-sass";

type SassValue = SassNull | SassNumber | SassString | SassColor | SassBoolean | SassList | SassMap;

interface SassNumber {
  getValue(): number;
  setValue(n: number): void;
  getUnit(): string;
  setUnit(u: string): void;
}
interface SassString {
  getValue(): string;
  setValue(s: string): void;
}
interface SassColor {
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
interface SassBoolean {
  getValue(): boolean;
}
interface SassBooleanFactory {
  (bool: boolean): SassBoolean;
  TRUE: SassBoolean;
  FALSE: SassBoolean;
}
interface SassNull {
}
interface SassNullFactory {
  (): SassNull;
  NULL: SassNull;
}
interface SassEnumerable {
  getValue(index): SassValue;
  setValue(index, value: SassValue): void;
  getLength(): number;
}
interface SassList extends SassEnumerable {
  getSeparator(): boolean
  setSeparator(isComma: boolean): void;
}
interface SassMap extends SassEnumerable {
  getKey(index): string;
  setKey(index, key: string): void;
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

  Error: SassError;
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
