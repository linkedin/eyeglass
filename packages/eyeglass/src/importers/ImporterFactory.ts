import { AsyncImporter } from "node-sass";
import { IEyeglass } from "../IEyeglass";
import { Config } from "../util/Options";
import { SassImplementation } from "../util/SassImplementation";

export interface ImportedFile {
  contents: string;
  file: string;
}

export type ImporterFactory = (
  eyeglass: IEyeglass,
  sass: SassImplementation,
  options: Config,
  fallbackImporter?: AsyncImporter | Array<AsyncImporter> | undefined
) => AsyncImporter;