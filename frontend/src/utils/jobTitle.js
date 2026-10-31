/**
 * Returns the manually saved title, then falls back to the analyzed title.
 *
 * @param {unknown} analysis
 * @returns {string | null}
 */
export const getJobTitle = jobApplication => {
  const titles = [
    jobApplication?.job_title,
    jobApplication?.ai_analysis?.meta?.job_title,
  ];
  const title = titles.find(value => typeof value === 'string' && value.trim());

  if (!title) return null;

  return title.trim();
};
