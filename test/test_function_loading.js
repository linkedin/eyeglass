'use strict';

var assert   = require("assert"),
    sass     = require("node-sass"),
    path     = require("path"),
    eyeglass = require('../lib');

function fixtureDirectory(subpath) {
  return path.join(__dirname, "fixtures", subpath);
}

describe('function loading', function () {

 it('should discover sass functions', function (done) {
   sass.render(eyeglass({
     root: fixtureDirectory("function_modules"),
     data: '#hello { greeting: hello(Chris); }\n' +
           '#transitive { is: transitive(); }\n',
     success: function(result) { 
       // TODO This should not be a successful compile (libsass issue?)
       assert.equal("#hello {\n  greeting: Hello, Chris!; }\n\n#transitive {\n  is: transitive; }\n",
                    result.css);
       done();
     }
   }));
 });

});

