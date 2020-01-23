# 5.4.1

* Node versions 6 and 11 are now deprecated and will be removed in
  Eyeglass 3.0.0 (broccoli-eyeglass 6.0.0). While the code should still
  work on node 6, our testing infrastructure in CI no longer runs on node
  6, so our policy for node 6 support going forward will be that we will
  fix regressions if they occur.

# 5.4.0

* Respect `UV_THREADPOOL_SIZE` if it is set, and if it is not set, set it to take better advantage of concurrency features of `node-sass`. The `SASS_JOBS` environment variable can be used specify the concurrency of sass compilation. By default broccoli-eyeglass will set `UV_THREADPOOL_SIZE` to the number of real cores in a machine and use all of those threads for Sass compilation. `UV_THREADPOOL_SIZE` is not set unless it would be greater than the default value of 4. See [this PR](https://github.com/linkedin/eyeglass/pull/233) for more information.

# 5.3.0

* Upgrades `eyeglass` to `2.4.1`.
* Setting `DEBUG=broccoli-eyeglass:results` will enable verbose output.

# 5.2.0

* Upgrades `eyeglass` to `2.4.0`.

# 5.1.1

* Changes how persistent cache invalidation is performed for eyeglass modules
  that are marked as `inDevelopment`. Eyeglass modules that doubled as
  application code would end up invalidating the sass file cache very
  frequently and unnecessarily. Instead of considering all JS in the addon
  and its dependencies, now only a minimal set of javascript files that are
  known to be involved with Sass compilation are considered.

# 5.1.0

**Performance Enhancements**: this release has a number of performance
enhancements in it. Some you get for free, others require you to

* `sessionCache` option - This option allows broccoli to use an external
  cache for compiling several broccoli trees. File information is stored
  in these caches, so it should be cleared between builds.
* `additional-output` event - This event now accepts additional arguments
  that allow additional output that is outside of the broccoli tree to
  participate in the persistent cache restoration process.
  `ember-cli-eyeglass` uses this to avoid repeatedly writing the same
  files during `asset-uri()` calls which results in considerable savings for
  files that are referenced frequently.
* `stale-external-output` event - This new event is fired when a file
  that was output external to the broccoli tree is possibly stale and
  in need of deletion.
* `cached-asset` event - This new event is fired when a file that was output
  external to the broccoli tree needs to be restored from cache. The new
  arguments received from `additional-output` are returned to it so the file
  can be recreated.

# 5.0.2

* This release adds heimdall metrics collection for performance analysis.
* Depends on `eyeglass@2.2.2` or greater.

# 5.0.1

* Picks up a change in eyeglass that makes it work better in broccoli-based projects.

# 5.0.0

* Depends on `eyeglass` version `2.2.0` or greater.

# 4.5.2

* Revert eyeglass dependency bump.

# 4.5.1

* Bump dependency on `eyeglass` to `2.1.0`

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
