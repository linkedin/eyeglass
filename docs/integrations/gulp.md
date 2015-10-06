# Working With Gulp
[Gulp](http://gulpjs.com) is a JavaScript task runner, frequently used for building your site's JavaScript, CSS, and more. Because there is a [gulp-sass](https://github.com/dlmanning/gulp-sass) plugin that uses `node-sass`, we can integrate eyeglass by using its `require` to wrap the `node-sass` options.

Additionally, to avoid any problems with `node-sass`, you should provide a default `importer` value. `gulp-sass` provides access to the sass compiler in use via the `compiler` property.

```js
var gulp = require("gulp");
var sass = require("gulp-sass");
var Eyeglass = require("eyeglass").Eyeglass;
var sassOptions = {}; // put whatever eyeglass and node-sass options you need here.

var eyeglass = new Eyeglass(sassOptions);

// Disable import once with gulp until we
// figure out how to make them work together.
eyeglass.enableImportOnce = false

gulp.task("sass", function () {
  gulp.src("./sass/**/*.scss")
    .pipe(sass(eyeglass.sassOptions()).on("error", sass.logError))
    .pipe(gulp.dest("./css"));
});
```
