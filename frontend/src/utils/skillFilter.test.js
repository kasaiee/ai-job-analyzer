import assert from 'node:assert/strict';
import test from 'node:test';
import {filterSkillsByStatus} from './skillFilter.js';

const skills = [
  {skill: 'Python', status: 'MATCHED'},
  {skill: 'React', status: 'PARTIAL'},
  {skill: 'Go', status: 'MISSING'},
];

test('should filter skills by selected summary status', () => {
  assert.deepEqual(filterSkillsByStatus(skills, 'PARTIAL'), [{skill: 'React', status: 'PARTIAL'}]);
});

test('should show every skill when the summary filter is cleared', () => {
  assert.deepEqual(filterSkillsByStatus(skills, null), skills);
  assert.deepEqual(filterSkillsByStatus(undefined, null), []);
});
