import { URI } from  "../util/URI";
import { IEyeglass } from "../IEyeglass";
import { SassImplementation, isSassString, typeError } from "../util/SassImplementation";
import { SassFunctionCallback, FunctionDeclarations } from "node-sass";
import * as nodeSass from "node-sass";
const IS_WINDOWS = /win32/.test(require("os").platform());

const normalizeURI = function(_eyeglass: IEyeglass, sass: SassImplementation): FunctionDeclarations {
  let methods: FunctionDeclarations = {
    "eyeglass-uri-preserve($uri)": function($uri: nodeSass.types.Value, done: SassFunctionCallback) {
      if (!isSassString(sass, $uri)) {
        return done(typeError(sass, "string", $uri));
      }
      let uri = $uri.getValue();
      // decorate the uri
      uri = URI.preserve(uri);
      done(sass.types.String(uri));
    },
    "eyeglass-uri-restore($uri)": function($uri: nodeSass.types.Value, done: SassFunctionCallback) {
      if (!isSassString(sass, $uri)) {
        return done(typeError(sass, "string", $uri));
      }
      let uri = $uri.getValue();
      // restore the uri
      uri = URI.restore(uri);
      done(sass.types.String(uri));
    }
  };

  if (IS_WINDOWS || process.env.EYEGLASS_NORMALIZE_PATHS) {
    methods["-eyeglass-normalize-uri($uri, $type: web)"] = function($uri: nodeSass.types.Value, $type: nodeSass.types.Value, done: SassFunctionCallback) {
      if (!isSassString(sass, $type)) {
        return done(typeError(sass, "string", $type));
      }
      if (!isSassString(sass, $uri)) {
        return done(typeError(sass, "string", $uri));
      }
      let type = $type.getValue() as "web" | "system" | "preserve" | "restore";
      let uri = $uri.getValue();
      // normalize the uri for the given type
      uri = URI[type](uri);
      done(sass.types.String(uri));
    };
  }

  return methods;
};

export default normalizeURI;