import assert from 'node:assert/strict';
import test from 'node:test';
import {sortSkills} from './skillSort.js';

const skills = [
  {skill: 'React', category: 'HARD', importance: 'HIGH', status: 'MATCHED', gap_severity: 'NONE'},
  {skill: 'Communication', category: 'SOFT', importance: 'CRITICAL', status: 'PARTIAL', gap_severity: 'LOW'},
  {skill: 'AWS', category: 'HARD', importance: 'MEDIUM', status: 'MISSING', gap_severity: 'HIGH'},
];

test('should sort skills by each visible table column', () => {
  const expectedFirstSkill = {
    skill: 'AWS',
    category: 'React',
    importance: 'Communication',
    status: 'React',
    gap: 'AWS',
  };

  Object.entries(expectedFirstSkill).forEach(([key, skill]) => {
    const sorted = sortSkills(skills, {key, direction: 'asc'});
    assert.equal(sorted[0].skill, skill);
  });
});

test('should sort descending without mutating the source skill order', () => {
  const sorted = sortSkills(skills, {key: 'skill', direction: 'desc'});

  assert.deepEqual(sorted.map(item => item.skill), ['React', 'Communication', 'AWS']);
  assert.deepEqual(skills.map(item => item.skill), ['React', 'Communication', 'AWS']);
});
