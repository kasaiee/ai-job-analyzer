import React from 'react';
import StatusBadge from '../atoms/StatusBadge';

const DecisionSummary = ({score, summary}) => <section className={`decision-summary decision-${summary.tone}`} aria-label="Quick decision">
  <div className="decision-main">
    <div className="confidence-gauge" style={{'--confidence': score}} role="img" aria-label={`Job match: ${score === null || score === undefined ? 'unavailable' : `${score}%`}`}>
      <div><strong>{score === null || score === undefined ? '—' : score}</strong>{score !== null && score !== undefined && <small>%</small>}</div>
    </div>
    <div>
      <h2>{summary.title}</h2>
      {summary.oneLiner&&<p>{summary.oneLiner}</p>}
    </div>
  </div>
  {summary.blockers.length>0&&<div className="decision-block">
    <h3>Blockers</h3>
    <ul>{summary.blockers.map((item, index) => <li key={`${item.title}-${index}`} className={item.employmentImpossible ? 'deal-breaker-danger' : ''}>{item.title}</li>)}</ul>
  </div>}
  {summary.weaknesses.length>0&&<div className="decision-block">
    <h3>Your main weaknesses</h3>
    <ul>{summary.weaknesses.map((item, index) => <li key={`${item.title}-${index}`}>
      <div><strong>{item.title}</strong>{item.severity&&<StatusBadge value={item.severity} kind="severity"/>}</div>
      {item.mitigation&&<small>{item.mitigation}</small>}
    </li>)}</ul>
  </div>}
</section>;

export default DecisionSummary;
