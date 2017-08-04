"use strict";

module.exports = {
  "env": {
    "node": true,
    "mocha": true,
    "es6": true
  },
  "rules": {
    "block-scoped-var": 2,
    "brace-style": [2, "1tbs"],
    "camelcase": 1,
    "curly": 2,
    "eol-last": 2,
    "eqeqeq": [2, "smart"],
    "max-depth": [1, 3],
    "max-len": [1, 100],
    "new-cap": [1, {
      "capIsNewExceptions": ["Number", "Boolean", "String", "Color", "Null", "List", "Map", "Error"]
    }],
    "no-extend-native": 2,
    "no-mixed-spaces-and-tabs": 2,
    "no-trailing-spaces": 2,
    "no-use-before-define": [2, "nofunc"],
    "no-unused-vars": [1, {
      "vars": "all",
      "args": "none"
    }],
    "quotes": [2, "double", "avoid-escape"],
    "semi": [2, "always"],
    "keyword-spacing": [2, {"before": true, "after": true}],
    "object-curly-spacing": [2, "never"],
    "computed-property-spacing": [2, "never"],
    "array-bracket-spacing": [2, "never"]
  }
};