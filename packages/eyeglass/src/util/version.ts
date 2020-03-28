// eslint-disable-next-line @typescript-eslint/no-var-requires
import {AbbreviatedVersion} from "package-json";
import { SemVer } from "semver";
const pkg: AbbreviatedVersion = require("../../package.json");

export default {
  string: pkg.version,
  semver: new SemVer(pkg.version!),
};
