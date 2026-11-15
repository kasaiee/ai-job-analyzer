import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_JOB_STATUS,
  getJobStatus,
  getJobStatusClass,
  getJobStatusLabelKey,
  JOB_STATUSES,
} from './jobStatus.js';

test('should expose the supported job statuses in workflow order', () => {
  assert.deepEqual(JOB_STATUSES, ['WATCHLIST', 'APPLIED', 'INTERVIEW', 'OFFER', 'NOT_SELECTED']);
});

test('should fall back to the default status when status is missing', () => {
  assert.equal(getJobStatus(''), DEFAULT_JOB_STATUS);
  assert.equal(getJobStatus(undefined), DEFAULT_JOB_STATUS);
});

test('should keep a provided status', () => {
  assert.equal(getJobStatus('APPLIED'), 'APPLIED');
});

test('should build translation keys from statuses', () => {
  assert.equal(getJobStatusLabelKey('WATCHLIST'), 'jobStatusWATCHLIST');
  assert.equal(getJobStatusLabelKey('NOT_SELECTED'), 'jobStatusNOTSELECTED');
});

test('should build status CSS classes from statuses', () => {
  assert.equal(getJobStatusClass('WATCHLIST'), 'status-watchlist');
  assert.equal(getJobStatusClass('NOT_SELECTED'), 'status-not-selected');
});
