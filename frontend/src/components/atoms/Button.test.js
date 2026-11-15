import assert from 'node:assert/strict';
import test from 'node:test';
import {buildButtonClassName} from './Button.jsx';

test('buildButtonClassName adds the shared control and variant classes', () => {
  assert.equal(buildButtonClassName({className:'page-action',variant:'primary'}),'page-action button-control button-primary');
});

test('buildButtonClassName keeps icon-only buttons in the shared system', () => {
  assert.equal(buildButtonClassName({variant:'ghost',iconOnly:true}),'button-control button-ghost button-icon-only');
});
