# CHANGELOG

#### 0.7.1 (Nov 16, 2015)

* Fix: Move the `debug` module to runtime dependencies in `package.json`.

#### 0.7.0 (Nov 16, 2015)

* Refactor module discovery to fix [issue #70](https://github.com/sass-eyeglass/eyeglass/issues/70).
* Added console debugging support to address [issue #66](https://github.com/sass-eyeglass/eyeglass/issues/66).
  See [Troubleshooting](TROUBLESHOOTING.md) for details.

#### 0.6.5 (Nov 13, 2015)

* Pick up latest node-sass release that fixes known regressions.

#### 0.6.4 (Oct 28, 2015)

* Locked down the node-sass version due to regressions in node sass and
  libsass releases.

#### 0.6.3 (Oct 13, 2015)

* Handle when the `importer` option to node-sass is an array of
  importers.
* Upgrade dependency on `deasync` to support recent changes in node 4.x.

#### 0.6.2 (Sept 10, 2015)

* Fix a bug when includePaths is an array.
* If the SASS_PATH environment variable is set, default the
  `includePaths` option to it.
* Update all node module dependencies to the latest.

#### 0.6.1 (Sept 09, 2015)

* A runtime dependency was improperly declared in the package.json.

## 0.6.0 (Sept 09, 2015)

* Eyeglass will now import sass files from the node-sass `includePaths` option
  according to eyeglass import semantics (which is a superset of
  node-sass's import semantics).

* Eyelgass modules must now declare the eyeglass version that they need
  to work correctly. Eyeglass projects will issue warnings about
  version incompatibility between eyeglass and the eyeglass module.
  Eyeglass projects can change these to errors by setting
  the eyeglass option `strictModuleVersions` to `true`.
