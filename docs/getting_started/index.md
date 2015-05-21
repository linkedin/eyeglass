# Getting Started

# Requirements
To use eyeglass, you'll need at least the following items, which can be installed using the npm utility. Since these items are not used directly in production, you can place them in your dev dependencies.

* **eyeglass** `npm install eyeglass --save-dev`
* **node-sass** `npm install node-sass --save-dev`

Since `node-sass` is based on `libsass` ([link](https://github.com/sass/libsass)), you may need to wait as npm compiles a compatible binary for your operating system. Once everything builds, you're ready to add modules.

# Installing eyeglass modules
Modules for eyeglass are installed just like eyeglass itself, using the npm tool. All eyeglass modules are managed through npm in order to fully take advantage of the node.js environment.

[View a list of all eyeglass modules](https://www.npmjs.com/browse/keyword/eyeglass-module)

To install an eyeglass module, save it to your dev dependencies. In this case, we're going to use the [eyeglass-sample](https://github.com/sass-eyeglass/eyeglass-sample) module, which gives us a CSS class and a Custom Function.

```
npm install eyeglass-sample --save-dev
```

Any eyeglass modules you install will be detected automatically by eyeglass and made available to your Sass files. To remove an eyeglass module, just uninstall it.

```
npm uninstall eyeglass-sample --save-dev
```

# Using a build plugin
The easiest way to make something with eyeglass is to use an existing plugin or solution. Lots of people have made solutions for various build systems. Your favorite is probably below:

* [broccoli-eyeglass](https://github.com/sass-eyeglass/broccoli-eyeglass)
* [ember-cli-eyeglass](https://github.com/sass-eyeglass/ember-cli-eyeglass)

If there isn't a plugin listed above, you can still use eyeglass! It just takes 2-3 more lines of code. Many build tools work with eyeglass and require almost zero changes. In these cases, it doesn't make much sense to add additional plugin code where things could go wrong.

# Using eyeglass directly with node-sass
If you are using a build system such as grunt or gulp, you can use the `node-sass` plugin as-is: [grunt-sass](https://github.com/sindresorhus/grunt-sass) and [gulp-sass](https://www.npmjs.com/package/gulp-sass) respectively. In all systems where you can use a `node-sass` build plugin, the recipe is the same:

1. `var Eyeglass = require("eyeglass");`
2. `var eyeglass = new Eyeglass({ /* sass options */ });`
3. Pass in `eyeglass.sassOptions()` wherever the plugin asked for the original sassOptions

This works because eyeglass is a tool designed to wrap around the `node-sass` options and add a layer of customization based on npm. You can read about the design decisions in [Why eyeglass](../why_eyeglass.md).
