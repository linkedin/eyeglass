module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  plugins: [
    'ember'
  ],
  extends: [
    'eslint:recommended',
    'plugin:ember/recommended'
  ],
  env: {
    browser: true
  },
  rules: {
  },
  overrides: [
    // node files
    {
      files: [
        'ember-cli-build.js',
        'index.js',
        'testem.js',
        'Gruntfile.js',
        'blueprints/*/index.js',
        'config/**/*.js',
        'node-tests/**/*.js',
        'tests/dummy/config/**/*.js',
        'tests/dummy/lib/**/*.js',
      ],
      excludedFiles: [
        'addon/**',
        'addon-test-support/**',
        'app/**',
        'tests/dummy/app/**',
        'tests/dummy/lib/*/addon/**/*.js',
      ],
      parserOptions: {
        sourceType: 'script',
        ecmaVersion: 2015
      },
      env: {
        browser: false,
        node: true
      },
      plugins: ['node'],
      rules: Object.assign({}, require('eslint-plugin-node').configs.recommended.rules, {
        // add your custom rules and overrides for node files here
      })
    },

    // mocha tests
    {
      files: ['node-tests/**'],
      env: {
        mocha: true
      }
    }
  ]
};
