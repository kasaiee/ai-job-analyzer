import assert from 'node:assert/strict';
import test from 'node:test';
import {getJobTitle} from './jobTitle.js';

test('should return the trimmed manually saved job title', () => {
  const application = {job_title: '  Fullstack Engineer  '};

  const title = getJobTitle(application);

  assert.equal(title, 'Fullstack Engineer');
});

test('should fall back to the analyzed title for existing jobs', () => {
  const application = {ai_analysis: {meta: {job_title: 'Backend Engineer'}}};

  assert.equal(getJobTitle(application), 'Backend Engineer');
});

test('should fall back when the manually saved title is blank', () => {
  const application = {
    job_title: '  ',
    ai_analysis: {meta: {job_title: 'Backend Engineer'}},
  };

  assert.equal(getJobTitle(application), 'Backend Engineer');
});

test('should return null when the job title is unavailable or invalid', () => {
  assert.equal(getJobTitle(null), null);
  assert.equal(getJobTitle({}), null);
  assert.equal(getJobTitle({job_title: '  '}), null);
  assert.equal(getJobTitle({job_title: 42}), null);
});
