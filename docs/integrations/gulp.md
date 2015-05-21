# Working With Gulp
[Gulp](http://gulpjs.com) is a JavaScript task runner, frequently used for building your site's JavaScript, CSS, and more. Because there is a [gulp-sass](https://github.com/dlmanning/gulp-sass) plugin that uses `node-sass`, we can integrate eyeglass by using its `require` to wrap the `node-sass` options.

```js
var gulp = require("gulp");
var sass = require("gulp-sass");

var eyeglass = require("eyeglass")({
  // ... node-sass options
});

gulp.task("sass", function () {
  gulp.src("./sass/**/*.scss")
    .pipe(sass(eyeglass.sassOptions()).on("error", sass.logError))
    .pipe(gulp.dest("./css"));
});
```
