# eyeglass
## Getting some npm in your Sass

eyeglass is a node-sass ([github](https://github.com/sass/node-sass)) extension manager built on top of npm. Using eyeglass, you can bring the power of node modules to your Sass files.

# Installing eyeglass

```
# for programatic functionality
npm install eyeglass --save-dev
```

# Adding eyeglass modules to your project
eyeglass modules are regular npm modules. Install them into your project just like any other item.

`npm install my_eyeglass_module --save-dev`

Once installed via npm, an eyeglass module can:
* Provide stylesheets that you can import with special node_module syntax.
* Add additional custom functions to Sass that are written in javascript.

In Sass files, you can reference the eyeglass module with standard Sass import syntax: `@import "my_eyeglass_module/file";`. The `my_eyeglass_module` will be resolved to the correct directory in your node modules, and the file will then resolve using the standard import rules for Sass.

# Writing an eyeglass module with Sass files
To create an eyeglass module with Sass files, place the files inside of a `sass` directory in your npm module.

```
|- /
  |- eyeglass-exports.js
  |- package.json
  |- sass
    |- index.scss (or .sass)
```

eyeglass will automatically map the first directory of `@import`
statements to the correct node-module directory if there is a eyeglass
module with that eyeglass name. Because Sass uses a global namespace,
it's recommended that you namespace-prefix any mixins you create in
order to avoid collisions.

In keeping with node's conventions, eyeglass modules can create an
`index.scss` file in any folder instead of defining a file of the same
name as a folder in order to be the main entry point for a sass module having
submodules.

# Building sass files with eyeglass support

The easiest way to use eyeglass is to use an eyeglass-aware
build-tool plugin. The following plugins are available:

* [broccoli-eyeglass](https://github.com/sass-eyeglass/broccoli-eyeglass)
* [ember-cli-eyeglass](https://github.com/sass-eyeglass/ember-cli-eyeglass)


## Integrating with other build systems

Eyeglass is designed to be easy to use with any node-sass based
compilation system.

```js
var Eyeglass = require("eyeglass");
var sass = require("node-sass")
var sassOptions = { ... } ; // options for node-sass
var eyeglass = new Eyeglass(sassOptions);

// futher configuration of the eyeglass instance can happen here.

// Expose images in the assets/images directory as /images on the
// website by putting the images we reference with asset-url()
// into the public/images directory.
eyeglass.assets("assets/images", "images", "public/images");

// Expose fonts in the assets/fonts directory as /fonts on the
// website by putting the fonts we reference with asset-url()
// into the public/fonts directory.
eyeglass.assets("assets/fonts", "fonts", "public/fonts");

// These options can be passed to any sass build tool that passes
// options through to node-sass.
sass.render(eyeglass.sassOptions(), function(error, result) {
  if (error) {
    //handle the compilation error
  } else {
    // write the result.css output to a file.
  }
});
```

### Example: integration with grunt and grunt-sass

```js
...
sass: {
    options: require("eyeglass")({
        sourceMap: true
    }).sassOptions(),
    dist: {
        files: {
            'public/css/main.css': 'sass/main.scss'
        }
    }
}
...
```

### TODO: Detailed build integration guide as details emerge.

* Assets integration
* Per-css callback for import-once support.
* etc.

# Writing an eyeglass module with Custom Functions
node-sass allows you to register custom functions for advanced functionality. Eyeglass allows any node modules that are tagged with `eyeglass-module` to be automatically loaded into eyeglass. To tag your module as an eyeglass module, add the `eyeglass-module` keyword to your `package.json`

```
{
  ...
  "keywords": ["eyeglass-module", "sass", ...],
  "main": "eyeglass-exports.js",
  ...
}
```

Your requirable module exports an object that describes your module's
structure and can expose javascript functions as sass functions. Below
is an example eyeglass exports file:

```
"use strict";

var path = require("path");

module.exports = function(eyeglass, sass) {
  return {
    sassDir: path.join(__dirname, "sass"),
    functions: {
      "hello($name: 'World')": function(name, done) {
        done(sass.types.String("Hello, " + name.getValue()));
      }
    }
  }
};
```

If your package.json main file is already in use for something else, you
can still export eyeglass functions by specifying `eyeglass: 'path/to/eyeglass-exports.js'`
or by specifying an eyeglass object with an `exports` attribute:

```
{
  ...
  "main": "lib/my-awesome-main-file.js",
  "eyeglass": {
    "exports": "lib/eyeglass-exports.js"
  }
  ...
}
```

If you need the top level import to be named differently than the name
of your npm module (this is not best practice) then you can specify a
`name` attribute for the eyeglass object in your package.json. The
following example would allow `@import "foo";` to import `index.scss`
from your package's sass directory.

```
{
  ...
  "name": "eyeglass-foo",
  "eyeglass": {
    "name": "foo"
  }
  ...
}
```

### Import-Once

Any sass files imported from your node modules will only ever be
imported once per CSS output file. Note that Sass files imported
from the Sass load path will have the standard sass import behavior.
