import assetURI from "./asset-uri";
import normalizeURL from "./normalize-uri";
import version from "./version";
import fs from "./fs";
import { EyeglassFunctions } from "./EyeglassFunctions";

export default function(eyeglass, sass): EyeglassFunctions {
  return Object.assign({},
    assetURI(eyeglass, sass),
    normalizeURL(eyeglass, sass),
    version(eyeglass, sass),
    fs(eyeglass, sass)
  );
};
