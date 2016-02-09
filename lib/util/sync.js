/**
 * Custom function wrapper to ensure sync/async compatibility
 * ---
 * In the docs for render() and renderSync(), custom functions behave
 * differently. However, we want eyeglass custom functions to act just like
 * importers, always receiving an optional `done()` argument at the end. A
 * developer can either asynchronously call `done()` or they can return a
 * value in a synchronous manner.
 *
 * To make this work, we rely on the `deasync` library to turn an event loop
 * while holding a C level `sleep()` open. This allows an async function to
 * resolve without having to run a fiber through the entire node-sass project.
 *
 * The original problem and solution can be found on stack overflow:
 * http://stackoverflow.com/questions/21819858/how-to-wrap-async-function-
 * calls-into-a-sync-function-in-node-js-or-javascript
 */
"use strict";

var deasync = require("deasync");
function sync(fn) {
  return function() {
    var result;
    var args = [].slice.call(arguments, 0);
    var last = args[args.length - 1];

    // last arg is a function (async capture)
    if (typeof last === "function") {
      return fn.apply(fn, args);
    }

    // last arg is not a function (synchronous mode)
    // for some reason, there is a bridge object that shouldn't be on the args
    // replace it with our custom callback
    // turn the loop once, and then begin blocking until we resolve
    function cb(res) {
      setTimeout(function() {
        result = res;
      }, 0);
    }

    args.pop();     // bridge object BAD
    args.push(cb);  // capture callback GOOD
    result = fn.apply(fn, args);

    if (result) {
      return result;
    }
    while (!result) {
      deasync.runLoopOnce();
    }

    return result;
  };
}

sync.all = function(obj) {
  for (var name in obj) {
    obj[name] = sync(obj[name]);
  }
  return obj;
};

module.exports = sync;
