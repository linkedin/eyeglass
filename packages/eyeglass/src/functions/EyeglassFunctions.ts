import { IEyeglass } from "../IEyeglass";
import { SassImplementation } from "../util/SassImplementation";
import type { FunctionDeclarations } from "node-sass";

export type EyeglassFunctions =
  (eyeglass: IEyeglass, sass: SassImplementation) => FunctionDeclarations;