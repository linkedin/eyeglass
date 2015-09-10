[![CI Status](https://travis-ci.org/sass-eyeglass/eyeglass.svg?branch=master)](https://travis-ci.org/sass-eyeglass/eyeglass)

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

# Working with assets

It's quite common to need to refer to assets from within your
stylesheets. Eyeglass provides core support for exposing assets to your
stylesheets for your application or from an eyeglass module and
generating urls to those assets as well as making sure only those assets
that you actually use end up in your built application.

## Exposing assets

The `addSource` method on `eyeglass.assets` is how you add assets to
your application. The path passed to `asset-url()` is going to be
relative to the directory that you pass to addSource.

Given the following assets directory structure:

```
myproject/
└── assets/
    ├── images/
    │   ├── foo/
    │   │   └── image1.png
    │   └── unused.gif
    ├── js/
    │   └── app.js
    └── scss/
        └── app.scss
```

The simplest way to expose your assets to eyeglass is to add your assets
directory as an eyeglass asset source. Using a simple node script we can
compile a Sass file.

```js
#!/usr/bin/env node
var path = require("path");
var sass = require("node-sass");
var Eyeglass = require("eyeglass").Eyeglass;
var rootDir = __dirname;
var assetsDir = path.join(rootDir, "assets");

var options = { ... node-sass options ... };


// specifying root lets the script run from any directory instead of having to be in the same directory.
options.root = rootDir;

// where assets are installed by eyeglass to expose them according to their output url.
// If not provided, assets are not installed unless you provide a custom installer.
options.buildDir = path.join(rootDir, "dist");

// prefix to give assets for their output url.
options.assetsHttpPrefix = "assets";

var eyeglass = new Eyeglass(options, sass);

// Add assets except for js and sass files
// The url passed to asset-url should be
// relative to the assets directory specified.
eyeglass.assets.addSource(assetsDir, {
  globOpts: { ignore: ["**/*.js", "**/*.scss"] }
});

// Standard node-sass rendering of a single file.
sass.render(eyeglass.sassOptions(), function(err, result) {
  // handle results
});
```

## Referencing Assets

To reference an asset in your application or within your own module you
can simply `@import "assets"`. To reference assets that are in a module
that you have a direct dependency on, you can `@import "<module>/assets"`.
For example: `@import "my-theme/assets"` would import the assets from
the `my-theme` eyeglass module.

Importing assets for an application or module returns an automatically
generated Sass file that registers asset information with the eyeglass
assets Sass module.

Then you can refer to that asset using the fully qualified source url of
the asset. This url must include the module prefix when referencing the
asset. For example `background: asset-url("images/foo.png")` would
import a file `images/foo.png` that is relative to the `assetsDir`.

To refer to an asset in your module, include the module name as a
directory prefix when invoking `asset-url`. For example
`asset-url("my-theme/icons/party.png")` would import the file
`icons/party.png` that is exposed by the `my-theme` module. Even within
the my-theme module, this prefix must be used when referring to the
assets of that module.

Astute readers will have noted that there is a possible namespace
collision if you have a directory in your application with the same name
as a module. This is on purpose: it lets you replace module assets
with your own assets if you need to do so by overriding them in your own
application.

## Asset URL Manipulation

By default, eyeglass will namespace module asset urls according to their
eyeglass module name and both application and module assets urls will be
placed within folder specified by the `assetsHttpPrefix` option.
However, an application or framework can chose to override the url
scheme for assets by defining an asset resolver.

### Example: Adding a modification timestamp to assets as a query parameter.

```js
  eyeglass.assets.resolver(function(assetFile, assetUri, oldResolver, done) {
    var fs = require("fs");
    var mtime = fs.statSync(assetFile).mtime.getTime();
    done(null, {
      path: assetUri,
      query: mtime.toString()
    });
  });
```

### Example: hashing assets by md5sum.

```js
eyeglass.assets.resolver(function(assetFile, assetUri, oldResolver, done) {
  var path = require("path");
  var fs = require("fs");
  var md5 = require("MD5");
  var prefix = "/" + eyeglass.options.assetsHttpPrefix + "/";
  fs.readFile(assetFile, function(err, buffer) {
    if (err) {
      done(err);
    } else {
      done(null, {
        path: prefix + md5(buffer) + path.extname(assetFile)
      });
    }
  });
});
```

## Asset Installation

By using Eyeglass's asset installation system, you can ensure that only
those assets that are referenced in your stylesheets will be part of
your application when it is built.

Once an asset's url is fully resolved, the asset probably needs to be
installed into a location from where it can be served as that url. The
simplest way to do this is to specify the `buildDir` option to eyeglass.
Once that is specified the resolved url will be used to copy the file to
a location relative to the build directory.

In order to allow for asset pipeline integration (E.g. writing to a
Vinyl file) and more complex application needs, it's possible to chain
or override the default eyeglass asset installer.

### Installer Example: Logging installed assets:

```js
eyeglass.assets.installer(function(assetFile, assetUri, oldInstaller, cb) {
  // oldInstaller is the standard eyeglass installer in this case.
  // We proxy to it for logging purposes.
  oldInstaller(assetFile, assetUri, function(err, result) {
    if (err) {
      console.log("Error installing '" + assetFile + "': " + err.toString());
    } else {
      console.log("Installed Asset '" + assetFile + "' => '" + result + "'");
    }
    cb(err, result);
  });
});
```

## More on Assets

The code samples here are actually derived from a simple eyeglass
project. You can view the [actual code](https://gist.github.com/chriseppstein/bcc1a50e01384f82e7e0)
as a gist.

Assets are complex and the asset configuration of Eyeglass is very
flexible. For more documentation see the [asset documentation](docs/assets/index.md).

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
var Eyeglass = require("eyeglass").Eyeglass;
var sass = require("node-sass")
var sassOptions = { ... } ; // options for node-sass
var eyeglass = new Eyeglass(sassOptions);

// futher configuration of the eyeglass instance can happen here.

// Expose images in the assets/images directory as /images on the
// website by putting the images we reference with asset-url()
// into the public/images directory.
eyeglass.assets.addSource("assets", {pattern: "images/**/*"});

// Expose fonts in the assets/fonts directory as /fonts on the
// website by putting the fonts we reference with asset-url()
// into the public/fonts directory.
eyeglass.assets.addSource("assets", {pattern: "fonts/**/*"});

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
var eyeglass = require("eyeglass");
...
sass: {
    options: eyeglass.decorate({
        sourceMap: true
    }),
    dist: {
        files: {
            'public/css/main.css': 'sass/main.scss'
        }
    }
}
...
```

# Writing an Eyeglass Module

node-sass allows you to register custom functions for advanced
functionality. Eyeglass allows any node modules that are tagged with
`eyeglass-module` to be automatically loaded into eyeglass and makes
your module [discoverable on
NPM](http://npmjs.com/browse/keyword/eyeglass-module). To tag your module as an
eyeglass module, add the `eyeglass-module` keyword to your
`package.json`.

```js
{
  ...
  "keywords": ["eyeglass-module", "sass", ...],
  "eyeglass": {
    "exports": "eyeglass-exports.js",
    "name": "greetings",
    "needs": "^0.6.0"
  },
  ...
}
```

In the `"eyeglass"` option block in your package.json, you will declare
the eyeglass exports file and the semver dependency that your module has
on eyeglass itself using the `"needs"` option. Failure to provide this
option will give your users a warning since eyeglass has no way to check
if your module is compatible with the currect eyeglass version.

### Eyeglass Exports File

Your requirable module exports an object that describes your module's
structure and can expose javascript functions as sass functions. It is
convention to name this file `eyeglass-exports.js` but any file name is
allowed.

Below is an example eyeglass exports file:

```js
"use strict";

var path = require("path");

module.exports = function(eyeglass, sass) {
  return {
    sassDir: path.join(__dirname, "sass"),
    functions: {
      "greetings-hello($name: 'World')": function(name, done) {
        done(sass.types.String("Hello, " + name.getValue()));
      }
    }
  }
};
```

If the `eyeglass.exports` option is not found in `package.json` eyeglass
will fall back to using the npm standard `main` file declared in your
package.json.

Since all functions declared from javascript are global, it is best
practice to scope your function names to avoid naming conflicts. Then,
to simplify the naming of your functions for the normal case, provide a
sass file that when imported, unscopes the function names by wrapping
them. 

```scss
// index.scss
@function hello($args...) {
  @return greetings-hello($args...);
}
```

### Specifying a name for @import that is different from your npm package name

If you need the top level import to be named differently than the name
of your npm module then you can specify a `name` attribute for the
eyeglass object in your package.json. The following example would allow
`@import "foo";` to import `index.scss` from your package's sass
directory.

```js
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
from the Sass load path will have the standard Sass `@import` behavior.

To disable the import-once behavior, you need to set `enableImportOnce`
to false:

```js
var Eyeglass = require("eyeglass").Eyeglass;
var sassOptions = {};
var eyeglass = new Eyeglass(sassOptions);
eyeglass.enableImportOnce = false;
```
