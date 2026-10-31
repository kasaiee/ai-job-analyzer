import React from 'react';
import {getRadarExplanationItems} from '../../utils/radarExplanation';

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 94;

const pointAt = (index, value, count) => {
  const angle = (Math.PI * 2 * index / count) - Math.PI / 2;
  const radius = RADIUS * value / 100;
  return [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius];
};

const polygonPoints = (values, count) => values.map((value, index) => pointAt(index, value, count).join(',')).join(' ');

export const RadarExplanation = ({dimensions, candidate, expectation, rationales}) => {
  const explanationItems = getRadarExplanationItems(dimensions, candidate, expectation, rationales);

  return <div className="radar-explanation">
    <p><b>How scores are estimated:</b> Candidate scores reflect evidence found in the resume or candidate background. Job expectation scores reflect the importance and level inferred from the job description. Both are AI estimates from 0 to 100; farther from the center means stronger evidence or a higher expectation.</p>
    <ul>{explanationItems.map(item => <li key={item.dimension}><b>{item.dimension} ({item.candidateScore} candidate / {item.expectationScore} expected):</b> {item.description}<span><strong>Why candidate scored {item.candidateScore}:</strong> {item.candidateReason}</span><span><strong>Why expectation is {item.expectationScore}:</strong> {item.expectationReason}</span></li>)}</ul>
  </div>;
};

const RadarChart = ({dimensions, candidate, expectation}) => {
  const count = dimensions.length;
  const gridValues = [25, 50, 75, 100];

  return <div className="radar-chart-wrap">
    <svg className="radar-chart" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Candidate and job expectation radar chart">
      {gridValues.map(value => <polygon key={value} className="radar-grid" points={polygonPoints(Array(count).fill(value), count)}/>)}
      {dimensions.map((dimension, index) => {
        const [axisX, axisY] = pointAt(index, 100, count);
        const [labelX, labelY] = pointAt(index, 122, count);
        return <g key={dimension}>
          <line className="radar-axis" x1={CENTER} y1={CENTER} x2={axisX} y2={axisY}/>
          <text className="radar-label" x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle">{dimension}</text>
        </g>;
      })}
      <polygon className="radar-expectation" points={polygonPoints(expectation, count)}/>
      <polygon className="radar-candidate" points={polygonPoints(candidate, count)}/>
    </svg>
    <div className="radar-legend"><span className="candidate-key">Candidate</span><span className="expectation-key">Job expectation</span></div>
    <table className="sr-only"><caption>Radar chart values</caption><thead><tr><th>Dimension</th><th>Candidate</th><th>Job expectation</th></tr></thead><tbody>{dimensions.map((dimension, index)=><tr key={dimension}><td>{dimension}</td><td>{candidate[index]}</td><td>{expectation[index]}</td></tr>)}</tbody></table>
  </div>;
};

export default RadarChart;
