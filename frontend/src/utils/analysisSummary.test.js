import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDecisionSummary} from './analysisSummary.js';

const base = {
  verdict: {label: 'PARTIAL_MATCH', one_liner: 'Close, but visa is unclear.'},
  deal_breakers: [],
  gaps: [
    {title: 'Low one', severity: 'LOW', mitigation: 'a'},
    {title: 'High one', severity: 'HIGH', mitigation: 'b'},
    {title: 'Medium one', severity: 'MEDIUM', mitigation: 'c'},
    {title: 'High two', severity: 'HIGH', mitigation: 'd'},
  ],
};

test('maps the verdict label and keeps the one-liner', () => {
  const summary = buildDecisionSummary(base);
  assert.equal(summary.title, 'Partial fit');
  assert.equal(summary.tone, 'warn');
  assert.equal(summary.oneLiner, 'Close, but visa is unclear.');
});

test('lists the most severe gaps first and limits them', () => {
  const titles = buildDecisionSummary(base).weaknesses.map(item => item.title);
  assert.deepEqual(titles, ['High one', 'High two', 'Medium one']);
});

test('an impossible deal-breaker overrides the verdict', () => {
  const summary = buildDecisionSummary({...base, verdict: {label: 'GOOD_MATCH'}, deal_breakers: [{title: 'Visa needed', employment_impossible: true}]});
  assert.equal(summary.title, 'Not recommended');
  assert.equal(summary.tone, 'bad');
  assert.equal(summary.blockers[0].employmentImpossible, true);
});

test('handles missing data', () => {
  const summary = buildDecisionSummary({});
  assert.equal(summary.title, 'Not analyzed');
  assert.deepEqual(summary.weaknesses, []);
});
