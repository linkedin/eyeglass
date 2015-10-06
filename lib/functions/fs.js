"use strict";

var fs = require("fs");
var path = require("path");

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

  function inSandbox(fsPath) {
    var sandbox = eyeglass.options.fsSandbox;
    if (!sandbox) {
      return true;
    }
    if (Array.isArray(sandbox)) {
      for (var i = 0; i < sandbox.length; i ++) {
        var sb = sandbox[i];
        if (!pathInSandboxDir(fsPath, sb)) {
          return false;
        }
      }
      return true;
    } else {
      throw new Error("unknown value for sandbox");
    }
    return false;
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
          var resolved = path.resolve.apply(path, segments);
          done(sass.types.String(resolved));
        } else {
          done(new Error("No path is registered for " + pathId));
        }
      },
    "eyeglass-fs-join($segments...)": function(segments, done) {
      var jsSegments = sassUtils.castToJs(segments);
      var joined = path.join.apply(path, jsSegments);
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
        done(sass.types.Error("Security violation: Cannot access " + absolutePath));
      }
    },
    "eyeglass-fs-path-separator()": function(done) {
      done(sass.types.String(path.sep));
    }
  };
};
