## Some Example Broccoli-Eyeglass Configurations

You can run all these examples yourself from under the `examples` directory.


### Example 1: As Little Configuration as Possible

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
.
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
.
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
