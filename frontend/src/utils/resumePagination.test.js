import assert from 'node:assert/strict';
import test from 'node:test';
import {paginateResumeBlocks, validResumePageIndexes} from './resumePagination.js';

test('should move overflowing resume blocks to a new page', () => {
  assert.deepEqual(paginateResumeBlocks([30, 45, 40, 20], 100), [[0, 1], [2, 3]]);
});

test('should keep an oversized resume block on its own page', () => {
  assert.deepEqual(paginateResumeBlocks([40, 120, 30], 100), [[0], [1], [2]]);
});

test('should fall back to one page when page height is unavailable', () => {
  assert.deepEqual(paginateResumeBlocks([40, 50], 0), [[0, 1]]);
});

test('should discard stale page indexes when switching to an older resume version', () => {
  assert.deepEqual(validResumePageIndexes([0, 1, 4, 5], 3), [0, 1]);
  assert.deepEqual(validResumePageIndexes(undefined, 3), []);
});
