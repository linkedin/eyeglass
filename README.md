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


## Examples

You can run any of these examples yourself! Find them under the `examples` folder.

### Example 1: As Little Configuration as Possible

Consider the trivial project:

```
myproject
└── src
     ├── bar.scss
     ├── foo.scss
     └── _config.scss
```

```scss
/* bar.scss */

@import "config";

.bar {
  color: $badass-green;
}
```

```scss
/* foo.scss */

@import "config";

.foo {
  background-color: $badass-green;
  color: white;
}
```

```scss
/* _config.scss */

$badass-green: #8AD455;
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

And built with the command
```sh
broccoli build dist
```
(after an `npm install`, of course).

With the default options, Broccoli-Eyeglass will discover all the Sass files that don’t start with an underscore, and compile them.

The result should be exactly this:

```
myproject
├── src
│    ├── bar.scss
│    ├── foo.scss
│    └── _config.scss
└── dist
    └── css
        ├── bar.css
        └── foo.css
```

```css
/* bar.css */

.bar {
  color: #8AD455 }
```

```css
/* foo.css */

.bar {
  background-color: #8AD455;
  color: #fff; }
```

### Example 2: One Sassy Master File

Okay, imagine this is some sort of legacy project and we _can’t_ just compile some file, say, `my-module.scss`. We could rename it to start with an underscore, and it would be available for `@import`-ing into other Sass files without being directly compiled by default. But let’s further imagine we _can’t_ rename it to start with an underscore. What would we do then?

```
myproject
├── Brocfile.js
├── package.json
└── src
    ├── _config.scss
    ├── master.scss
    └── my-module.scss
```

```scss
/* master.scss */

@import "config";
@import "my-module";
```

```scss
/* my-module.scss */

// Note: This file depends on variables from `_config.scss`, but does not itself
// @import that file. Instead, we rely on `master.scss` including both of us.

.my-module {
  color: $badass-green;
}
```

```scss
/* _config.scss */

$badass-green: #8AD455;
```

Okay, got the situation? If we used the `Brocfile.js` from example 1, we’d get a compilation error since `$badass-green` would be undefined in `my-module.scss`.

So let’s change our configuration!

```js
/* Brocfile.js */

var BroccoliEyeglass = require('broccoli-eyeglass');

var options = {
  cssDir: 'stylesheets',
  discover: false, // Don't automatically find & convert sass files in the trees
  sourceFiles: ['master']
};

var outputTree = new BroccoliEyeglass(['src'], options);

module.exports = outputTree;
```

And built with the command
```sh
broccoli build public
```

Okay, got the situation? If we used the `Brocfile.js` from example 1, we’d get a compilation error since `$badass-green` would be undefined in `my-module.scss`.

So let’s change our configuration!

```js
/* Brocfile.js */

var BroccoliEyeglass = require('broccoli-eyeglass');

var options = {
  cssDir: 'stylesheets',
  discover: false, // Don't automatically find & convert sass files in the trees
  sourceFiles: ['master.scss'] // Array of files (or glob string) to compile
};

var outputTree = new BroccoliEyeglass(['src'], options);

module.exports = outputTree;
```

Build the project into a folder called `public` with the command
```sh
broccoli build public
```

And our project should look like this:

```
myproject
├── Brocfile.js
├── package.json
├── public
│   └── stylesheets
│       └── master.css
└── src
    ├── _config.scss
    ├── master.scss
    └── my-module.scss
```

And our solitary CSS file will be just what we wanted:

```scss
.my-module {
  color: #8AD455; }
```
