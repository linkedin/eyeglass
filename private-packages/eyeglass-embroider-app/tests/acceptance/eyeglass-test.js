import QUnit, { module, test } from 'qunit';
import { visit, currentURL } from '@ember/test-helpers';
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

  // Disabled until it can be made to pass.
  // See issues:
  //   * https://github.com/sass-eyeglass/ember-cli-eyeglass/pull/50
  //   * https://github.com/sass-eyeglass/ember-cli-eyeglass/issues/52
  test('visiting /eager', async function(assert) {
    await visit('/eager');

    assert.equal(currentURL(), '/eager');

    const eagerStyle = self.getComputedStyle(document.querySelector('.eager'));
    const eagerAddonStyle = self.getComputedStyle(document.querySelector('.eager-addon'));
    assert.equal(eagerStyle.backgroundColor, 'rgb(255, 0, 0)', '.eager#backgroundColor');
    assert.equal(eagerAddonStyle.color, 'rgb(0, 0, 255)', '.eager-addon#color');

    let imageUrl = eagerAddonStyle.backgroundImage.substring(5, eagerAddonStyle.backgroundImage.length - 2);
    assert.contains("http://", imageUrl);
    assert.contains("/assets/img/test.jpg", imageUrl);
    try {
      let response = await fetch(imageUrl);
      assert.equal(response.ok, true, `Background image ${imageUrl} returned ${response.status}`);
    } catch (e) {
      assert.notOk(e);
    }
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

    assert.contains('/engines-dist/lazy-test-addon/assets/img/test.svg', lazyStyle.borderImage);
  });

  test('/assets/eyeglass-embroider-app.css', async function(assert) {
    let text = await fetch('/assets/eyeglass-embroider-app.css').then(req => req.text());

    assert.contains('.warning', text);
    assert.contains('.error', text);
  });

  test('/assets/vendor.css',  async function(assert) {
    let text = await fetch('/assets/vendor.css').then(req => req.text());

    assert.contains('.eager-addon', text);
  });

  test('/assets/other.css', async function(assert) {
    let text = await fetch('/assets/other.css').then(req => req.text());

    assert.contains('.warning', text);
    assert.contains('.error', text);
  });

  test('/assets/eager.css', async function(assert) {
    let text = await fetch('/assets/eager.css').then(req => req.text());

    assert.contains('.eager', text);
  });

  test('/engines-dist/lazy-test-addon/assets/engine.css', async function(assert) {
    let text = await fetch('/engines-dist/lazy-test-addon/assets/engine.css').then(req => req.text());
    assert.contains('.lazy', text);
  });

  test('/assets/unprocessed.css exists', async function(assert) {
    let text = await (await fetch('/assets/unprocessed.css')).text();

    assert.contains('.styled-by-css', text);
  });
});
