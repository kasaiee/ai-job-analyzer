import {getJobTitle} from './jobTitle.js';

export const jobSlug = value => String(value || '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'job';

export const jobAnalysisPath = job => `/job-tracker/jobs/${job.id}/${jobSlug(getJobTitle(job) || job.company_name)}`;

export const jobIdFromAnalysisPath = path => {
  const match = String(path || '').match(/^\/job-tracker\/jobs\/([^/]+)(?:\/[^/]*)?\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
};
