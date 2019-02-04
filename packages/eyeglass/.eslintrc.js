module.exports = {
  
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2017,
    project: "./tsconfig.json",
    sourceType: 'module'
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  rules: {
    "indent": "off",
    "@typescript-eslint/array-type": ["error", "generic"],
    "@typescript-eslint/indent": ["error", 2],
    "@typescript-eslint/restrict-plus-operands": "error",
  },
  env: {
    es6: true,
    node: true,
    mocha: true
  }
};
