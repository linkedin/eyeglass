// Type definitions for Node Sass v3.10.1
// Project: https://github.com/sass/node-sass
// Definitions by: Asana <https://asana.com>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node" />

type ImporterReturnType = { file: string } | { file?: string; contents: string } | Error | null;

type AsyncImporter = (this: AsyncContext, url: string, prev: string, done: (data: ImporterReturnType) => void) => void;
type SyncImporter = (this: SyncContext, url: string, prev: string) => ImporterReturnType;
type Importer = AsyncImporter | SyncImporter;
interface SyncContext {
  options: Options;
  callback: undefined;
  [data: string]: unknown;
}
interface AsyncContext {
  options: Options;
  callback: (data: ImporterReturnType) => void;
  [data: string]: unknown;
}
interface Options {
  file?: string;
  data?: string;
  importer?: Importer | Array<Importer>;
  functions?: { [key: string]: Function };
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
}

interface SassError extends Error {
  message: string;
  line: number;
  column: number;
  status: number;
  file: string;
}

interface Result {
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

export declare function render(options: Options, callback: (err: SassError, result: Result) => unknown): void;
export declare function renderSync(options: Options): Result;
