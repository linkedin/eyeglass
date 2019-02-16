# Welcome to the Eyeglass Monorepo

Eyeglass provides a way to distribute Sass files and their associated assets and javascript extensions via npm such that any build system can be adapted to automatically expose those Sass files to Sass's `@import` directive by just installing the code. If the imported files have references to images or other assets, those will be delivered to the fully-built application with the correct urls.

This monorepo provides:

* [The core Eyeglass library](packages/eyeglass)
* [Broccoli build tool integration](packages/broccoli-eyeglass)
* [Ember CLI integration](packages/ember-cli-eyeglass)

Each package in this monorepo has it's own README that describes how to use it.

If you are a Sass developer looking to distribute your sass files as an eyeglass module you'll want to read the core library documentation for how to configure your npm package to be an eyeglass module.

### Provided by LinkedIn as Open Source Software

This project is provided by the LinkedIn Presentation Infrastructure team as open source software and is licensed under the [Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0). The lead developer is [Chris Eppstein](https://github.com/chriseppstein) ([🐦](https://twitter.com/chriseppstein)).