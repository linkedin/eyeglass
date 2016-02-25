"use strict";

var rUnquote = /^("|')(.*)\1$/;
var rPlaceholders = /\${([^\}]+)}/g;

function isSassValue(item) {
  return !!(item && item.getValue && item.constructor);
}

function unquote(string) {
  if (isSassValue(string)) {
    return string.constructor(unquote(string.getValue()));
  }
  return string.replace(rUnquote, "$2");
}

function quote(string) {
  if (isSassValue(string)) {
    return string.constructor(quote(string.getValue()));
  }
  return typeof string === "string" ? '"' + unquote(string) + '"' : string;
}

function template(tmpl, data) {
  return tmpl.replace(rPlaceholders, function(match, key) {
    return data.hasOwnProperty(key) ? data[key] : match;
  });
}

module.exports = {
  quote: quote,
  unquote: unquote,
  tmpl: template
};
