"use strict";

var sass = require("node-sass");
var path = require("path");
var Eyeglass = require("../lib");
var testutils = require("./testutils");
var assert = require("assert");
var fs = require("fs");

describe("fs", function () {
  it("can resolve the identifier 'root' to the project root", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  absolute: fs-absolute-path(root, 'images/foo.png'); }";
    var expected = "fs {\n" +
                   "  absolute: " + path.join(rootDir, "images", "foo.png") + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("resolves stdin as the current working directory", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");
    var pwd = path.resolve(".");

    var input = "@import 'fs(stdin)';" +
                "fs {" +
                "  absolute: fs-absolute-path(stdin, 'images/foo.png'); }";
    var expected = "fs {\n" +
                   "  absolute: " + path.join(pwd, "images", "foo.png") + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("resolves current file's directory", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var input = "@import 'fs(my-id)';" +
                "fs {" +
                "  absolute: fs-absolute-path(my-id, 'images/foo.png'); }";
    var expected = "fs {\n" +
                   "  absolute: " + path.join(rootDir, "sass", "images", "foo.png") + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "sass", "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("can join path segments", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var input = "@import 'eyeglass/fs';" +
                "fs {" +
                "  joined: fs-join('images', 'foo.png'); }";
    var expected = "fs {\n" +
                   "  joined: " + path.join("images",  "foo.png") + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir
      },
      data: input,
      file: path.join(rootDir, "sass", "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("exposes the path separator", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var input = "@import 'eyeglass/fs';" +
                "fs {" +
                "  sep: $fs-path-separator }";
    var expected = "fs {\n" +
                   "  sep: " + path.sep + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "sass", "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });


  it("can check if a file exists", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var input = "@import 'fs(my-id)';" +
                "fs {" +
                "  absolute: fs-absolute-path(my-id, 'images/foo.png');" +
                "  exists: fs-exists(fs-absolute-path(my-id, 'uses_mod_1.scss'));" +
                "  missing: fs-exists(fs-absolute-path(my-id, 'images/foo.png'));" +
                "}";
    var expected = "fs {\n" +
                   "  absolute: " + path.join(rootDir, "sass", "images", "foo.png") + ";\n" +
                   "  exists: true;\n" +
                   "  missing: false; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "sass", "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("can check if a file exists in the sandbox", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var input = "@import 'fs(my-id)';" +
                "fs {" +
                "  absolute: fs-absolute-path(my-id, 'images/foo.png');" +
                "  exists: fs-exists(fs-absolute-path(my-id, 'uses_mod_1.scss'));" +
                "  missing: fs-exists(fs-absolute-path(my-id, 'images/foo.png'));" +
                "}";
    var expected = "fs {\n" +
                   "  absolute: " + path.join(rootDir, "sass", "images", "foo.png") + ";\n" +
                   "  exists: true;\n" +
                   "  missing: false; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "sass", "uses_mod_1.scss"),
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("should allow a string to be passed to fsSandbox option", function (done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var input = "@import 'fs(my-id)';" +
                "fs {" +
                "  absolute: fs-absolute-path(my-id, 'images/foo.png');" +
                "  exists: fs-exists(fs-absolute-path(my-id, 'uses_mod_1.scss'));" +
                "  missing: fs-exists(fs-absolute-path(my-id, 'images/foo.png'));" +
                "}";
    var expected = "fs {\n" +
                   "  absolute: " + path.join(rootDir, "sass", "images", "foo.png") + ";\n" +
                   "  exists: true;\n" +
                   "  missing: false; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "sass", "uses_mod_1.scss"),
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("cannot access check existence of file outside the security sandbox", function(done) {
    var rootDir = testutils.fixtureDirectory("app_assets");

    var input = "@import 'fs(my-id)';" +
                "fs {" +
                "  illegal: fs-exists(fs-absolute-path(my-id, '..', '..', '..'));" +
                "}";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "sass", "uses_mod_1.scss"),
    });


    var expectedError = {
      message: "Security violation: Cannot access " + path.resolve(rootDir, "..", "..")
    };
    testutils.assertCompilationError(eg, expectedError, done);
  });

  it("can list files in a directory", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  files: inspect(fs-list-files(fs-absolute-path(root), '*'));" +
                "}";
    var expected = "fs {\n" +
                   "  files: " + ["a.txt", "b.pdf"].join(", ") + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("can list files in a directory without providing a glob", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  files: inspect(fs-list-files(fs-absolute-path(root)));" +
                "}";
    var expected = "fs {\n" +
                   "  files: " + ["a.txt", "b.pdf"].join(", ") + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("hidden files are not listed unless explicitly requested", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  files: fs-list-files(fs-absolute-path(root), '.*');" +
                "}";
    var expected = "fs {\n" +
                   "  files: " + [".hidden.txt"].join(", ") + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("can list directories in a directory that's in the sandbox", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  dirs: inspect(fs-list-directories(fs-absolute-path(root), '**/*'));" +
                "}";
    var expected = "fs {\n" +
                   "  dirs: " + ["subdir", "subdir/subsubdir"].join(", ") + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("can parse a filename", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'eyeglass/fs';" +
                "$filename: fs-parse-filename('/foo/bar.baz');" +
                "fs {\n" +
                "  basename: map-get($filename, base);\n" +
                "  dirname: map-get($filename, dir);\n" +
                "  filename: map-get($filename, name);\n" +
                "  extension: map-get($filename, ext);\n" +
                "  is-absolute: map-get($filename, is-absolute);\n" +
                "}";
    var expected = "fs {\n" +
                   "  basename: bar.baz;\n" +
                   "  dirname: /foo;\n" +
                   "  filename: bar;\n" +
                   "  extension: .baz;\n" +
                   "  is-absolute: true; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("can get info about a path", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "$info: fs-info(fs-absolute-path(root, 'a.txt'));" +
                "fs {\n" +
                "  modification-time: map-get($info, modification-time);\n" +
                "  creation-time: map-get($info, creation-time);\n" +
                "  is-file: map-get($info, is-file);\n" +
                "  is-directory: map-get($info, is-directory);\n" +
                "  real-path: map-get($info, real-path);\n" +
                "  size: map-get($info, size);\n" +
                "}";

    var statFile = path.join(rootDir, "a.txt");
    var stats = fs.statSync(statFile);

    var expected = "fs {\n" +
                   "  modification-time: " + stats.mtime.getTime() + ";\n" +
                   "  creation-time: " + stats.birthtime.getTime() + ";\n" +
                   "  is-file: " + stats.isFile() + ";\n" +
                   "  is-directory: " + stats.isDirectory() + ";\n" +
                   "  real-path: " + fs.realpathSync(statFile) + ";\n" +
                   "  size: " + stats.size + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_mod_1.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("cannot get info about a path that's outside the sandbox", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  error: fs-info(fs-absolute-path(root, '..'));" +
                "}";

    var expectedError = {
      message: "Security violation: Cannot access " + path.resolve(rootDir, "..")
    };

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "haserror.scss")
    });

    testutils.assertCompilationError(eg, expectedError, done);
  });

  it("cannot list directories in a directory that's outside the sandbox", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  dirs: inspect(fs-list-directories(fs-absolute-path(root), '../../f*'));" +
                "}";

    var expectedError = {
      message: "Security violation: Cannot access ../../fixtures/"
    };

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_mod_1.scss")
    });

    testutils.assertCompilationError(eg, expectedError, done);
  });

  it("can read a file", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "$contents: fs-read-file(fs-absolute-path(root, 'a.txt'));" +
                "fs {\n" +
                "  contents: $contents;\n" +
                "}";

    var file = path.join(rootDir, "a.txt");
    var contents = fs.readFileSync(file);

    var expected = "fs {\n" +
                   "  contents: " + contents.toString() + "; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_mod_1.scss")
    });

    assert.deepEqual(eg.options.eyeglass.fsSandbox, [rootDir]);

    testutils.assertCompiles(eg, expected, done);
  });

  it("cannot get info about a path that's outside the sandbox", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  error: fs-info(fs-absolute-path(root, '..', '..', 'foo.txt'));" +
                "}";

    var expectedError = {
      message: "Security violation: Cannot access " + path.resolve(rootDir, "..", "..", "foo.txt")
    };

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "haserror.scss")
    });

    testutils.assertCompilationError(eg, expectedError, done);
  });

  it("works within files that were imported", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'subdir/imported';";

    var expected = ".imported {\n  should-be-true: true;\n  should-be-false: false; }\n";

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "uses_import_with_fs.scss")
    });

    testutils.assertCompiles(eg, expected, done);
  });

  it("should throw security violation on files outside of the sandbox", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");
    var parentDir = path.dirname(rootDir);

    var input = "@import 'eyeglass/fs'; /* #{fs-list-files('" + parentDir + "')} */";

    var expectedError = {
      message: "Security violation: Cannot access " + parentDir
    };

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "haserror.scss")
    });

    testutils.assertCompilationError(eg, expectedError, done);
  });

  it("should throw security violation on files outside of the sandbox (via glob)", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'eyeglass/fs';"
              + "/* #{fs-list-files('" + rootDir + "', '../../../package.json')} */";

    var expectedError = {
      message: "Security violation: Cannot access ../../../package.json"
    };

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "haserror.scss")
    });

    testutils.assertCompilationError(eg, expectedError, done);
  });

  it("should throw violation outside the sandbox (fs-read-file)", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");
    var file = path.join(rootDir, "../../../package.json");

    var input = "@import 'eyeglass/fs';"
              + "/* #{fs-read-file('" + file + "')} */";

    var expectedError = {
      message: "Security violation: Cannot access " + file
    };

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "haserror.scss")
    });

    testutils.assertCompilationError(eg, expectedError, done);
  });

  it("should throw if path not registered", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "/* #{fs-absolute-path(invalid-path)} */";

    var expectedError = {
      message: "No path is registered for invalid-path"
    };

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: true,
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "haserror.scss")
    });

    testutils.assertCompilationError(eg, expectedError, done);
  });

  it("should throw if an invalid fsSandbox option is passed", function (done) {
    var rootDir = testutils.fixtureDirectory("filesystem");

    var input = "@import 'fs(root)';" +
                "fs {" +
                "  error: fs-info(fs-absolute-path(root, '..', '..', 'foo.txt'));" +
                "}";

    var expectedError = {
      message: "unknown value for sandbox"
    };

    var eg = new Eyeglass({
      eyeglass: {
        root: rootDir,
        fsSandbox: {}, // invalid value for fsSandbox (must be Array, String, or `true`)
        engines: {
          sass: sass
        }
      },
      data: input,
      file: path.join(rootDir, "haserror.scss")
    });

    testutils.assertCompilationError(eg, expectedError, done);
  });
});
