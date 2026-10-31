/**
 * Returns a display-safe job match score, or null when no valid analysis exists.
 *
 * @param {unknown} analysis
 * @returns {number | null}
 */
export const getJobMatchScore = analysis => {
  const score = analysis?.scores?.overall_match_score;

  if (typeof score !== 'number' || !Number.isFinite(score)) return null;

  return Math.round(Math.max(0, Math.min(100, score)));
};

/** Compares two analyses by display-safe match score; unavailable scores rank below zero. */
export const compareJobMatchScores = (firstAnalysis, secondAnalysis) => {
  const firstScore = getJobMatchScore(firstAnalysis) ?? -1;
  const secondScore = getJobMatchScore(secondAnalysis) ?? -1;

  return firstScore - secondScore;
};
