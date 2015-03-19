"use strict";

var assert = require("assert");
var hash = require("../lib/util/hash");
var unquote = require("../lib/util/unquote");
var sass = require("node-sass");

describe("utilities", function () {

 it("merge two 'hash' objects", function (done) {
    var hash1 = {a: 1, c: 3};
    var hash2 = {b: 2, c: 4};
    var rv = hash.merge(hash1, hash2);
    assert.equal(undefined, rv);
    assert(hash1.hasOwnProperty("a"));
    assert(hash1.hasOwnProperty("b"));
    assert(hash1.hasOwnProperty("c"));
    assert(!hash2.hasOwnProperty("a"));
    assert(hash2.hasOwnProperty("b"));
    assert(hash2.hasOwnProperty("c"));
    assert.equal(1, hash1.a);
    assert.equal(2, hash1.b);
    assert.equal(4, hash1.c);
    done();
 });

 it("unquote handles js strings", function(done) {
   assert.equal("asdf", unquote('"asdf"'));
   assert.equal("asdf", unquote("'asdf'"));
   assert.equal("\"asdf'", unquote("\"asdf'"));
   assert.equal("'asdf\"", unquote("'asdf\""));
   assert.equal("asdf", unquote("asdf"));
   done();
 });

 it("unquote handles sass strings", function(done) {
   var s = sass.types.String;
   assert.equal("asdf", unquote(s('"asdf"')).getValue());
   assert.equal("asdf", unquote(s("'asdf'")).getValue());
   assert.equal("\"asdf'", unquote(s("\"asdf'")).getValue());
   assert.equal("'asdf\"", unquote(s("'asdf\"")).getValue());
   assert.equal("asdf", unquote(s("asdf")).getValue());
   done();
 });
});
