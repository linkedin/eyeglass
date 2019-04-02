# 6.2.0

* Upgrades broccoli-eyeglass to `5.1.1`.
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

