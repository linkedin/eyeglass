const testutils = require("./testutils");
const Eyeglass = require("../lib");

describe("Node support", function () {
  describe("Current node version" , function() {
    it("should give a warning if node 6 or 11", function (done) {
      testutils.assertStderr(function(checkStderr) {
        Eyeglass({});
        if (process.version.match(/^v(6|11)/)) {
          checkStderr("[eyeglass:deprecation] (deprecated in 2.4.2, will be removed in 3.0.0) Support for node v6 and node v11.\n");
        } else {
          checkStderr("");
        }
        done();
      });
    });
  });
});