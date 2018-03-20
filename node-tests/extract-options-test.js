/* eslint-env mocha, node */
'use strict';

const extractConfig = require('..').extractConfig;
const expect = require('chai').expect;

describe('extractOptions', function() {
  describe('top-level addon', function() {
    it('no config', function() {
      const addon = {
        project: {
          config() {
            return { };
          }
        },
        parent: { }
      };

      const host = {
        options: { }
      };

      expect(extractConfig(host, addon)).to.deep.eql({});
    });

    it('build config', function() {
      const addon = {
        project: {
          config() {
            return { };
          }
        },
        parent: { }
      };

      const eyeglass = { OMG: true, nested: { INNER: true } };
      const host = {
        options: {
          eyeglass
        }
      };

      expect(extractConfig(host, addon), 'eyeglassConfig should be a deep clone').to.not.equal(eyeglass);
      expect(extractConfig(host, addon).nested, 'eyeglassConfig should be a deep clone').to.not.equal(eyeglass.nested);
      expect(extractConfig(host, addon)).to.deep.eql(eyeglass);
      expect(extractConfig(host, addon).nested, 'eyeglassConfig should be a deep clone').to.eql(eyeglass.nested);
    });
  });
});
