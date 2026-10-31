import assert from 'node:assert/strict';
import test from 'node:test';
import {textDirection} from './textDirection.js';

test('should use RTL when a response contains at least one Persian character', () => {
  assert.equal(textDirection('English response with ی'), 'rtl');
  assert.equal(textDirection('سلام world'), 'rtl');
});

test('should keep responses without Persian characters LTR', () => {
  assert.equal(textDirection('English response only'), 'ltr');
  assert.equal(textDirection(''), 'ltr');
});
