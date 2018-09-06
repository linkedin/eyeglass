'use strict';

const setupConfig = require('..').setupConfig;
const expect = require('chai').expect;

describe('setupConfig', function() {
  describe('inApp: true', function() {
    const inApp = true;

    it('basic', function() {
      const config = {
        httpRoot: 'the-root'
      };
      const addon = {
        parent: {
          name: 'foo'
        }
      };

      const theSetupConfig = setupConfig(config, {
        addon,
        inApp,
      });

      expect(theSetupConfig).to.eql(config);
      expect(theSetupConfig.optionsGenerator).to.be.instanceOf(Function);
      expect(theSetupConfig).to.deep.eql({
        annotation: 'EyeglassCompiler: foo',
        assets: ['public', 'app'],
        assetsHttpPrefix: 'assets',
        httpRoot: 'the-root',
        eyeglass: {
          httpRoot: 'the-root',
          modules: [],
        },
        optionsGenerator: theSetupConfig.optionsGenerator,
        sourceFiles: [
          'app.scss'
        ]
      });
    });


    it('localEyeglassAddons', function() {
      const config = {
        httpRoot: 'the-root'
      };
      const addon = {
        parent: {
          name: 'foo',
          addons: [],
          addonPackages: {
            'foo': {
              path: 'foo/path',
              pkg: {
                keywords: ['eyeglass-module'],
              }
            },

            'bar': {
              path: 'bar/path',
              pkg: {
                keywords: [],
              }
            }
          }
        },
      };

      const theSetupConfig = setupConfig(config, {
        addon,
        inApp,
      });

      expect(theSetupConfig.eyeglass.modules).to.deep.eql([
        {
          path: 'foo/path'
        }
      ]);
    });


    it('localEyeglassAddons merge', function() {
      const config = {
        eyeglass: {
          modules: [
            {
              path: 'omg/path'
            }
          ]
        }
      };
      const addon = {
        parent: {
          name: 'foo',
          addons: [],
          addonPackages: {
            'foo': {
              path: 'foo/path',
              pkg: {
                keywords: ['eyeglass-module'],
              }
            },

            'bar': {
              path: 'bar/path',
              pkg: {
                keywords: [],
              }
            }
          }
        },
      };

      const theSetupConfig = setupConfig(config, {
        addon,
        inApp,
      });

      expect(theSetupConfig.eyeglass.modules).to.deep.eql([
        {
          path: 'omg/path'
        },
        {
          path: 'foo/path'
        }
      ]);
    });

    xit('getDefaultAssetHttpPrefix', function() {

    });


    it('kitchenSink', function() {
      const config = {
        httpRoot: 'the-root',
        assetsHttpPrefix: 'some-other-prefix',
        discover: true,
        sourceFiles: ['one', 'two', 'three'],
        eyeglass: {
          httpRoot: 'the-winning-root',
          modules: ['a', 'b', 'c'],
        }
      };
      const addon = {
        parent: {
          name() { return 'foo'; }
        }
      };

      const theSetupConfig = setupConfig(config, {
        addon,
        inApp,
      });

      expect(theSetupConfig).to.eql(config);
      expect(theSetupConfig.optionsGenerator).to.be.instanceOf(Function);
      expect(theSetupConfig).to.deep.eql({
        annotation: 'EyeglassCompiler: foo',
        assets: ['public', 'app'],
        assetsHttpPrefix: 'some-other-prefix',
        discover: true,
        httpRoot: 'the-root',
        eyeglass: {
          httpRoot: 'the-winning-root',
          modules: ['a', 'b', 'c'],
        },
        optionsGenerator: theSetupConfig.optionsGenerator,
        sourceFiles: [
          'one',
          'two',
          'three'
        ]
      });
    });
  });
});
