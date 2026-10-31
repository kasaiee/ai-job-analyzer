import {applySort} from './sortState.js';

const SKILL_SORT_FIELDS = {
  skill: 'skill',
  category: 'category',
  importance: 'importance',
  status: 'status',
  gap: 'gap_severity',
};

/** Returns a sorted copy of skill analysis rows for the selected table column. */
export const sortSkills = (skills, sort) => applySort(skills, sort, (first, second, key) => {
  const field = SKILL_SORT_FIELDS[key];
  const firstValue = first[field] || '';
  const secondValue = second[field] || '';

  return firstValue.localeCompare(secondValue, undefined, {numeric: true, sensitivity: 'base'});
});
