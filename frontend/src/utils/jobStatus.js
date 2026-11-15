/** Application statuses supported by the job tracker. */
export const JOB_STATUSES = ['WATCHLIST', 'APPLIED', 'INTERVIEW', 'OFFER', 'NOT_SELECTED'];

export const DEFAULT_JOB_STATUS = 'WATCHLIST';

/** Falls back to the default status when a saved application has no status. */
export const getJobStatus = (status) => status || DEFAULT_JOB_STATUS;

/** Returns the translation key used for a job status label. */
export const getJobStatusLabelKey = (status) => `jobStatus${getJobStatus(status).replace('_', '')}`;

/** Returns the CSS modifier class for a job status badge/column. */
export const getJobStatusClass = (status) =>
  `status-${getJobStatus(status).toLowerCase().replace('_', '-')}`;
