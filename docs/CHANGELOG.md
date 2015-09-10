# CHANGELOG

# 0.6.0 (Sept 09, 2015)

* Eyeglass will now import sass files from the node-sass `includePaths` option
  according to eyeglass import semantics (which is a superset of
  node-sass's import semantics).

* Eyelgass modules must now declare the eyeglass version that they need
  to work correctly. Eyeglass projects will issue warnings about
  version incompatibility between eyeglass and the eyeglass module.
  Eyeglass projects can change these to errors by setting
  the eyeglass option `strictModuleVersions` to `true`.
