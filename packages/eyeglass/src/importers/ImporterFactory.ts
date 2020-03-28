import type { AsyncImporter } from "node-sass";
import { IEyeglass } from "../IEyeglass";
import { Config } from "../util/Options";
import { SassImplementation } from "../util/SassImplementation";

export interface ImportedFile {
  contents: string;
  file: string;
}
export type ImportContents = { contents: string; file?: string; };
export type ImportReference = { file: string; };
export type ImporterResult = ImportContents | ImportReference | Error | null;

export type ImporterFactory = (
  eyeglass: IEyeglass,
  sass: SassImplementation,
  options: Config,
  fallbackImporter?: AsyncImporter | Array<AsyncImporter> | undefined
) => AsyncImporter;