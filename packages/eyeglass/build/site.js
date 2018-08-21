"use strict";

var SiteBuilder = require("eyeglass-dev-site-builder");
var ghPages = require("gulp-gh-pages");
var merge = require("lodash.merge");
var fs = require("fs-extra");

module.exports = function(gulp, depends, root) {

  var site = new SiteBuilder({
    root: root,
    source: "site",
    engines: {
      Handlebars: require("handlebars")
    },
    linkchecker: true
  });

  gulp.task("site", depends, function() {
    return site.build({
      environment: "production"
    });
  });

  gulp.task("site:dev", depends, function() {
    return site.serve();
  });

  gulp.task("site:staging", depends, function() {
    return site.serve({
      environment: "staging"
    });
  });

  function createDeployTask(name, options) {
    options = merge({
      cacheDir: "./tmp/.ghpages"
    }, options);

    gulp.task("site:" + name, depends, function() {
      if (options.clean && options.cacheDir) {
        fs.removeSync(options.cacheDir);
      }

      return gulp.src(site.config.dest + "/**/*")
        .pipe(ghPages(options));
    });
  }

  createDeployTask("deploy", {
    push: true,
    clean: true
  });
  createDeployTask("deploy:dry", {
    push: false
  });

};
