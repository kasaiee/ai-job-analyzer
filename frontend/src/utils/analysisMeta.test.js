import assert from 'node:assert/strict';
import test from 'node:test';
import {getAnalysisMetaItems} from './analysisMeta.js';

test('should show only confidence in analysis hero metadata', () => {
  const meta = {
    candidate_name: 'Jordan Lee',
    job_title: 'Software Engineer',
    location: 'Remote',
    seniority: 'Senior',
    analysis_confidence: 0.86,
  };

  const items = getAnalysisMetaItems(meta);

  assert.deepEqual(items, [
    {label: 'Confidence', value: '86%'},
  ]);
});
