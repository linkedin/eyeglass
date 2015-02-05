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
* Add additional custom functions to SASS, leveraging the power of npm's small, discrete module philosophy

In Sass, you can reference the eyeglass module with standard Sass import syntax: `@import "<my_eyeglass_module>/file"; The `<my_eyeglass_module>` will be resolved to the correct directory in your node modules, and the file will then resolve using the standard import rules for Sass.

# Writing an eyeglass module with Sass files
To create an eyeglass module with Sass files, place the files inside of a `sass` directory in your npm module.

```
|- /
  |- package.json
  |- sass
    |- _my_file.scss (or .sass)
```

eyeglass will automatically map `@import` calls containing angle brackets `<` and `>` into the corresponding node module directory. Because Sass uses a global namespace, it's recommended that you namespace-prefix any mixins you create in order to avoid collisions.

# Writing an eyeglass module with Custom Functions
node-sass allows you to register custom functions for advanced functionality. Eyeglass allows any node modules that are tagged with `eyeglass-module` to be automatically loaded into eyeglass. To tag your module as an eyeglass module, add the `eyeglass-module` keyword to your `package.json`

```
{
  ...
  "keywords": ["eyeglass-module", "sass", ...],
  "main": "index.js",
  ...
}
```

Your requirable module exports a function which receives the eyeglass object. Inside the function, you can call the eyeglass module API. Below is an example eyeglass module which emulates the [compass headings](http://compass-style.org/reference/compass/helpers/selectors/#append-selector) functionality.

```
module.exports = function(eyeglass, Sass) {
  eyeglass.function('headings($from: 0, $to: 6)', function(from, to, done) {
    var i,
    f = from.getValue(),
    t = to.getValue(),
    list = new Sass.types.List(t - f + 1);
    
    for (i = f; i <= t; i++) {
      list.setValue(i - f, new Sass.types.String('h' + i));
    }
    
    done(list);
  });
};
```

* **eyeglass.function(signature, function)**: This registers a function with eyeglass, making it available to node_sass. The eyeglass interface will check for collisions in custom function names, and when the function is defined multiple times will compare the two functions for similarity. If you attempt to register two different functions with an identical signature, eyeglass will provide you an error and warn you about the collision. While it is possible to run Sass functions synchronously by returning a value instead of providing a `done()` method, we strongly encourage the async nature of node.js and use the callback.
* **eyeglass.isFunction(signature)**: Returns a boolean `true` if this signature has already been registered to eyeglass.
* **Sass.XNXX**: This is a node-sass object. Functions specific to sass' function registration system are removed and their usage is discouraged. If the functions are absolutely necessary, a 3rd paramter (_sass) is available in the exports function and contains the removed functions.

