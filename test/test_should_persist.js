"use strict";

const expect = require("chai").expect;
const shouldPersist = require("../lib/broccoli_sass_compiler").shouldPersist;

describe("shouldPersist", function() {
  it("works", function() {
    expect(shouldPersist({}, false)).to.eql(false, "expect shouldPersis({}, false) === false");
    expect(shouldPersist({
      CI: true
    }, false)).to.eql(false, "expect shouldPersist({ CI: true  }, false) === false");

    expect(shouldPersist({
      CI: true
    }, true )).to.eql(false, "expect shouldPersist({ CI: false }, false) === false");

    expect(shouldPersist({
      CI: "0"
    }, true )).to.eql(false, "expect shouldPersist({ },  true) === true");

    expect(shouldPersist({
    }, true )).to.eql(true,  "expect shouldPersist({ },  true) === true");

    expect(shouldPersist({
      FORCE_PERSISTENCE_IN_CI: true
    },  false)).to.eql(false,  "expect shouldPersist({ FORCE_PERSISTENCE_IN_CI: true}, false) === false");

    expect(shouldPersist({
      CI: true,
      FORCE_PERSISTENCE_IN_CI: true
    },  false)).to.eql(true,  "expect shouldPersist({ CI: true, FORCE_PERSISTENCE_IN_CI: true}, false) === true");
  });
});
