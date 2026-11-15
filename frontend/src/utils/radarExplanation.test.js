import assert from 'node:assert/strict';
import test from 'node:test';
import {getRadarExplanationItems} from './radarExplanation.js';

test('should pair each radar dimension explanation with its candidate and expectation scores', () => {
  const items = getRadarExplanationItems(
    ['Skills', 'Experience'],
    [80, 65],
    [95, 85],
  );

  assert.deepEqual(items.map(item => ({
    dimension: item.dimension,
    candidateScore: item.candidateScore,
    expectationScore: item.expectationScore,
  })), [
    {dimension: 'Skills', candidateScore: 80, expectationScore: 95},
    {dimension: 'Experience', candidateScore: 65, expectationScore: 85},
  ]);
  assert.match(items[0].description, /matched, partial, and missing/);
});

test('should describe an unknown radar dimension with a safe fallback', () => {
  const [item] = getRadarExplanationItems(['Portfolio'], [70], [90]);

  assert.match(item.description, /Candidate evidence/);
});

test('should include evidence-backed reasons for an exact radar score', () => {
  const [item] = getRadarExplanationItems(
    ['Education'],
    [40],
    [80],
    [{
      dimension: 'Education',
      candidate_reason: 'The resume lists a diploma but not the requested degree.',
      expectation_reason: 'The job description prefers a bachelor degree.',
    }],
  );

  assert.equal(item.candidateReason, 'The resume lists a diploma but not the requested degree.');
  assert.equal(item.expectationReason, 'The job description prefers a bachelor degree.');
});

test('should tell users to sync when a saved analysis has no score rationale', () => {
  const [item] = getRadarExplanationItems(['Education'], [40], [80]);

  assert.match(item.candidateReason, /Sync the analysis/);
  assert.match(item.expectationReason, /Sync the analysis/);
});
