# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.0.2](https://github.com/linkedin/eyeglass/compare/eyeglass@3.0.1...eyeglass@3.0.2) (2020-09-07)

**Note:** Version bump only for package eyeglass





# 3.0.1

* Performance optimizations. Contributed by @mikrostew.

# 3.0.0

## New Features

* Eyeglass now works with the pure javascript version of `dart-sass`, which is
  reference implementation of the Sass language. This allows users of Eyeglass
  to use the latest and greatest language features of Sass and to avoid libraries
  that use native extensions.

  To use: Add `sass` as a dependency of your project. Eyeglass will
  automatically use dart sass when `node-sass` isn't installed. If, for some
  reason you need to have both installed, just set the
  `eyeglass.engines.sass` option to the value returned by `require('sass')`.

## Breaking Changes

* `node-sass` is no longer a direct dependency of Eyeglass. Applications using
  Eyeglass must now install the sass implementation and version that they
  prefer. Eyeglass will attempt to require both `node-sass` and `sass` unless
  a sass engine is explicitly passed as an option. In the case where both are
  installed, `node-sass` is used.
* The `deasync` library is no longer a direct dependency of Eyeglass.
  Applications that use `sass.renderSync()` might need to install the
  `deasync` library if they use eyeglass modules that publish asynchronous
  sass functions.
* Manually specified modules no longer take precedence over modules discovered
  via node package dependencies. [More Information](https://github.com/linkedin/eyeglass/commit/9d9500abd90414ea9bec7c60465f2bdd42e496ef).
* The following deprecated APIs have been removed:
  * `require('eyeglass').Eyeglass`. Instead you should do: `const Eyeglass = require('eyeglass'); new Eyeglass(sassOptions);`
  * `const decorate = require('eyeglass').decorate` - Instead you should do `const decorate = require('eyeglass'); const decoratedOpts = decorate(sassOptions)`.
  * `(new require('eyeglass').Eyeglass()).sassOptions()` - Instead you should do `const Eyeglass = require('eyeglass'); let eyeglass = new Eyeglass(sassOptions); eyeglass.options`.
  * Passing the node-sass engine to Eyeglass as an argument will now raise an
    error. Instead pass it to Eyeglass via the `eyeglass.engines.sass` option.
  * Reading or writing to `Eyeglass#enableImportOnce` will now throw an error.
    Instead access it via the option: `eyeglass.enableImportOnce`.
  * `eyeglass.assets.AssetCollection` - Use `eyeglass.assets.export()` instead.
  * `eyeglass.assets.AssetPathEntry` - Use `eyeglass.assets.addSource()` instead.
* The following deprecated options will now cause an error:
  * `root` - Use `eyeglass.root` instead.
  * `httpRoot` - Use `eyeglass.httpRoot` instead.
  * `cacheDir` - Use `eyeglass.cacheDir` instead.
  * `buildDir` - Use `eyeglass.buildDir` instead.
  * `strictModuleVersions` - Use `eyeglass.strictModuleVersions` instead.
  * `assetsHttpPrefix` - Use `eyeglass.assets.httpPrefix` instead.
  * `assetsRelativeTo` - Use `eyeglass.assets.relativeTo` instead.

# 2.5.1

* Performance optimizations. Contributed by @mikrostew.

# 2.5.0

* Node version 8 is now deprecated. Support for node 6, 8, and 11 will be
  removed in the `3.0.0` release.
* Eyeglass will now emit warnings if the same eyeglass module is found in the
  node module tree at different major versions. For projects with
  `strictModuleVersions` set to `true`, those warnings will become errors in the
  `3.0.0` release.

# 2.4.2

* Node versions 6 and 11 are now deprecated and will be removed in
  3.0.0. While the code should still work on node 6, our testing
  infrastructure in CI no longer runs on node 6, so our policy for node
  6 support going forward will be that we will fix regressions if they
  occur.

# 2.4.1

* Performance optimization for asset import and registration for modules with a
  large number of assets.

# 2.4.0

* Adds option `disableStrictDependencyCheck` - which allows eyeglass modules to
  import sass files from eyeglass modules anywhere in the dependency tree. This
  is not recommended, but sometimes with manual module declarations or peer
  dependencies it makes sense.
* Properly lists 'heimdalljs' as a runtime dependency instead of a
  dev dependency.

# 2.3.1

* Fixes a bug in eyeglass module resolutions that only occurred in the rare
  case that an app's name collides with a eyeglass module's name.

# 2.3.0

**Performance Enhancements:** This release addresses a number of performance
bottlenecks in eyeglass that are especially noticeable when using eyeglass at
scale. Please note that many of these fixes require you to pass new options
to eyeglass in order to access them.

* Some functions are optimized globally now by using a process-level cache.
  If your builds are very frequent with a long-running eyeglass process, you
  will want to call `Eyeglass.resetGlobalCaches()` between builds to ensure
  the build is consistent. If you are using eyeglass with ember-cli-eyeglass
  this is done automatically for you.
* `buildCache` option - A new option to eyeglass allows you to pass a cache
  to eyeglass where it will store information about and contents of files to
  avoid hitting the disk too often for frequently accessed files. The simplest
  cache is an ES2015 `Map` object. For large builds, something like
  [lru-cache](https://github.com/isaacs/node-lru-cache) may be a better choice.
  The buildCache store should be cleared between builds runs. If you are
  using eyeglass with ember-cli-eyeglass this option is passed automatically
  for you.

# 2.2.2

* This release adds heimdall metrics collection for performance analysis.

# 2.2.1

* The method for finding a module that contains a given file was changed to be more efficient by avoiding filesystem access. This also fixes a bug in ember-cli-eyeglass.

# 2.2.0
* Adds eyeglass option `assertEyeglassCompatibility` - A general option
  for making any older eyeglass addons work with the current version of
  eyeglass when the eyeglass version the addon declares that it `needs`
  doesn't match. This can be set to any semver range specifier.
* Defaults the value of `assertEyeglassCompatibility` to `^2.0.0` because
  eyeglass `2.2` is API compatible with addons which were expected to work
  with Eyeglass `^1.x`.

# 2.1.0
* `eyeglass` has been ported to TypeScript. Official type definitions for TypeScript users are now available with each release.
