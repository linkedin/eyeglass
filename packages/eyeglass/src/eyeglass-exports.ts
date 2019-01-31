// TODO: Annotate Types
import * as path from "path";
import eyeglassFunctions from "./functions";

module.exports = function(eyeglass, sass) {
  var opts = {
    sassDir: path.join(__dirname, "..", "sass"), // directory where the sass files are.
    functions: eyeglassFunctions(eyeglass, sass)
  };
  return opts;
};
