import assetURI from "./asset-uri";
import normalizeURL from "./normalize-uri";
import version from "./version";
import fs from "./fs";
import { EyeglassFunctions } from "./EyeglassFunctions";

const allFunctions: EyeglassFunctions =
function(eyeglass, sass) {
  return Object.assign({},
    assetURI(eyeglass, sass),
    normalizeURL(eyeglass, sass),
    version(eyeglass, sass),
    fs(eyeglass, sass)
  );
};
export default allFunctions;