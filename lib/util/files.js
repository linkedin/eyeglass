"use strict";

var fs = require("fs");

function existsSync(file) {
  // This fs method is going to be deprecated
  // but can be re-implemented with fs.accessSync later.
  return fs.existsSync(file);
}

function readFile(file, options, callback) {
  setImmediate(function() {
    var data;
    var err;

    try {
      data = fs.readFileSync(file, options);
    } catch (e) {
      err = e;
    }
    callback(err, data);
  });
};

module.exports = {
  existsSync: existsSync,
  readFile: readFile
};
