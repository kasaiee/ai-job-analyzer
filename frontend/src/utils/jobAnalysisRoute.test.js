import test from 'node:test';
import assert from 'node:assert/strict';
import {jobAnalysisPath, jobDocumentPath, jobIdFromAnalysisPath, jobRouteFromPath, jobSlug} from './jobAnalysisRoute.js';

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

test('should create and parse resume and cover letter page URLs', () => {
  const job = {id: 'abc-123', job_title: 'Senior Engineer'};
  assert.equal(jobDocumentPath(job, 'resume'), '/job-tracker/jobs/abc-123/senior-engineer/resume');
  assert.equal(jobDocumentPath(job, 'cover-letter'), '/job-tracker/jobs/abc-123/senior-engineer/cover-letter');
  assert.deepEqual(jobRouteFromPath('/job-tracker/jobs/abc-123/senior-engineer/resume'), {jobId:'abc-123',slug:'senior-engineer',documentType:'resume'});
  assert.equal(jobIdFromAnalysisPath('/job-tracker/jobs/abc-123/senior-engineer/cover-letter'), 'abc-123');
});
