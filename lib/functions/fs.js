"use strict";

var fs = require("fs");
var path = require("path");
var glob = require("glob");

// Returns whether a file exists.
function existsSync(file) {
  // This fs method is going to be deprecated but can be re-implemented with fs.accessSync later.
  return fs.existsSync(file);
}

function pathInSandboxDir(fsPath, sandboxDir) {
  if (path.relative(sandboxDir, fsPath).match(/^\.\./)) {
    return false;
  } else {
    return true;
  }
}

module.exports = function(eyeglass, sass) {
  var sassUtils = require("node-sass-utils")(sass);

  function accessViolation(location) {
    return sass.types.Error("Security violation: Cannot access " + location);
  }

  function inSandbox(fsPath) {
    var sandbox = eyeglass.options.eyeglass.fsSandbox;
    // if there are no sandbox restrictions, return true
    if (!sandbox) {
      return true;
    }
    // if we have an array of sanboxes...
    if (Array.isArray(sandbox)) {
      // iterate over them and return true if we find one that is valid
      return sandbox.some(function(sb) {
        if (pathInSandboxDir(fsPath, sb)) {
          return true;
        }
      });
    }

    // if we got here, `fsSandbox` was invalid so throw an error
    throw new Error("unknown value for sandbox");
  }

  function globFiles(directory, globPattern, includeFiles, includeDirectories, done) {
    if (inSandbox(directory)) {
      var globOpts = {
        root: directory,
        cwd: directory,
        mark: true
      };
      glob(globPattern, globOpts, function(error, files) {
        /* istanbul ignore if - we do not need to simulate a glob error here */
        if (error) {
          done(sass.types.Error(error.message));
          return;
        }

        var filesToReturn = [];
        for (var i = 0; i < files.length; i++) {
          var endsWithSlash = /\/$/.test(files[i]);
          if (endsWithSlash && includeDirectories) {
            if (!inSandbox(path.join(directory, files[i]))) {
              done(accessViolation(files[i]));
              return;
            }
            filesToReturn[filesToReturn.length] = files[i].slice(-files[i].length, -1);
          }
          if (!endsWithSlash && includeFiles) {
            if (!inSandbox(path.join(directory, files[i]))) {
              done(accessViolation(files[i]));
              return;
            }
            filesToReturn[filesToReturn.length] = files[i];
          }
        }
        done(sassUtils.castToSass(filesToReturn));
      });
    } else {
      done(accessViolation(directory));
    }
  }

  return {
    "eyeglass-fs-absolute-path($fs-registered-pathnames, $path-id, $segments...)":
      function(fsRegisteredPathnames, fsPathId, fsSegments, done) {
        var pathId = sassUtils.castToJs(fsPathId);
        var segments = sassUtils.castToJs(fsSegments);
        var registeredPathnames = sassUtils.castToJs(fsRegisteredPathnames);
        var expandedPath = registeredPathnames.coerce.get(pathId);
        if (expandedPath) {
          segments.unshift(expandedPath);
          var resolved = path.resolve.apply(null, segments);
          done(sass.types.String(resolved));
        } else {
          done(sass.types.Error("No path is registered for " + pathId));
        }
      },
    "eyeglass-fs-join($segments...)": function(segments, done) {
      var jsSegments = sassUtils.castToJs(segments);
      var joined = path.join.apply(null, jsSegments);
      done(sass.types.String(joined));
    },
    "eyeglass-fs-exists($absolute-path)": function(fsAbsolutePath, done) {
      var absolutePath = fsAbsolutePath.getValue();
      if (inSandbox(absolutePath)) {
        if (existsSync(absolutePath)) {
          done(sass.TRUE);
        } else {
          done(sass.FALSE);
        }
      } else {
        done(accessViolation(absolutePath));
      }
    },
    "eyeglass-fs-path-separator()": function(done) {
      done(sass.types.String(path.sep));
    },
    "eyeglass-fs-list-files($directory, $glob: '*')": function(directory, globPattern, done) {
      globFiles(directory.getValue(), globPattern.getValue(), true, false, done);
    },
    "eyeglass-fs-list-directories($directory, $glob: '*')": function(directory, globPattern, done) {
      globFiles(directory.getValue(), globPattern.getValue(), false, true, done);
    },
    "eyeglass-fs-parse-filename($filename)": function(filename, done) {
      var parsedFilename = path.parse(filename.getValue());
      done(
        sassUtils.castToSass({
          base: parsedFilename.base,
          dir: parsedFilename.dir,
          name: parsedFilename.name,
          ext: parsedFilename.ext,
          "is-absolute": path.isAbsolute(filename.getValue())
        })
      );
    },
    "eyeglass-fs-info($filename)": function(sassFilename, done) {
      var filename = sassFilename.getValue();

      if (inSandbox(filename)) {
        fs.stat(filename, function(err, stats) {
          /* istanbul ignore if - we do not need to simulate an fs error here */
          if (err) {
            done(sass.types.Error(err.message));
          } else {
            try {
              var realpath = fs.realpathSync(filename);

              done(
                sassUtils.castToSass({
                "modification-time": stats.mtime.getTime(),
                "creation-time": stats.birthtime.getTime(),
                "is-file": stats.isFile(),
                "is-directory": stats.isDirectory(),
                "real-path": realpath,
                "size": stats.size,
              })
              );
            } catch (e) {
              /* istanbul ignore next - we do not need to simulate an fs error here */
              done(sass.types.Error(e.message));
            }
          }
        });
      } else {
        done(accessViolation(filename));
      }
    },
    "eyeglass-fs-read-file($filename)": function(sassFilename, done) {
      var filename = sassFilename.getValue();

      if (inSandbox(filename)) {
        fs.readFile(filename, function(err, contents) {
          /* istanbul ignore if - we do not need to simulate an fs error here */
          if (err) {
            done(sass.types.Error(err.message));
          } else {
            done(sassUtils.castToSass(contents.toString()));
          }
        });
      } else {
        done(accessViolation(filename));
      }
    }
  };
};
