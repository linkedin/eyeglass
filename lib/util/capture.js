"use strict";

module.exports = function(callback, stream) {
  if (!stream) {
    stream = "stdout";
  }

  var oldWrite = process[stream].write;

  process[stream].write = (function(write) {
    return function(string, encoding, fd) {
      callback(string, encoding, fd, function(/*s*/) {
        write.apply(process[stream], arguments);
      });
    };
  })(process[stream].write);

  return function() {
    process[stream].write = oldWrite;
  };
};
