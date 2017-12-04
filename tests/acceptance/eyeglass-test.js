import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';
import QUnit from 'qunit';

QUnit.assert.contains = function(needle, haystack, message) {
  const actual = haystack.indexOf(needle) > -1;
  this.push(actual, actual, needle, message);
};

moduleForAcceptance('Acceptance | eyeglass');

test('visiting /', function(assert) {
  visit('/');

  andThen(function() {
    assert.equal(currentURL(), '/');

    const warningStyle = self.getComputedStyle(self.warningElement);
    const errorStyle = self.getComputedStyle(self.errorElement);

    assert.equal(warningStyle.color, 'rgb(204, 0, 0)', '.warning#color');
    assert.equal(warningStyle.backgroundColor, 'rgba(0, 0, 0, 0)', '.warning#background-color');

    assert.equal(errorStyle.color, 'rgb(0, 0, 0)', '.error#color');
    assert.equal(errorStyle.backgroundColor, 'rgb(204, 0, 0)', '.error#background-color');
  });
});

test('assets', function(assert) {
  return fetch('/assets/dummy.css').then(req => req.text()).then(text => {
    assert.contains('.warning', text);
    assert.contains('.error', text);

    return fetch('/assets/other.css').then(req => req.text()).then(text => {
      assert.contains('.warning', text);
      assert.contains('.error', text);
    });
  });
});
