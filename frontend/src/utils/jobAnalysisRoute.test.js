import test from 'node:test';
import assert from 'node:assert/strict';
import {jobAnalysisPath, jobIdFromAnalysisPath, jobSlug} from './jobAnalysisRoute.js';

test('should create a meaningful URL for a job analysis', () => {
  assert.equal(jobAnalysisPath({id: 'job-id', job_title: 'Senior Python Engineer, Integration'}), '/job-tracker/jobs/job-id/senior-python-engineer-integration');
});

test('should preserve meaningful non-Latin job titles in slugs', () => {
  assert.equal(jobSlug('مهندس ارشد پایتون'), 'مهندس-ارشد-پایتون');
});

test('should read a job ID from an analysis URL', () => {
  assert.equal(jobIdFromAnalysisPath('/job-tracker/jobs/abc-123/senior-engineer'), 'abc-123');
  assert.equal(jobIdFromAnalysisPath('/job-tracker'), null);
});
