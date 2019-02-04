import * as path from "path";
import eyeglassFunctions from "./functions";
import { EyeglassModuleMain, EyeglassModuleExports } from "./modules/EyeglassModule";

const eyeglassExports: EyeglassModuleMain = function(eyeglass, sass): EyeglassModuleExports {
  let opts = {
    sassDir: path.join(__dirname, "..", "sass"), // directory where the sass files are.
    functions: eyeglassFunctions(eyeglass, sass)
  };
  return opts;
};
module.exports = eyeglassExports;
