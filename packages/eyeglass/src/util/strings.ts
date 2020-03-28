import { SassImplementation, isSassString, inspect as inspectSass } from "./SassImplementation";
import type * as sass from "node-sass";
import { inspect } from "util";
import { Dict } from "./typescriptUtils";

let rUnquote = /^("|')(.*)\1$/;
let rPlaceholders = /\${([^}]+)}/g;

export function unquote(sass: SassImplementation, string: string | sass.types.Value): sass.types.String {
  if (typeof string === "string") {
    return sass.types.String(string.replace(rUnquote, "$2"));
  }
  if (!isSassString(sass, string)) {
    throw new Error(`Expected: Sass String. Got: ${inspect(string)}`)
  }
  if (rUnquote.test(string.getValue())) {
    return sass.types.String(RegExp.$2);
  } else {
    return string;
  }
}

export function unquoteJS(sass: SassImplementation, string: string | sass.types.Value): string {
  if (typeof string === "string") {
    return string.replace(rUnquote, "$2");
  }
  if (!isSassString(sass, string)) {
    throw new Error(`Expected: Sass String. Got: ${inspect(string)}`)
  }
  if (rUnquote.test(string.getValue())) {
    return RegExp.$2;
  } else {
    return string.getValue();
  }
}

export function quoteSass(sass: SassImplementation, string: string | sass.types.Value): sass.types.String;
export function quoteSass(sass: SassImplementation, string: undefined): undefined;
export function quoteSass(sass: SassImplementation, string: string | sass.types.Value | undefined): sass.types.String | undefined {
  if (typeof string === "string") {
    if (rUnquote.test(string)) {
      return sass.types.String(string);
    } else {
      return sass.types.String(`"${string}"`);
    }
  }
  if (typeof string === "undefined") {
    return undefined;
  }
  if (!isSassString(sass, string)) {
    throw new Error(`Expected: Sass String. Got: ${inspect(string)}`)
  }
  if (rUnquote.test(string.getValue())) {
    return string;
  } else {
    return sass.types.String(`"${string.getValue()}"`);
  }
}

export function quoteJS(sass: SassImplementation, string: string | sass.types.Value): string;
export function quoteJS(sass: SassImplementation, string: undefined): undefined;
export function quoteJS(sass: SassImplementation, string: string | undefined): string | undefined;
export function quoteJS(sass: SassImplementation, string: string | sass.types.Value | undefined): string | undefined {
  if (typeof string === "string") {
    if (rUnquote.test(string)) {
      return string;
    } else {
      return `"${string}"`;
    }
  }
  if (typeof string === "undefined") {
    return undefined;
  }
  if (!isSassString(sass, string)) {
    throw new Error(`Expected: Sass String. Got: ${inspect(string)}`)
  }
  if (rUnquote.test(string.getValue())) {
    return string.getValue();
  } else {
    return `"${string.getValue()}"`;
  }
}

export function tmpl(sass: SassImplementation, templateString: string, data: Dict<string | sass.types.Value>): string {
  return templateString.replace(rPlaceholders, (match, key: string) => {
    if (data.hasOwnProperty(key)) {
      let v = data[key];
      if (typeof v === "string") {
        return v;
      } else {
        return inspectSass(sass, v!);
      }
    } else {
      return match;
    }
  });
}
