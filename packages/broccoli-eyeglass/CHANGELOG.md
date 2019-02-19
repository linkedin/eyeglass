# 4.5.0

* Broccoli-eyeglass has been ported to TypeScript. Official type definitions are now available with each release for TypeScript users.
* Imports from eyeglass that resolve to a filename that is not a file are no longer attempted to be read from disk saving some disk access overhead common in eyeglass projects.

# 1.2.4

* Eyeglass 0.8 deprecated several APIs, this release upgrades eyeglass
  and uses the new, non-deprecated APIs. No API changes to
  broccoli-eyeglass at this time.

* Use node-sass 3.4.2 now that regressions have been fixed.

# 1.2.3

* Lock down node-sass to 3.3 until node-sass regressions in 3.4 can be fixed.

# 1.2.2

* Fix bug where only the first asset location is registered.
  [Pull Request](https://github.com/sass-eyeglass/broccoli-eyeglass/pull/20)
