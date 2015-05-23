# eyeglass Documentation

**I want to use eyeglass in my `node-sass` project**
* [Introduction: How eyeglass works](#introduction-how-eyeglass-works)
* [Troubleshooting eyeglass errors](TROUBLESHOOTING.md)
* [Getting started](getting_started/index.md)
  * [Requirements](getting_started/index.md#requirements)
  * [Installing eyeglass modules](getting_started/index.md#installing-eyeglass-modules)
  * [Using a build plugin](getting_started/index.md#using-a-build-plugin) (grunt, gulp, etc)
  * [Using eyeglass directly with node-sass](getting_started/index.md#using-eyeglass-directly-with-node-sass)
    * [All eyeglass options](api/eyeglass_options.md)
    * [node-sass options](https://github.com/sass/node-sass#options) (external link)
* [Writing an eyeglass module](eyeglass_modules/index.md)
  * [The eyeglass module overview](eyeglass_modules/index.md#eyeglass-folder-structure)
  * [A Yeoman generator](https://github.com/sass-eyeglass/generator-eyeglass) (external link)
  * [A sample eyeglass module](https://github.com/sass-eyeglass/eyeglass-sample) (external link)
  * [Adding Sass mixins to an eyeglass module](eyeglass_modules/index.md#custom-mixins)
  * [Adding Custom Functions to an eyeglass module](eyeglass_modules/index.md#custom-functions)
  * [eyeglass support for existing Sass projects](eyeglass_modules/index.md#bringing-eyeglass-to-existing-projects)
* Integrating eyeglass
  * [Using PostCSS With Eyeglass](integrations/postcss.md)
  * [Using Grunt](integrations/grunt.md)
* [Why eyeglass?](why_eyeglass.md)

# Introduction: How eyeglass works

When we set out to create eyeglass, we wanted to create a system that took the best parts of the Sass language and community, and sprinkled in a really good dependency management system. While it might have been possible to create a dependency management system, repository, and website all on our own `node-sass` development was taking off. With Custom Functions implemented, there was no reason npm couldn't become the ecosystem for distributing and consuming Sass modules for `node-sass`.

To avoid creating any additional tools, we **wrap node-sass options** with an eyeglass constructor. This allows eyeglass to scan your `node_modules`, looking for any additional eyeglass modules that are installed. Before compiling, all eyeglass modules made discoverable through the use of a custom importer, and all Custom Functions are added to the `functions` object of `node-sass`. This lets you pull in `node-sass` friendly libraries via `npm` and add them to your project by just listing them in your `package.json` file.

As we continue to design and evolve eyeglass, you can see a log of our philosophy in the [Why eyeglass](why_eyeglass.md) doc.
