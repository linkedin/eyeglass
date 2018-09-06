"use strict";

import * as merge from "lodash.merge";

import assetURI from "./asset-uri";
import normalizeURL from "./normalize-uri";
import version from "./version";
import fs from "./fs";

export default function(eyeglass, sass) {
  let all = assetURI(eyeglass, sass);
  all = merge(all, normalizeURL(eyeglass, sass));
  all = merge(all, version(eyeglass, sass));
  all = merge(all, fs(eyeglass, sass));
  return all;
};
