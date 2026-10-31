import assert from 'node:assert/strict';
import test from 'node:test';
import {formatEducationPeriod, formatResumeDate} from './educationPeriod.js';

test('should display month names for numeric education date ranges', () => {
  assert.equal(
    formatEducationPeriod('2020-09 – 2024/06'),
    'Sep 2020 – Jun 2024',
  );
  assert.equal(formatEducationPeriod('09/2020 - Present'), 'Sep 2020 - Present');
  assert.equal(formatEducationPeriod('2024-10'), 'Oct 2024');
});

test('should preserve year-only and descriptive education periods', () => {
  assert.equal(formatEducationPeriod('2020 – Present'), '2020 – Present');
  assert.equal(formatEducationPeriod(''), '');
});

test('should abbreviate full month names consistently across resume dates', () => {
  assert.equal(formatResumeDate('October 2022'), 'Oct 2022');
  assert.equal(formatResumeDate('SEPTEMBER 2020 – January 2024'), 'Sep 2020 – Jan 2024');
  assert.equal(formatResumeDate('Present'), 'Present');
});
