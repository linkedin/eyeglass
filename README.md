# eyeglass
## Getting some npm in your Sass

eyeglass is a node-sass ([github](https://github.com/sass/node-sass)) extension manager built on top of npm. Using eyeglass, you can bring the power of node modules to your Sass files.

# Status: Developer Preview

Eyeglass is using cutting edge features from node-sass that won't be
released until node-sass 3.0. If you want to develop on or with eyeglass
you'll need to build a custom version of node-sass for the time being:

```
$ git clone https://github.com/sass/node-sass.git
$ cd node-sass
$ git remote add matryo https://github.com/matryo/node-sass.git
$ git fetch matryo
$ git checkout custom_functions 
$ git submodule update --init --recursive
$ npm install
$ npm install -g node-gyp
$ node-gyp rebuild
$ npm link
$ cd ../eyeglass
$ npm link node-sass
```

# Installing eyeglass
```
# for cli functionality
npm install -g eyeglass

# for programatic functionality
npm install eyeglass --save-dev
```

# Adding eyeglass modules to your project
eyeglass modules are regular npm modules. Install them into your project just like any other item.

`npm install my_eyeglass_module --save-dev`

Once installed, a module can:
* Provide stylesheets that you can import with special node_module syntax
* Add additional custom functions to Sass, leveraging the power of npm's small, discrete module philosophy

In Sass, you can reference the eyeglass module with standard Sass import syntax: `@import "<my_eyeglass_module>/file";` The `<my_eyeglass_module>` will be resolved to the correct directory in your node modules, and the file will then resolve using the standard import rules for Sass.

# Writing an eyeglass module with Sass files
To create an eyeglass module with Sass files, place the files inside of a `sass` directory in your npm module.

```
|- /
  |- eyeglass-exports.js
  |- package.json
  |- sass
    |- index.scss (or .sass)
```

eyeglass will automatically map `@import` calls containing angle brackets `<` and `>` into the corresponding node module directory. Because Sass uses a global namespace, it's recommended that you namespace-prefix any mixins you create in order to avoid collisions.

In keeping with node's conventions, eyeglass modules can create an
`index.scss` file in any folder instead of defining a file of the same
name as a folder in order to be the main entry point for a sass module having
submodules.


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
following example would allow `@import "<foo>";` to import from your
package's sass directory.

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
