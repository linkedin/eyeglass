"use strict";

var rUnquote = /^("|')(.*)\1$/;
var rPlaceholders = /\${([^\}]+)}/g;

function isSassValue(item) {
  return !!(item && item.getValue && item.constructor);
}

export function unquote(string) {
  if (isSassValue(string)) {
    return string.constructor(unquote(string.getValue()));
  }
  return string.replace(rUnquote, "$2");
}

export function quote(string) {
  if (isSassValue(string)) {
    return string.constructor(quote(string.getValue()));
  }
  return typeof string === "string" ? '"' + unquote(string) + '"' : string;
}

export function tmpl(templateString: string, data: object) {
  return templateString.replace(rPlaceholders, function(match, key) {
    return data.hasOwnProperty(key) ? data[key] : match;
  });
}
