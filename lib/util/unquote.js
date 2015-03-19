"use strict";

var UNQUOTE_RE = /^("|')(.*)\1$/;

module.exports = function(string) {
  if (string.getValue) {
    return string.constructor(string.getValue().replace(UNQUOTE_RE, "$2"));
  } else {
    return string.replace(UNQUOTE_RE, "$2");
  }
};
