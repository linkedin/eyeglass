import { IEyeglass } from "../IEyeglass";
import { SassImplementation, FunctionDeclarations } from "../util/SassImplementation";

export type EyeglassFunctions =
  (eyeglass: IEyeglass, sass: SassImplementation) => FunctionDeclarations;