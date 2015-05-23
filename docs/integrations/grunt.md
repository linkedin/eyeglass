# Working With Grunt
[Grunt](http://gruntjs.com) is a JavaScript task runner, frequently used for building your site's JavaScript, CSS, and more. Because there is a [grunt-sass](https://github.com/sindresorhus/grunt-sass) plugin that uses `node-sass`, we can integrate eyeglass by using its `require` to wrap the `node-sass` options.

```js
// ...
sass: {
  options: require("eyeglass")({
    sourceMap: true
  }).sassOptions(),
  dist: {
    files: {
      'public/css/main.css': 'sass/main.scss'
    }
  }
}
```

(integration originally posted by [@thomasmattheussen](https://github.com/thomasmattheussen) to the README, copied over)
