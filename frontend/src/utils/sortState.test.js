import assert from 'node:assert/strict';
import test from 'node:test';
import {applySort, getNextSortState} from './sortState.js';

test('should cycle a column from ascending to descending to unsorted', () => {
  const ascending = getNextSortState({key: null, direction: null}, 'name');
  const descending = getNextSortState(ascending, 'name');
  const unsorted = getNextSortState(descending, 'name');

  assert.deepEqual(ascending, {key: 'name', direction: 'asc'});
  assert.deepEqual(descending, {key: 'name', direction: 'desc'});
  assert.deepEqual(unsorted, {key: null, direction: null});
});

test('should start a different column in ascending order', () => {
  const next = getNextSortState({key: 'name', direction: 'desc'}, 'date');

  assert.deepEqual(next, {key: 'date', direction: 'asc'});
});

test('should preserve source order when sorting is reset', () => {
  const items = [{name: 'B'}, {name: 'A'}];

  const result = applySort(items, {key: null, direction: null}, () => 0);

  assert.deepEqual(result, items);
  assert.notEqual(result, items);
});

test('should apply ascending and descending comparators without mutating input', () => {
  const items = [{value: 2}, {value: 1}];
  const compare = (first, second) => first.value - second.value;

  assert.deepEqual(applySort(items, {key: 'value', direction: 'asc'}, compare), [{value: 1}, {value: 2}]);
  assert.deepEqual(applySort(items, {key: 'value', direction: 'desc'}, compare), [{value: 2}, {value: 1}]);
  assert.deepEqual(items, [{value: 2}, {value: 1}]);
});
