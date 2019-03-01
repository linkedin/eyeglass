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
