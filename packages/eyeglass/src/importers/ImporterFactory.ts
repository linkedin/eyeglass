import { Importer } from "node-sass";
import { IEyeglass } from "../IEyeglass";
import { Config } from "../util/Options";
import { SassImplementation } from "../util/SassImplementation";

export type ImporterFactory = (
  eyeglass: IEyeglass,
  sass: SassImplementation,
  options: Config,
  fallbackImporter?: Importer | Array<Importer> | undefined
) => Importer;