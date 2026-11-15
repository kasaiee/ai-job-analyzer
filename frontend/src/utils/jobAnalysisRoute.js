import {getJobTitle} from './jobTitle.js';

export const jobSlug = value => String(value || '')
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'job';

export const jobAnalysisPath = job => `/job-tracker/jobs/${job.id}/${jobSlug(getJobTitle(job) || job.company_name)}`;

export const JOB_DOCUMENT_TYPES = new Set(['resume', 'cover-letter']);

export const jobDocumentPath = (job, documentType) => {
  if (!JOB_DOCUMENT_TYPES.has(documentType)) throw new Error(`Unsupported job document type: ${documentType}`);
  return `${jobAnalysisPath(job)}/${documentType}`;
};

export const jobRouteFromPath = path => {
  const match = String(path || '').match(/^\/job-tracker\/jobs\/([^/]+)\/([^/]+)(?:\/(resume|cover-letter))?\/?$/);
  return match ? {jobId: decodeURIComponent(match[1]), slug: match[2], documentType: match[3] || null} : null;
};

export const jobIdFromAnalysisPath = path => {
  return jobRouteFromPath(path)?.jobId || null;
};
