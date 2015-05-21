# Writing an eyeglass Module

Writing an eyeglass module is a great way to both learn eyeglass and take common Sass code and make it reusable and managable from a dependency perspective. If you want to jump right in, we recommend referencing the [sample module](https://github.com/sass-eyeglass/eyeglass-sample) or using the [Yeoman generator](https://github.com/sass-eyeglass/generator-eyeglass).

# eyeglass Folder Structure

An eyeglass module consists of (at a minimum) the following:

```
/my-eyeglass-module <directory>
  /package.json
  /eyeglass-exports.js
  /scss <directory>
```

eyeglass modules are node.js modules, and in order to work with npm, they need a `package.json` file. You can quickly create one using the `npm init` command and accept the default options. While we won't go into all the details of `package.json` here, the [npm package.json documentation](https://docs.npmjs.com/files/package.json) is really complete.

If you don't like `eyeglass-exports.js` and want to be more node-like, feel free to change it to `index.js`. You'll just set the [main property](https://docs.npmjs.com/files/package.json#main) in `package.json` accordingly.

The `scss` directory is optional, but many common eyeglass modules provide Sass files, so it might be good to make the directory ahead of time.

# Adding "eyeglass" to package.json

The next step is to add the `eyeglass` section to package.json. This gives eyeglass important information about your module, including compatibility information and key overrides.

```js
// ...
  "eyeglass": {
    "needs": "<eyeglass version>",
    "exports": "<optional: alternate exports>"
  }
```

Currently, the `eyeglass` section contains two properties, `needs` and `exports`.

  * **needs**: A semantic version string. This defines the version of eyeglass you are compatible with. When developing, you can set the string to `"*"`, but before releasing the module to the public, you'll probably want to set it to a minimum compatible version. We usually recommend people take the Major + Minor approach, much like npm. This means if eyeglass is currently `1.0.6`, you can put a `^` in front and write your `needs` as `^1.0.6`. This means you'll work with eyeglass versions 1.0.6 and newer, but not versions so new that APIs you depend on are broken.
  * **exports**: An optional string. When you already have a `main` property (common for existing npm projects) and you just want to add support for eyeglass, you can specify an alternate property here. Eyeglass will look for `eyeglass.exports` before checking `main`, so that we always include the right thing.

# eyeglass-exports.js

The `eyeglass-exports.js` file is used at runtime to figure out information regarding your npm module. This lets Sass search paths, Custom Functions, and importers come into the picture as late as possible. A complete overview of the `eyeglass-exports.js` looks like this:

```js
"use strict";

module.exports = function(eyeglass, sass) {
  return {
    sassDir: "<DIRECTORY>",
    functions: {}
  };
};
```

The goal of `eyeglass-exports.js` is to create a module that is a function. The function receives `eyeglass` (the environment), and `sass` (the Sass utilities). When the function is called, it should return an object literal. All items in the return object are optional: these are the eyeglass features your module provides.

* **sassDir**: A directory string. This is the path to your `.sass` or `.scss` files. Many developers use the `path` module and `__dirname` in combination, setting `sassDir: require("path").resolve(__dirname, "scss")` and letting node do all the work.
* **functions**: An object collection. Functions in eyeglass work the same as in `node-sass`. We'll cover Custom Functions in more detail below.

# Custom Mixins
Since anything in **sassDir** becomes available to your `.scss` and `.sass` files via `@import`. When someone calls `@import my-eyeglass-module` from their Sass files, it will automatically resolve to this directory. This is identical to the the Sass [load paths](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#load_paths-option) in the ruby version.

# Custom Functions
Custom Functions in eyeglass work like their `node-sass` counterparts. In addition, eyeglass will ensure there are no conflicts between function signatures for you. Each item in the Custom Functions collection has two parts, its signature and its callback.

It's easier to explain with an example.

```js
  functions: {
    'hello($name: "World")': function(name, done) {
      done(sass.types.String("Hello, " + name.getValue() + "!"));
    }
  }
```

First up, the **signature**, which is the Object's key. In the signature, write the function as if you were writing a Sass mixin. Breaking the example down, we have the following parts:

* **hello(**: this is the custom function name. Whenever someone calls `hello()` in their `.scss` or `.sass` file, it'll run this function.
* **$name**: we want `hello()` to take a single variable, which we're going to call `name`. The `$` is a Sass language convention for variables.
* **: "World"**: defaults! If you call `hello()` with no arguments, it'll set the `name` variable to `"World"`. Sass automatically takes care of Strings and Numbers for you.
* **)**: ends the function definition. So we have two ways to call `hello()`. The first is with no arguments, and the second is with a single argument: `hello(Steve)`. Because it's Sass, we can also pass arguments into `hello()` by name: `hello($name: "Steve")` and it'll work as expected.

The **callback** associated with the function takes **N** arguments, where "N" was the number of variables you asked for in the **signature**. In our case, we only have 1 (`name`), so we'll only get 1 in the **callback**. The final argument in the **callback** is **done**. This function takes a single argument and tells `node-sass` that we've finished everything. We give it some `node-sass` friendly information.

The **sass.types** collection comes from that second argument in our `module.exports` function.

```js
done(sass.types.String("Hello, " + name.getValue() + "!"));
```

* **sass.types.TYPE**: All things we pass back to `node-sass` have a `TYPE`. This tells Sass what we're dealing with, and also allows for cool Sass features like applying math to px/em/rem and having it _just work_. A full list is in the [node-sass documentation](https://github.com/sass/node-sass#functions--v300---experimental), but the three most common are `sass.types.Number(amount, unit)`, `sass.types.String(value)`, and `sass.types.Color(red, green, blue, alpha)`. If you don't want to return anything, you can return `sass.types.Null()`.
* **name.getValue()**: Since we asked for `$name` in the **signature** and put quotes around it, `node-sass` knows to make this a String for us. Calling `.getValue()` returns the value as a String. For a String, that's not very exicitng. However, for values like "24px", `node-sass` will automatically split the result (and provide `.getValue()` and `.getUnit()`).

That's a lot for one little function! Remember:

1. A Custom Function consists of a **signature** and a **callback**
2. Write the **signature** as if you were defining the function in a Sass file. Include sensible defaults
3. Write the **callback** as a standard asynchronous function. Use the **sass.types** collection to manipulate the Sass information. Call **done** when you've finished your work.

# Bringing eyeglass To Existing Projects
If you already have a Sass project, adding eyeglass support is straightforward. First, create a `package.json` if you don't have one already. Second, create an `eyeglass-exports.js` and point **sassDir** to the root location of your `.sass` or `.scss` files. Third, point your `main` or `eyeglass.exports` property (in `package.json`) to the `eyeglass-exports.js` file. Finally, `npm publish` to make your module available.

Take a look at [Susy](https://github.com/ericam/susy/) and [Susy's eyeglass-exports.js](https://github.com/ericam/susy/blob/master/eyeglass-exports.js) for an example of how you can easily add eyeglass to an established project.
