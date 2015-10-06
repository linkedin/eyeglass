# Eyeglass Filesystem API

Due to a limitation of node-sass, sass functions do not know what file
they are in when invoked. To work around this, the filesystem module
has a special import syntax that can be used to register the directory
of the importing file as an identifier that can later be used resolve
paths against.


### Basic Usage Example

```scss
// in file foo.scss
@import "fs(foo-dir)";
// Use fs-join so that your sass files will be portable across filesystem types
$image-relative-path: fs-join("images", "foo.png");
// Compute the absolute path relative to the registered foo-dir
$image-path: fs-absolute-path(foo-dir, $image-location);
// Only absolute paths can be passed to fs-exists()
@if fs-exists($image-path) {
  .something {
    background: url($image-relative-path);
  }
}
```

### API

#### Constant: `$fs-path-separator`

This is the path separator of the current operating system.

#### `@import "fs(identifier)"`

The filesystem importer has a special syntax in the form of `@import
"fs(identifier)"`. The identifier must be a legal CSS IDENT (e.g.
classname). The directory of the sass file will be associated to that
identifier.

It is not allowed to associate different directories to the same path,
any attempt to do so will result in an error. As such, eyeglass modules
that use the filesystem API must namespace their identifiers to avoid
collisions with other modules.

If the current file cannot be determined (E.g. piped through stdin) then
the identiefier will be mapped to the current working directory.

There is a special identifier `root` and it always resolves to the
eyeglass root directory of the project regardless of where it is
imported from (including eyeglass modules).

#### `fs-absolute-path($path-id, $segments...)`

Resolves a path identifier to its absolute location. If any `$segments` are
provided, then they are joined to the absolute path.

The returned path is normalized (removing `.` and `..` as well as
doubled path separators.)

The returned path need not exist.

#### `fs-join($segments...)`

Joins path segments with the path separator.

The returned path is not normalized and need not exist.

#### `fs-exists($absolute-path)`

Returns `true` if the absolute path provided exists. Returns `false`
otherwise.


### Security

By default, sass code is running locally on a dev machine running code
that you wrote, and so security is not a primary concern, but security
vulnerabilities are one of the reasons why Sass has historically avoided
having any sort of filesystem API.

In order to enable services that may run untrusted Sass files, eyeglass
exposes an option `fsSandbox` which can be set to an array of filesystem
paths that can be accessed. All of the Eyeglass functions that read
information from the filesystem will respect this setting. As a
convenience, `fsSandbox` can be set to `true` which will limit access to
the eyeglass project's root directory (which includes the `node_modules`
directory).
