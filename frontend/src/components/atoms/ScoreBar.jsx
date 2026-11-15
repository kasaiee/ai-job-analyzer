import React from 'react';

const ScoreBar = ({label, score}) => {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));

  return <div className="score-bar">
    <div className="score-bar-label"><span>{label}</span><b>{safeScore}</b></div>
    <div className="score-bar-track" aria-label={`${label}: ${safeScore} / 100`} role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={safeScore}>
      <span style={{width: `${safeScore}%`}}/>
    </div>
  </div>;
};

export default ScoreBar;
