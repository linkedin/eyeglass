# Troubleshooting eyeglass Problems

Since eyeglass depends on `node-sass` (which in turn depends on `libsass`), there's a number of moving parts. This troubleshooting guide is designed to help tackle some of the most common issues that come up with eyeglass + node-sass + libsass.

# npm ERR! not ok code 0
This happens during your `npm install` process, and in our case is almost certainly related to the building of `node-sass` / `libsass`. If you scroll up, you'll probably also see a line `gyp ERR! not ok`. The way node.js integrates with C++ libraries is that it'll first check for a binary that matches your computer's OS. If it can't find one, it'll build it on demand. It's that second part where things usually go wrong.

If you've got a `gyp ERR`, take a look at the [open gyp issues for node-sass](https://github.com/sass/node-sass/search?o=desc&q=gyp&s=updated&state=open&type=Issues&utf8=✓). If you still don't see anything, please create a ticket and both use and the `node-sass` folks will figure out what's up.

If there is no sign of `gyp ERR` anywhere in your install log, then [file an issue](https://github.com/sass-eyeglass/eyeglass/issues) and paste your `npm install` log. It's probably broken for a lot of people. =\
