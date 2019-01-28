"use strict";

var assert = require("assert");
var SimpleCache = require("../lib/util/SimpleCache");

function Spy(callback) {
  this.called = 0;
  this.callable = function() {
    this.called++;
    if (callback) {
      return callback(Array.from(arguments));
    }
  }.bind(this);
}

describe("SimpleCache", function () {
  it("should create an instance of SimpleCache", function() {
    var cache = new SimpleCache();
    assert(cache instanceof SimpleCache);
  });

  it("should set a value in cache and be able to retrieve it", function() {
    var cache = new SimpleCache();
    var key = "testKey";
    var value = "testValue";
    cache.set(key, value);
    assert.equal(cache.get(key), value);
  });

  it("getOrElse should return the value", function() {
    var cache = new SimpleCache();
    var key = "testKey";
    var value = "testValue";
    var spy = new Spy();
    cache.set(key, value);
    assert.equal(cache.getOrElse(key, spy.callable), value);
    assert.equal(spy.called, 0);
  });

  it("getOrElse should set the value and return if not yet set", function() {
    var cache = new SimpleCache();
    var key = "testKey";
    var value = "testValue";
    var spy = new Spy(function() {
      return value;
    });
    assert.equal(cache.getOrElse(key, spy.callable), value);
    assert.equal(spy.called, 1);
  });

  it("should purge", function() {
    var cache =  new SimpleCache();
    var keys = ["foo", "bar"];
    keys.forEach(function(key, index) {
      cache.set(key, index);
      assert.equal(cache.has(key), true);
      assert.equal(cache.get(key), index);
    });
    cache.purge();
    keys.forEach(function(key) {
      assert.equal(cache.has(key), false);
      assert.equal(cache.get(key), undefined);
    });
  });
});
