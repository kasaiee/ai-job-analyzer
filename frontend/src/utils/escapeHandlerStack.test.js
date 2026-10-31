import assert from 'node:assert/strict';
import test from 'node:test';
import {getTopmostEscapeHandler, registerEscapeHandler, unregisterEscapeHandler} from './escapeHandlerStack.js';

test('should select the most recently registered popup at the same priority', () => {
  const first = registerEscapeHandler(() => {});
  const second = registerEscapeHandler(() => {});

  assert.equal(getTopmostEscapeHandler(), second);

  unregisterEscapeHandler(second);
  unregisterEscapeHandler(first);
});

test('should select a higher-priority nested popup', () => {
  const parent = registerEscapeHandler(() => {}, 0);
  const nested = registerEscapeHandler(() => {}, 130);

  assert.equal(getTopmostEscapeHandler(), nested);

  unregisterEscapeHandler(nested);
  unregisterEscapeHandler(parent);
});

test('should remove closed popups from the stack', () => {
  const popup = registerEscapeHandler(() => {});

  unregisterEscapeHandler(popup);

  assert.equal(getTopmostEscapeHandler(), null);
});
