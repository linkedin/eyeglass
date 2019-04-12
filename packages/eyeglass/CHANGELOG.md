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
