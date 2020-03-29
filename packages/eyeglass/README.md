[![CI Status](https://travis-ci.org/sass-eyeglass/eyeglass.svg?branch=master)](https://travis-ci.org/sass-eyeglass/eyeglass)

# eyeglass

## Getting some npm in your Sass

Eyeglass is a sass ([github](https://github.com/sass/sass)) extension manager built on top of npm. Using eyeglass, you can bring the power of node modules to your Sass files.

Eyeglass works with [`node-sass`](https://github.com/sass/node-sass) as well as [`dart-sass`](https://github.com/sass/dart-sass). Eyeglass has no direct dependency on a sass implementation and it will use whichever sass implementation that you have installed in your project. If necessary, you can pass a sass implementation to eyeglass using the `eyeglass.engines.sass` option.

# Installing eyeglass

```
npm install --save-dev eyeglass
```

Additionally, you must install a compatible Sass implementation.

If you want to use `node-sass`:

```
npm install --save-dev node-sass
```

If you want to use `dart-sass`:

```
npm install --save-dev sass
```

Additionally, if you use `sass.renderSync()` and have eyeglass modules that export
functions that are asynchronous, you should also add the `deasync` library to your project:

```
npm install --save-dev deasync
```

*Note: If your project uses `yarn`, the above commands should replace `npm install --save-dev` with `yarn add --dev`.*

# Adding eyeglass modules to your project
eyeglass modules are regular npm modules. Install them into your project just like any other item.

`npm install my_eyeglass_module --save-dev`

Once installed via npm, an eyeglass module can:
* Make stylesheets in the npm module accessible to the project via Sass's `@import` or `@use` directives.
* Expose custom functions and importers written in javascript to the Sass compiler.

If your build-tool is [eyeglass-aware](#building-sass-files-with-eyeglass-support), you can reference the eyeglass module with standard Sass import syntax: `@import "my_eyeglass_module/file";`. The `my_eyeglass_module` will be resolved to the correct directory in your node modules, and the file will then resolve using the standard import rules for Sass.

## Transitive dependencies

Eyeglass modules can depend on other eyeglass modules. By default Eyeglass will
only allow modules with a direct dependency on another eyeglass module to import
files from that module.

Setting `eyeglass.disableStrictDependencyCheck` to `true` will
allow any module in the dependency tree to be imported from any other file in
the dependency tree (note: setting this option is discouraged and should not be
necessary in most situations).

Unlike node, Sass has a global namespace. There are situations where npm will
happily install multiple instances of the same node package within the package
hierarchy, even spanning major versions. Eyeglass always creates a global
resolution of all the different versions of an eyeglass module by picking the
instance with the highest version. If multiple major versions of the same
package are found, eyeglass will warn you by default. If you set `eyeglass.strictModuleVersions` to `true`, eyeglass will produce a hard error. If you
set `eyeglass.strictModuleVersions` to `false` it will silently ignore these
version conflicts (this is not recommended).

## Manually adding modules

Eyeglass will transitively auto-discover npm installed modules that are listed in
your `package.json` files. (Just using `npm link` is not enough to use
modules on your local filesystem). In some cases, you might need to use an eyeglass
module that isn't distributed as an npm package, or adapt a sass library that
doesn't expose itself as an eyeglass module. In these situation, you can manually
add modules to your project.

To add modules that are not part of the npm ecosystem, you can manually
add modules via the eyeglass options:

```js
var sass = require("node-sass");
var eyeglass = require("eyeglass");
var options = {
  eyeglass: {
    modules: [
      // add module by path (must have a valid package.json)
      {
        path: "/path/to/your/module"
      },
      // add module by Object
      {
        name: "my-module-name",
        main: function(eyeglass, sass) {
          return {
            sassDir: ...,
            functions: ...,
            ...
          }
        },
        eyeglass: {
          needs: "...",
          ...
        }
      }
    ],

    engines: {
      sass: sass
    }
  }
};
sass.render(eyeglass(options)));
```

When adding a module by object, the object has the same format as the
object in an eyeglass module's package.json that would normally be
assigned to top-level `eyeglass` property. However, it supports one
additional property: `main`. The `main` object is a function as would be
returned by requiring the eyeglass `exports` file.  In this way, it is
possible to expose any arbitrary Sass project as an eyeglass module
without that module being required to "become an eyeglass" module. This
also enables the use of bower packages with Eyeglass.

Manually added eyeglass modules will only be able to be imported by the
main application's sass files. Dependencies between such manual modules
are not currently supported.

## Module Caching

By default, eyeglass uses a global module cache to help improve the performance of module discovery. This should be safe for almost all use cases, but if you modify your `node_modules` directory and/or `package.json` dependencies during build time, this may cause issues. You can opt-out of the by passing the eyeglass option `useGlobalModuleCache: false`.

```js
eyeglass({
  // sass options
  // ...
  eyeglass: {
    // eyeglass options
    // ...
    useGlobalModuleCache: false
  }
});
```

You can programmatically purge the global caches in Eyeglass using `Eyeglass.resetGlobalCaches()`.

# Working with assets

It's quite common to need to refer to assets from within your
stylesheets. Eyeglass provides core support for exposing assets to your
stylesheets for your application or from an eyeglass module and
generating urls to those assets as well as making sure only those assets
that you actually use end up in your built application.

## Exposing assets

### In your application

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
var eyeglass = require("eyeglass");
var rootDir = __dirname;
var assetsDir = path.join(rootDir, "assets");

var options = { ... node-sass options ... };


options.eyeglass = {
  // specifying root lets the script run from any directory instead of having to be in the same directory.
  root: rootDir,

  // where assets are installed by eyeglass to expose them according to their output url.
  // If not provided, assets are not installed unless you provide a custom installer.
  buildDir: path.join(rootDir, "dist"),

  assets: {
    // prefix to give assets for their output url.
    httpPrefix: "assets",

    // Add assets except for js and sass files
    // The url passed to asset-url should be
    // relative to the assets directory specified.
    sources: [
      {directory: assetsDir, globOpts: { ignore: ["**/*.js", "**/*.scss"] }}
    ]
  },

  engines: {
    sass: sass
  }
}

// Standard node-sass rendering of a single file.
sass.render(eyeglass(options), function(err, result) {
  // handle results
});
```

### In the module

In function that you export from your `eyeglass-exports.js`, you have the
`eyeglass` as the first parameter. It has `assets` property, and it has the
method `export` that accepts the same arguments as `addSource` and returns a
new instance of assets list with the given path already included in the list
with provided options.

To expose it, you need to set it as `assets` property on the object you return
from exported function:

```js
module.exports = function(eyeglass, sass) {
  return {
    assets: eyeglass.assets.export('some/path/here'),
  };
};
```

See the `Examples` section below for more details.

#### Examples

Let's say your module has structure like this:

```
mymodule/
└── assets/
    ├── images/
    │   ├── foo/
    │   │   └── image1.png
    │   └── unused.gif
    ├── fonts/
    │   └── coolfont.ttf
    └── scss/
        └── app.scss
```

If you don't require per-path options or fine-grained control of what can be
imported from SASS, you can use just one path:

```js
var path = require('path');

var assets_path = path.join(__dirname, 'assets');

module.exports = function(eyeglass, sass) {
  return {
    sassDir: path.join(assets_path, 'scss'),
    assets: eyeglass.assets.export(assets_path, {
      globOpts: {
        ignore: [ '**/*.scss', '**/*.js' ]
      }
    });
  }
};
```

But if you want more fine-grained control, you can save the result of
`assets.export()` to the variable and call `addSource` on it any amount of
times:

```js
var path = require('path');

var assets_path = path.join(__dirname, 'assets');
var images_path = path.join(assets_path, 'images');
var fonts_path = path.join(assets_path, 'fonts');

var images_options = { ... images-related options ... };
var fonts_options = { ... fonts-related options ... };

module.exports = function(eyeglass, sass) {
  // Create new list of assets with at least one path
  var module_assets = eyeglass.assets.export(images_path, images_options);

  // You can add more paths like this
  module_assets.addSource(fonts_path, fonts_options);

  return {
    sassDir: path.join(assets_path, 'stylesheets'),
    assets: module_assets
  }
};
```

Note that in this case, given the name of the module is `mymodule`,
the `coolfont.ttf` and `foo/image1.png` will be avilable
as `mymodule/coolfont.ttf` and `mymodule/foot/image1.png` accordingly.

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
var eyeglass = require("eyeglass");
var sass = require("node-sass")
var sassOptions = { ... } ; // options for node-sass

// eyeglass specific options are passed via the `eyeglass` key in the sass options.
sassOptions.eyeglass {
  assets: {
    sources: [
      // Expose images in the assets/images directory as /images on the
      // website by putting the images we reference with asset-url()
      // into the public/images directory.
      {directory: "assets", {pattern: "images/**/*"}},

      // Expose fonts in the assets/fonts directory as /fonts on the
      // website by putting the fonts we reference with asset-url()
      // into the public/fonts directory.
      {directory: "assets", {pattern: "fonts/**/*"}}
    ]
  }
}

// These options are processed and returned as options that can be passed to any build tool
// that passes options through to node-sass.
sass.render(eyeglass(sassOptions), function(error, result) {
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
    options: eyeglass({sourceMap: true}),
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
    "sassDir": "sass",
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

If your eyeglass module needs to define Sass functions in javascript,
you will need to make an eyeglass exports file. It is convention to name
this file `eyeglass-exports.js` but any file name is allowed.

Below is an example eyeglass exports file:

```js
"use strict";

var path = require("path");

module.exports = function(eyeglass, sass) {
  return {
    functions: {
      "greetings-hello($name: 'World')": function(name, done) {
        done(new sass.types.String("Hello, " + name.getValue()));
      }
    }
  }
};
```

If the `eyeglass.exports` option is not found in `package.json` eyeglass
will fall back to using the npm standard `main` file declared in your
package.json.  If your npm module has a main file meant to be used generally by
javascript, but no eyeglass exports file, then you can simply set
`eyeglass.exports` option to `false` in your `package.json`.


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

To disable the import-once behavior, you need to set the `enableImportOnce`
option to false:

```js
var sass = require("node-sass");
var eyeglass = require("eyeglass");
var sassOptions = {
  eyeglass: {
    enableImportOnce: false
  }
};

sass.render(eyeglass(sassOptions, sass));
```

# URI path normalization

By default, eyeglass will normalize path separators for interoperability between different platforms (Windows,
Unix, etc). While we don't anticipate any issues with this feature, you can opt-out of this feature if you do
encounter issues. Please do report any such issues so we may investigate. If you disable this feature,
eyeglass will not work on Windows platforms.

## Opt-Out via Environment Variable

Setting an environment variable `EYEGLASS_NORMALIZE_PATHS=false`

## Opt-Out via Config Option

Explicitly via eyeglass options:
```js
var sass = require("node-sass");
var eyeglass = require("eyeglass");
var options = {
  eyeglass: {
    engines: {
      sass: sass
    },
    normalizePaths: false
  }
};
sass.render(eyeglass(options)));
```

## `asset-uri`/`asset-url` string literals are not normalized

When using the `asset-uri` and `asset-url`, the URI string passed are not normalized. This is to
ensure that the URI always uses valid web path separators (`/`) rather than file system path separators.
That is `asset-uri('path/to/file.png)` will resolve the correct file asset on any platform, but
`asset-url('foo\\bar.png')` will expect to find a file with a literal `\` in it's name
(`foo\\bar.png`), not a file located at `foo/bar.png`. We encourage you _not_ to use backslashes in
your file names, as this means your code cannot easily be ported to Windows platforms.
