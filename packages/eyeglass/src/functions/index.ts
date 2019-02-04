import assetURI from "./asset-uri";
import normalizeURL from "./normalize-uri";
import version from "./version";
import fs from "./fs";
import { EyeglassFunctions } from "./EyeglassFunctions";
import { FunctionDeclarations } from "../util/SassImplementation";

const allEyeglassFunctions: EyeglassFunctions = function(eyeglass, sass): FunctionDeclarations {
  return Object.assign({},
    assetURI(eyeglass, sass),
    normalizeURL(eyeglass, sass),
    version(eyeglass, sass),
    fs(eyeglass, sass)
  );
};
export default allEyeglassFunctions;
