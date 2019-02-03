import { IEyeglass } from "../IEyeglass";
import { SassImplementation, SassFunction } from "../util/SassImplementation";

export type EyeglassFunctions = (eyeglass: IEyeglass, sass: SassImplementation) => {
  [functionDeclaration: string]: SassFunction;
}