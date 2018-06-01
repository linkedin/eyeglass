import { currentURL, visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import QUnit from 'qunit';

import { setupApplicationTest } from 'ember-qunit';

QUnit.assert.contains = function(needle, haystack) {
  const actual = haystack.indexOf(needle) > -1;
  this.pushResult({
    result: haystack.indexOf(needle) > -1,
    actual,
    message: `expected:

${needle}

to be contained within:

${haystack}
` });
};

module('Acceptance | eyeglass', function(hooks) {
  setupApplicationTest(hooks);

  test('visiting /', async function(assert) {
    await visit('/');

    assert.equal(currentURL(), '/');

    const warningStyle = self.getComputedStyle(document.querySelector('.warning'));
    const errorStyle = self.getComputedStyle(document.querySelector('.error'));

    assert.equal(warningStyle.color, 'rgb(204, 0, 0)', '.warning#color');
    assert.equal(warningStyle.backgroundColor, 'rgba(0, 0, 0, 0)', '.warning#background-color');

    assert.equal(errorStyle.color, 'rgb(0, 0, 0)', '.error#color');
    assert.equal(errorStyle.backgroundColor, 'rgb(204, 0, 0)', '.error#background-color');
  });

  test('visiting /eager', async function(assert) {
    await visit('/eager');

    assert.equal(currentURL(), '/eager');

    const eagerStyle = self.getComputedStyle(document.querySelector('.eager'));
    const eagerAddonStyle = self.getComputedStyle(document.querySelector('.eager-addon'));
    assert.equal(eagerStyle.backgroundColor, 'rgb(255, 0, 0)', '.eager#backgroundColor');
    assert.equal(eagerAddonStyle.color, 'rgb(255, 255, 0)', '.eager-addon#backgroundColor');
  });

  test('visiting /lazy', async function(assert) {
    await visit('/lazy');

    assert.equal(currentURL(), '/lazy');

    const eagerStyle = self.getComputedStyle(document.querySelector('.lazy'));

    assert.equal(eagerStyle.backgroundColor, 'rgb(0, 0, 255)', '.lazy#backgroundColor');
  });

  test('lazy asset-url points to engines-dist', async function(assert) {
    await visit('/lazy');

    assert.equal(currentURL(), '/lazy');

    const lazyStyle = self.getComputedStyle(document.querySelector('.lazy'));

    assert.contains('/engines-dist/lazy/assets/img/test.svg', lazyStyle.borderImage);
  });

  test('/assets/dummy.css', function(assert) {
    return fetch('/assets/dummy.css').then(req => req.text()).then(text => {
      assert.contains('.warning', text);
      assert.contains('.error', text);
    });
  });

  test('/assets/vendor.css', function(assert) {
    return fetch('/assets/vendor.css').then(req => req.text()).then(text => {
      assert.contains('.eager-addon', text);
    });
  });

  test('/assets/other.css', function(assert) {
    return fetch('/assets/other.css').then(req => req.text()).then(text => {
      assert.contains('.warning', text);
      assert.contains('.error', text);
    });
  });

  test('/assets/eager.css', function(assert) {
    return fetch('/assets/eager.css').then(req => req.text()).then(text => {
      assert.contains('.eager', text);
    });
  });

  test('/engines-dist/lazy/assets/engine.css', function(assert) {
    return fetch('/engines-dist/lazy/assets/engine.css').then(req => req.text()).then(text => {
      assert.contains('.lazy', text);
    });
  });
});
