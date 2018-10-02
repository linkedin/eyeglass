# broccoli-eyeglass [![Build Status](https://travis-ci.org/sass-eyeglass/broccoli-eyeglass.svg?branch=master)](https://travis-ci.org/sass-eyeglass/broccoli-eyeglass)

`broccoli-eyeglass` is a [broccoli](https://github.com/broccolijs/broccoli) plugin that compiles
`.scss` and `.sass` files with [libsass](https://github.com/sass/libsass)
and uses [eyeglass](https://github.com/sass-eyeglass/eyeglass)
for project and sass module support.

## Installation

```bash
npm install --save-dev broccoli-eyeglass
```

## Usage

In your `Brocfile.js`:

```js
var compileSass = require('broccoli-eyeglass');

var outputDirectory = "dist";
var options = {
  cssDir: "assets/css",
  fullException: false
}
var outputTree = new compileSass(inputTrees, options);
```

* **`inputTrees`**: An array of trees that act as the include paths for
  libsass. If you have a single tree, pass `[tree]`. All sass files in
  these trees that are not prefixed with an underscore (a.k.a. a partial),
  will be compiled into a single output directory. Use the node-sass
  `includePaths` option to make other directories available for import
  without compiling them to css. Note that eyeglass will make sure that
  all your eyeglass-compatible sass modules can be imported.

* **`options`**: Except for the options that are specific to this plugin. All
   the rest are passed through [eyeglass](https://github.com/sass-eyeglass/eyeglass) and then to
   [node-sass](https://github.com/sass/node-sass#options).

**Note:** that the following node-sass options are managed by this plugin and
must not be provided: `file`, `data`, `outFile`

### Options

The following options are specific to this plugin:

* `assets` - Optional. A string or array of strings indicating
  the subdirectories where assets for the project can be found. This
  calls `eyeglass.assets.addSource` for each directory specified. If the
  options passed for these are not sufficient, use the `configureEyeglass`
  callback to call `addSource` with the options you need.
* `assetsHttpPrefix` - The subdirectory that assets are in relative to
  the `httpRoot` when generating urls to them.
* `configureEyeglass` - Optional. A callback function that is passed
  the eyeglass instance for a file so that it can be manipulated before
  compiling the Sass file. The arguments passed are:

  * eyeglass - The eyeglass instance.
  * sass - the node-sass instance.
  * details - the compilation details object which provides information
    about what is being compiled. See below for more information about
    the compilation details.
* `cssDir` - Required. The directory where CSS files should be written
  relative to the build output directory.
* `discover` - When `true`, will discover sass files to compile that are
  found in the sass directory. Defaults to true unless `sourceFiles` are
  specified.
* `sassDir` - The directory to look for scss files to compile. Defaults
  to tree root.
* `fullException` - When set to true, instead of generating a build
  error, the css output file will be written such that it displays a
  compilation failure in the browser. This is useful during development
  but should not be used for production builds. (Not yet implemented)
* `renderSync` - Force sass rendering to use node-sass's synchronous
  rendering. Defaults to `false`.
* `relativeAssets` - Whether to render relative links to assets.
  Defaults to `false`.
* `sourceFiles` - Array of file names or glob patterns (relative to the
  sass directory) that should be compiled. Note that file names must include
  the file extension (unlike `@import` in Sass). E.g.: `['application.scss']`
* `persistentCache` - String. Set to the name of your application so
  that your cache is isolated from other `broccoli-eyeglass` based
  builds. When falsy, persistent caching is disabled.
* `maxListeners` - Integer. Set to the maximum number of listeners
  your use of eyeglass compiler needs. Defaults to 10. Note: do not
  set `eyeglassCompiler.events.setMaxListeners()` yourself as eyeglass
  has its own listeners it uses internally.
* `optionsGenerator` - Function that accepts four arguments:

  * `sassFile` - The sass file being compiled.
  * `cssFile` - The place where broccoli-eyeglass plans to write the
    cssFile relative to the build output directory.
  * `options` - The compilation options that will be passed to eyeglass
    and then to node-sass. This is a copy of plugin's options and so it
    can be modified or augmented.
  * `compilationCallback` - This callback accepts a css filename and
    options to use for compilation. This callback can be invoked 0 or more
    times. Each time it is invoked, the sass file will be compiled to
    the provided css file name (relative to the output directory) and the
    options provided.

* `verbose` - When true, console logging will occur for each css file
  that is built along with timing information.

  In this way a sass file can be skipped or permuted during your build
  process by passing different options. Examples where this is useful
  include A/B testing or localization specific output. Note: if you
  invoke the callback more than once, you should change the output
  filename to avoid overwriting previous invocations' output.

### Compilation Details

The compilation details object provides context about what is being
compiled so that eyeglass and eyeglass integration code can make
intelligent decisions about how to handle it.


* `srcPath`: The directory to which the `sassFilename` is relative.
* `sassFilename`: The path of the sass file being compiled (relative to `srcPath`).
* `fullSassFilename`: The absolute path of the Sass file.
* `destDir`: The directory where compiled css files are being written.
* `cssFilename`: The CSS filename relative to the `destDir`.
* `fullCssFilename`: The absolute path of the CSS file. (note: the file is not there yet, obviously)
* `options`: The sassOptions as returned by the options generator (if provided).

## Debugging

Set the an environment variable `DEBUG="broccoli-eyeglass:*"` to get lots of
debugging output that can help diagnose build issues -- especially
issues with build caching and cache invalidation. You can also
specifically use the following debug traits:

* `DEBUG="broccoli-eyeglass:persistent-cache"` - Detailed logging for the
  cross-build persistent cache.
* `DEBUG="broccoli-eyeglass:hot-cache"` - Detailed logging for the
  hot-cache that is used for rebuilds in the same broccoli process.

Eyeglass-specific debugging can by enabled by setting `DEBUG="eyeglass:*"`

You can debug with both of those set as well: `DEBUG="broccoli-eyeglass,eyeglass:*"`

For more details, see the documentation on [debug](https://github.com/visionmedia/debug).

## Caching

This broccoli plugin uses two different caching layers to avoid
unecessary builds of sass files.

By default, if the the `CI=true` environment variable is set, peristent caches
are disabled. To force persistent caches on CI, please set the
`FORCE_PERSISTENCE_IN_CI=true` environment variable;

### Rebuild Caching

When the same broccoli-eyeglass instance is run more than once, the
rebuild is avoided by checking mtimes of dependencies to see if they
have changed since the last build.

This is a very fast and highly accurate caching system that avoids
rebuilds while running a single build instance (for things like `ember serve`)
because mtime checks are pretty fast and only dependencies are stat'ed.

Unfortunately, this caching system only helps for rebuilds within the
same instance as all the cache state is held in memory -- a first build
is required every time.

### Persistent Caching

Persistent Caching is more slightly expensive because it is content based (as
opposed to mtimes) and because it has to check more things (npm modules
might have been upgraded, etc), but it
allows `broccoli-eyeglass` to skip the first build when nothing has
changed, which is often the case between successive rebuilds.

Because it's more expensive, in some cases it may actually be slower
than just building your stylesheets depending on the size/complexity of
your Sass files. You should test with and without and verify a speedup
before enabling this.

To enable persistent caching set the `persistentCache` option as
described above.

### Forcing Invalidation

The easiest way to force invalidate the rebuild cache is to just save
the main sass file that needs to be rebuilt (see also: the unix `touch`
command). There's not currently a way to disable the rebuild cache, we
could add one, but we'd rather understand why it's not working first and
try to address that.

To force an initial build and skip the persistent cache set the
environment variable `BROCCOLI_EYEGLASS=forceInvalidateCache`.

### General Cache Invalidation

The caches will only be invalidated correctly if this broccoli plugin
knows what files are depended on and output. Sass files and eyeglass
assets are already tracked. But other files migh be involved in your
build, if that is the case, `eyeglassCompiler.events.emit("dependency", absolutePath)`
must be called during the build. Similarly, if there are
other files output during compilation, then you must call
`eyeglassCompiler.events.emit("additional-output", absolutePath)`.

### Caching while developing eyeglass modules

When developing against an eyeglass module, it's common for the files in
the module to change without a corresponding version change. If an
eyeglass module is in development returning `inDevelopment: true` as an
option from the eyeglass exports file will cause `broccoli-eyeglass` to
more carefully check for invalidations in that module instead of just
relying on semver.

### Debugging the cache

As above, set `DEBUG="broccoli-eyeglass"` to see debug output that may
help you report a bug or diagnose why caching isn't working like you
thnk it should.

## Examples

Do you like examples? You’re in luck!

1. Read through a number of example project set-ups [in EXAMPLES.md][examples-on-gh].

2. Run those examples yourself by `cd`ing into an example underneath the `examples` folder.

[examples-on-gh]: https://github.com/sass-eyeglass/broccoli-eyeglass/blob/master/EXAMPLES.md

Here’s a preview:

### Example 1: The Simplest Possible Project

Consider the trivial project:

```
.
├── Brocfile.js
├── package.json
└── src
     ├── bar.scss
     ├── foo.scss
     └── _config.scss
```

With this `Brocfile.js`:

```js
var BroccoliEyeglass = require('broccoli-eyeglass');

var options = {
  cssDir: 'css' /* This is the only required option */
};

var outputTree = new BroccoliEyeglass(['src'], options);

module.exports = outputTree;
```

You can build the project with the command

```sh
broccoli build dist
```
(after an `npm install`, of course).

With the default options, Broccoli-Eyeglass will discover all the Sass files that don’t start with an underscore, and compile them.

The result should be exactly this:

```
.
├── Brocfile.js
├── package.json
├── src
│    ├── bar.scss
│    ├── foo.scss
│    └── _config.scss
└── dist
    └── css
        ├── bar.css
        └── foo.css
```

### More Examples

Go ahead and take a look at [EXAMPLES.md][examples-on-gh]!
