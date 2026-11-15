import test from 'node:test';
import assert from 'node:assert/strict';
import {actionMenuAlignment, isMenuCloseKey, isOutsideMenu} from './actionMenu.js';

test('should fall back to end alignment when alignment is unknown', () => {
  assert.equal(actionMenuAlignment('middle'), 'end');
  assert.equal(actionMenuAlignment(undefined), 'end');
});

test('should keep a supported alignment', () => {
  assert.equal(actionMenuAlignment('start'), 'start');
});

test('should close only on the Escape key', () => {
  assert.equal(isMenuCloseKey('Escape'), true);
  assert.equal(isMenuCloseKey('Enter'), false);
});

test('should treat targets outside the menu element as outside', () => {
  const target = {};
  assert.equal(isOutsideMenu({contains: () => false}, target), true);
  assert.equal(isOutsideMenu({contains: () => true}, target), false);
  assert.equal(isOutsideMenu(null, target), true);
});
