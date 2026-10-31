import assert from 'node:assert/strict';
import test from 'node:test';
import {getDealBreaker} from './dealBreaker.js';

test('should not generate a title from a legacy deal-breaker sentence', () => {
  assert.deepEqual(
    getDealBreaker('The posting says the opportunity is open to contractors based in Poland; the candidate lives elsewhere.'),
    {
      title: 'Sync analysis',
      detail: 'The posting says the opportunity is open to contractors based in Poland; the candidate lives elsewhere.',
      employmentImpossible: false,
    },
  );
});

test('should preserve AI-generated deal-breaker titles', () => {
  assert.deepEqual(
    getDealBreaker({title: 'Location restriction', detail: 'Contractors must be based in Poland.', employment_impossible: true}),
    {title: 'Location restriction', detail: 'Contractors must be based in Poland.', employmentImpossible: true},
  );
});
