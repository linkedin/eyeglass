# eyeglass Options API


All node-sass options can be passed into eyeglass. Eyeglass-specfic options are:

## root

The directory from which the script runs. Changing this allows eyeglass to run from a directory other than the app root. Defaults to the current working directory.

## buildDir

Specifies where assets are installed to expose them according to their output url. Note that assets will not be installed if `buildDir` is not specified, unless you provide a custom installer.

## cacheDir

A cross-build cache directory for eyeglass modules to save files. For example, generated spritemaps from the [eyeglass spriting module](https://github.com/sass-eyeglass/eyeglass-spriting) are saved here. Defaults to a hidden directory called `.eyeglass-cache`.

## assetsHttpPrefix

A prefix to give assets for their output url.
