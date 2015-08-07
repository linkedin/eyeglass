# broccoli-eyeglass

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

* `cssDir` - Required. The directory where CSS files should be written
  relative to the build output directory.
* `sassDir` - The directory to look for scss files to compile. Defaults
  to tree root.
* `renderSync` - Force sass rendering to use node-sass's synchronous
  rendering. Defaults to `false`.
* `fullException` - When set to true, instead of generating a build
  error, the css output file will be written such that it displays a
  compilation failure in the browser. This is useful during development
  but should not be used for production builds. (Not yet implemented)
* `verbose` - When true, console logging will occur for each css file
  that is built along with timing information.
* `discover` - When `true`, will discover sass files to compile that are
  found in the sass directory. Defaults to true unless `sourceFiles` are
  specified.
* `sourceFiles` - Array of file names or glob patterns (relative to the
  sass directory) that should be compiled. Note that file names must include
  the file extension (unlike `@import` in Sass). E.g.: `['application.scss']`
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

  In this way a sass file can be skipped or permuted during your build
  process by passing different options. Examples where this is useful
  include A/B testing or localization specific output. Note: if you
  invoke the callback more than once, you should change the output
  filename to avoid overwriting previous invocations' output.
