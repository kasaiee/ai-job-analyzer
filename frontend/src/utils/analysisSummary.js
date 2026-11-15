import {getDealBreaker} from './dealBreaker.js';

const severityRank = {HIGH: 0, MEDIUM: 1, LOW: 2};

const decisions = {
  STRONG_MATCH: {title: 'Strong fit', tone: 'good'},
  GOOD_MATCH: {title: 'Good fit', tone: 'good'},
  PARTIAL_MATCH: {title: 'Partial fit', tone: 'warn'},
  WEAK_MATCH: {title: 'Weak fit', tone: 'bad'},
  NOT_A_MATCH: {title: 'Not a good fit', tone: 'bad'},
};

const rankOf = severity => severityRank[String(severity || '').toUpperCase()] ?? 3;

/** Build the quick "should I join?" answer from fields the analysis already has. */
export const buildDecisionSummary = (analysis, {maxWeaknesses = 3} = {}) => {
  const blockers = (analysis?.deal_breakers || []).map(getDealBreaker);
  const hasImpossibleBlocker = blockers.some(item => item.employmentImpossible);
  const decision = hasImpossibleBlocker
    ? {title: 'Not recommended', tone: 'bad'}
    : decisions[analysis?.verdict?.label] || {title: 'Not analyzed', tone: 'warn'};
  const weaknesses = (analysis?.gaps || [])
    .map((item, index) => ({item, index}))
    .sort((a, b) => rankOf(a.item.severity) - rankOf(b.item.severity) || a.index - b.index)
    .slice(0, maxWeaknesses)
    .map(({item}) => ({title: item.title, severity: item.severity, mitigation: item.mitigation || ''}));

  return {
    ...decision,
    oneLiner: analysis?.verdict?.one_liner || '',
    blockers: blockers.map(({title, employmentImpossible}) => ({title, employmentImpossible})),
    weaknesses,
  };
};
