# 7.0.1

* Updates `eyeglass` to version `3.0.1`.
* Updates `broccoli-eyeglass` to version `6.0.1`.

# 7.0.0

* Updates Eyeglass to version 3.0.0. The 3.0 release of eyeglass now supports
  dart-sass and contains a number of breaking changes. At a minimum, for
  continuity, your project will need to install `node-sass` and ensure that
  you are on, at least, node 10.

  Please read the [Eyeglass CHANGELOG](../eyeglass/CHANGELOG.md).

# 6.5.1
* Updates `eyeglass` to version `2.5.1`.
* Updates `broccoli-eyeglass` to version `5.5.1`.

# 6.5.0

* Updates Eyeglass to version 2.5.0
* Node version 8 is now deprecated and will be removed in Eyeglass 3.0.0.

# 6.4.3

* Node versions 6 and 11 are now deprecated and will be removed in
  eyeglass 3.0.0 (ember-cli-eyeglass 7.0.0). While the code should still
  work on node 6, our testing infrastructure in CI no longer runs on node
  6, so our policy for node 6 support going forward will be that we will
  fix regressions if they occur.

# 6.4.2

* Bug Fix: Install assets into the correct directory when httpRoot
  is set.

# 6.4.1

* Handle older versions of broccoli/ember-cli without an error.

# 6.4.0

* Upgrades broccoli-eyeglass to `5.4.0` which provides
  better sass compilation concurrency on machines with greater than 4 physical cores.
* Provides better error handling when older versions of ember-cli cause compilation errors.

# 6.3.0

* Upgrades broccoli-eyeglass to `5.3.0`.

# 6.2.0

* Upgrades broccoli-eyeglass to `5.2.0`.
* Adds a peerDependency on `ember-cli@^3.5.0` which was
  an implicit peerDependency since `6.1.0`.

# 6.1.1

* Upgrades broccoli-eyeglass to `5.1.1`.
* Some code cleanup.

# 6.1.0

**Performance Enhancements**: this release has a number of performance
enhancements in it for builds at scale.

* The persistent cache will now properly avoid cache collisions in engines and
  addons that have files of the same name when those adddons don't set their
  own value for persistentCache.
* asset installation to urls that are outside of a lazy engine's path will
  now work as intended.

# 6.0.2

* This release adds heimdall metrics collection for performance analysis.
* Depends on `broccoli-eyeglass@5.0.2` and `eyeglass@2.2.2`.

# 6.0.1

* Depends on `broccoli-eyeglass@5.0.1` and `eyeglass@2.2.1`. Fixes an issue with using system tmp directories.

# 6.0.0

* Bump dependency on `broccoli-eyeglass` to `^5.0.0` which moves `eyeglass` to version `^2.2.0`.

# 5.1.1

* Bump dependency on `broccoli-eyeglass` to `^4.5.1`.

# 5.1.0

* `ember-cli-eyeglass` has been ported to TypeScript. Official type definitions for TypeScript users are now available with each release.

# 5.0.0

  * fix asset-url transformation for lazy engines with useDeprecatedIncorrectCssProcesing flag
  * assetHttpPrefix for lazy engines now always includes engines-dist/<engine.name>

# 4.0.0

