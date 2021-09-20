# `ember-cli-eyeglass` [![Build Status](https://travis-ci.org/sass-eyeglass/ember-cli-eyeglass.svg?branch=master)](https://travis-ci.org/sass-eyeglass/ember-cli-eyeglass)<Paste>

This Ember CLI Addon makes it trivial to compile your sass files with
eyeglass support via node-sass.

## Installation

`yarn add ember-cli-eyeglass`

Then rename all your `.css` files so they have the `.scss` extension.

## Configuration

In your application's ember-cli-build.js the key `"eyeglass"` can be
set to an options object that will be passed to broccoli-eyeglass. For
details on the options available, please read the [broccoli-eyeglass
options documentation](https://github.com/linkedin/eyeglass/tree/master/packages/broccoli-eyeglass#options).

### Apps

```js
// path/to/app/ember-cli-build.js
const app = new EmberApp(defaults, {
  eyeglass: {
    /* Enable discovery of Sass files to compile.
       All files not beginning with an underscore will be compiled. */
    discover: true,
     /* apply other broccoli-eyeglass options here */
     /* apply node-sass options here */
    eyeglass: {
      /* eyeglass options */
    }
  }
});
```

Given the following layout:

```
app/styles/app.scss
           other.scss
           _shared.scss
```


Will result in:

`assets/<app-name>.css` containing the compiled output of `app/styles/app.scss`
`assets/foo.css` containing the compiled output of `app/styles/foo.scss`

The contents of `app/styles/_shared.scss` will not be compiled directly but will be available for import. For example, `app.scss` can have `@import "shared";` to include the contents of that file in its output.
(Note: files beginning with an underscore are called *partials* in Sass's documentation.)


### Addons

To make an ember-addon (both in-repo and from node_modules) behave as an eyeglass module, add `"eyeglass-module"` to the `package.json`'s `"keywords"` array and add the [relevant config](https://github.com/linkedin/eyeglass/tree/master/packages/eyeglass#writing-an-eyeglass-module) to the `"eyeglass"` property in `package.json`. To compile the addon's styles from `addon/styles` using eyeglass, add `ember-cli-eyeglass` as a dependency of the addon in question.

ember-addons have two important directories, `app` and `addon`:

#### my-addon/app/styles

These assets are only considered for top-level addons, stylesheets in `app` directories of nested-addons are ignored.

Given the following folder structure:

```
my-addon/app/styles/
                   /my-addon.scss
                   /my-other-file.scss
                   /_a-partial.scss

```

* `my-addon/app/styles` - The non-partial `scss` files will become independent css files in the built output.
* `my-addon/addon/styles` - The non-partial `scss` files will be compiled and the output merged into your application's `vendor.css`;


Will result in:

`assets/my-addon.css` containing the compiled output of `my-addon/app/styles/my-addon.scss`
`assets/my-other-file.css` containing the compiled output of `my-addon/app/styles/my-other-file.scss`
`_a-partial.scss` will not be included by default, unless the files in `my-app/app/styles/` or `my-addon/app/styles` import it.



#### my-addon/addon/styles/

These assets merged namespaced by the current addons name for all addons.

Given the following folder structure:

```
my-addon/addon/styles/
                     /_shared.scss
                     /my-addon.scss
                     /secondary.scss
```

The contents of `my-addon/addon/styles/my-addon.scss` will be added to `assets/vendor.css`.
The contents of `my-addon/addon/styles/secondary.scss` will be added to `assets/vendor.css`.
The contents of `my-addon/addon/styles/_shared.scss` will only be included if `my-addon.scss` or `secondary.scss` explicitly import them.

### Engines

Engines are enhanced addons, who optionally (if lazy) provide alternative `app` and `vendor` output.

```js
// path/to/engine/index.js
const app = new EmberEngine(defaults, {
  eyeglass: {
    discover: true,
    /* broccoli-eyeglass options */
    /* node-sass options */
    eyeglass: {
      /* eyeglass options */
    }
  }
});
```

Given the following folder structure:

```
my-engine/
         /app/styles/
                    /my-engine.scss
                    /my-other-file.scss
                    /_shared.scss
         /addon/styles/
                      /_shared.scss
                      /my-engine.scss
                      /secondary.scss
```

If this is an eager engine:


The contents of `my-engine/app/styles/my-engine.scss` will become `dist/assets/my-engine.css`
The contents of `my-engine/app/styles/my-other-file.scss` will become `dist/assets/my-other-file.css`
The contents of `my-engine/app/styles/_shared.scss` will only be included if `my-engine.scss` or `my-other-file.scss` explicitly import them.

The contents of `my-engine/addon/styles/my-addon.scss` will be added to `dist/assets/vendor.css`
The contents of `my-engine/addon/styles/secondary.scss` will be added to `dist/assets/vendor.css`
The contents of `my-engine/addon/styles/_shared.scss` will only be included if `my-addon.scss` or `secondary.scss` explicitly import them.

If this is a lazy engine:

The contents of `my-engine/app/styles/my-engine.scss` will be ignored
The contents of `my-engine/app/styles/my-other-file.scss` will be ignore
The contents of `my-engine/app/styles/_shared.scss` will be ignored unless imported.

The contents of `my-engine/addon/styles/my-addon.scss` will be added to `dist/engine-dist/my-engine/assets/engine.css`
The contents of `my-engine/addon/styles/secondary.scss` will be added to `dist/engine-dist/my-engine/assets/engine.css`
The contents of `my-engine/addon/styles/_shared.scss` will only be included if `my-addon.scss` or `secondary.scss` explicitly import them.

### Embroider Support

This addon works with Embroider builds as well as classic Ember CLI builds. By default, the addon will determine if your app is using Embroider by checking for the presence of `@embroider/core` in the `dependencies` or `devDependencies` listed in `package.json`.

If you have added code to `ember-cli-build.js` that _conditionally_ uses Embroider to build your application, you can provide the `embroiderEnabled` configuration option to declare to `ember-cli-eyeglass` whether you are using Embroider for this build.

```javascript
const USE_EMBROIDER = false;

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    eyeglass: {
      discover: true,
      // Signals to ember-cli-eyeglass if Embroider is being used with
      // this build. If omitted, ember-cli-eyeglass will determine if
      // Embroider is present based on your declared dependencies in
      // your app's package.json.
      //
      // Should be a boolean: true if using Embroider, false otherwise.
      embroiderEnabled: USE_EMBROIDER,
    }
  });

  if (USE_EMBROIDER) {
    return require('@embroider/compat').compatBuild(app, Webpack);
  }

  return app.toTree();
};
```

This configuration option is specific to `ember-cli-eyeglass` and must be set if using conditional builds. If not, you may get build errors as additional files could end up in the Broccoli tree that shouldn't be present.

## Building

* `ember build`

For more information on using ember-cli, visit [http://www.ember-cli.com/](http://www.ember-cli.com/).
