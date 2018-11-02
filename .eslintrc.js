"use strict";

module.exports = {
  parserOptions: {
    ecmaVersion: 2017,
  },
  plugins: ["prettier"],
  extends: ["eslint:recommended", "plugin:node/recommended", "prettier"],
  env: {
    node: true,
    es6: true,
  },
  rules: {
    "prettier/prettier": "error",
    "no-console": "off",
  },
  overrides: [
    {
      files: ["test/**/*.js"],
      env: {
        mocha: true,
      },
    },
  ],
};
