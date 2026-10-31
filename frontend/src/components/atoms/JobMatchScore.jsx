import React from 'react';

/**
 * @param {{score: number | null, label: string, unavailableLabel: string}} props
 */
const JobMatchScore = ({score, label, unavailableLabel}) => {
  if (score === null) {
    return <span className="job-match-unavailable">{unavailableLabel}</span>;
  }

  const level = score >= 75 ? 'strong' : score >= 50 ? 'moderate' : 'weak';

  return <span
    className={`job-match-score job-match-score-${level}`}
    role="meter"
    aria-label={`${label}: ${score} / 100`}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={score}
  >
    {score}%
  </span>;
};

export default JobMatchScore;
