# eyeglass
## Getting some npm in your Sass

eyeglass is a node-sass ([github](https://github.com/sass/node-sass)) extension manager built on top of npm. Using eyeglass, you can bring the power of node modules to your Sass files.

# Installing eyeglass
```
# for cli functionality
npm install -g eyeglass

# for programatic functionality
npm install eyeglass --save
```

# Adding eyeglass modules to your project
eyeglass modules are regular npm modules. Install them into your project just like any other item.

`npm install my_eyeglass_module --save`

Once installed, a module can:
* Provide stylesheets that you can import with special node_module syntax
* Add additional custom functions to Sass, leveraging the power of npm's small, discrete module philosophy

In Sass, you can reference the eyeglass module with standard Sass import syntax: `@import "<my_eyeglass_module>/file"; The `<my_eyeglass_module>` will be resolved to the correct directory in your node modules, and the file will then resolve using the standard import rules for Sass.

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
var path = require('path');

module.exports = function(eyeglass, sass) {
  return {
    sass_dir: path.join(__dirname, 'sass'),
    functions: {
      'hello($name: 'World')': function(name, done) {
        done(sass.types.String('Hello, " + name.getValue()));
      }
    }
  }
};
```

### Import-Once

Any sass files imported from your node modules will only ever be
imported once per CSS output file. Note that Sass files imported
from the Sass load path will have the standard sass import behavior.
