// Type definitions for Node Sass v3.10.1
// Project: https://github.com/sass/node-sass
// Definitions by: Asana <https://asana.com>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node" />

export type ImporterReturnType = { file: string } | { file?: string; contents: string } | Error | null;

export type AsyncImporter = (this: AsyncContext, url: string, prev: string, done: (data: ImporterReturnType) => void) => void;
export type SyncImporter = (this: SyncContext, url: string, prev: string) => ImporterReturnType;
export type Importer = AsyncImporter | SyncImporter;
export interface AsyncContext {
  options: Options;
  callback: SassRenderCallback;
  [data: string]: any;
}
export interface SyncContext {
  options: Options;
  callback: undefined;
  [data: string]: any;
}

export interface Options {
  file?: string;
  data?: string;
  importer?: Importer | Array<Importer>;
  functions?: FunctionDeclarations;
  includePaths?: Array<string>;
  indentedSyntax?: boolean;
  indentType?: string;
  indentWidth?: number;
  linefeed?: string;
  omitSourceMapUrl?: boolean;
  outFile?: string;
  outputStyle?: "compact" | "compressed" | "expanded" | "nested";
  precision?: number;
  sourceComments?: boolean;
  sourceMap?: boolean | string;
  sourceMapContents?: boolean;
  sourceMapEmbed?: boolean;
  sourceMapRoot?: string;
  [key: string]: any;
}

export interface SassError extends Error {
  message: string;
  line: number;
  column: number;
  status: number;
  file: string;
}

export interface Result {
  css: Buffer;
  map: Buffer;
  stats: {
    entry: string;
    start: number;
    end: number;
    duration: number;
    includedFiles: Array<string>;
  };
}
export namespace types {
  /* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-empty-interface */
  /**
   * Values that are received from Sass as an argument to a javascript function.
   */
  export type Value = Null | Number | String | Color | Boolean | List | Map;
  /**
   * Values that are legal to return to Sass from a javascript function.
   */
  export type ReturnValue = Value | Error;

  export interface Null {}

  interface NullConstructor {
    new (): Null;
    (): Null;
    NULL: Null;
  }
  export const Null: NullConstructor;

  export interface Number {
    getValue(): number;
    setValue(n: number): void;
    getUnit(): string;
    setUnit(u: string): void;
  }
  /**
   * Constructs a new Sass number. Does not require use of the `new` keyword.
   */
  export function Number(value: number, unit?: string): Number;

  export interface String {
    getValue(): string;
    setValue(s: string): void;
  }

  /**
   * Constructs a new Sass string. Does not require use of the `new` keyword.
   */
  export function String(value: string): String;

  export interface Color {
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
  export function Color(hexN: number): Color;

  /**
   * Constructs a new Sass color given the RGBA component values. Do not invoke with the `new` keyword.
   * 
   * @param r integer 0-255 inclusive
   * @param g integer 0-255 inclusive
   * @param b integer 0-255 inclusive
   * @param [a] float 0 - 1 inclusive
   * @returns a SassColor instance.
   */
  export function Color(r: number, g: number, b: number, a?: number): Color;

  export interface Boolean {
    getValue(): boolean;
  }

  interface BooleanConstructor {
    new (bool: boolean): Boolean;
    (bool: boolean): Boolean;
    TRUE: Boolean;
    FALSE: Boolean;
  }

  export const Boolean: BooleanConstructor;

  export interface Enumerable {
    getValue(index: number): Value;
    setValue(index: number, value: Value): void;
    getLength(): number;
  }
  export interface List extends Enumerable {
    getSeparator(): boolean;
    setSeparator(isComma: boolean): void;
  }
  export function List(length: number, commaSeparator?: boolean): List;

  export interface Map extends Enumerable {
    getKey(index: number): string;
    setKey(index: number, key: string): void;
  }
  export function Map(length: number): Map;

  export interface Error {
    // why isn't there a getMessage() method?
  }
  export function Error(message: string): Error;

  /* eslint-enable @typescript-eslint/ban-types, @typescript-eslint/no-empty-interface */
}
export const NULL: types.Null;
export const TRUE: types.Boolean;
export const FALSE: types.Boolean;
export const info: string;
export type SassRenderCallback = (err: SassError, result: Result) => unknown;
export declare function render(options: Options, callback: SassRenderCallback): void;
export declare function renderSync(options: Options): Result;

export type SyncSassFunction = (this: SyncContext, ...$args: Array<types.Value>) => types.ReturnValue;

export type SassFunctionCallback = ($result: types.ReturnValue) => void;
export type SassFunction0 = (this: AsyncContext, cb: SassFunctionCallback) => void;
export type SassFunction1 = (this: AsyncContext, $arg1: types.Value, cb: SassFunctionCallback) => void;
export type SassFunction2 = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, cb: SassFunctionCallback) => void;
export type SassFunction3 = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, $arg3: types.Value, cb: SassFunctionCallback) => void;
export type SassFunction4 = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, $arg3: types.Value, $arg4: types.Value, cb: SassFunctionCallback) => void;
export type SassFunction5 = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, $arg3: types.Value, $arg4: types.Value, $arg5: types.Value, cb: SassFunctionCallback) => void;
export type SassFunction6 = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, $arg3: types.Value, $arg4: types.Value, $arg5: types.Value, $arg6: types.Value, cb: SassFunctionCallback) => void;

export type SassFunction1Var = (this: AsyncContext, $arg1: Array<types.Value>, cb: SassFunctionCallback) => void;
export type SassFunction2Var = (this: AsyncContext, $arg1: types.Value, $arg2: Array<types.Value>, cb: SassFunctionCallback) => void;
export type SassFunction3Var = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, $arg3: Array<types.Value>, cb: SassFunctionCallback) => void;
export type SassFunction4Var = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, $arg3: types.Value, $arg4: Array<types.Value>, cb: SassFunctionCallback) => void;
export type SassFunction5Var = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, $arg3: types.Value, $arg4: types.Value, $arg5: Array<types.Value>, cb: SassFunctionCallback) => void;
export type SassFunction6Var = (this: AsyncContext, $arg1: types.Value, $arg2: types.Value, $arg3: types.Value, $arg4: types.Value, $arg5: types.Value, $arg6: Array<types.Value>, cb: SassFunctionCallback) => void;

export type SassFunction =
  SyncSassFunction
  | SassFunction0 | SassFunction1 | SassFunction2 | SassFunction3 | SassFunction4 | SassFunction5 | SassFunction6
  | SassFunction1Var | SassFunction2Var | SassFunction3Var | SassFunction4Var | SassFunction5Var | SassFunction6Var;

export type FunctionDeclarations = Record<string, SassFunction>;
