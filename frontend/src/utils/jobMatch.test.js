import assert from 'node:assert/strict';
import test from 'node:test';
import {compareJobMatchScores, getJobMatchScore} from './jobMatch.js';

test('should return the overall score when analysis is valid', () => {
  const analysis = {scores: {overall_match_score: 82}};

  const score = getJobMatchScore(analysis);

  assert.equal(score, 82);
});

test('should return zero when a valid analysis has a zero score', () => {
  const analysis = {scores: {overall_match_score: 0}};

  const score = getJobMatchScore(analysis);

  assert.equal(score, 0);
});

test('should return null when analysis or its score is unavailable', () => {
  assert.equal(getJobMatchScore(null), null);
  assert.equal(getJobMatchScore({}), null);
  assert.equal(getJobMatchScore({scores: {overall_match_score: '82'}}), null);
});

test('should round and constrain unexpected numeric scores for display', () => {
  assert.equal(getJobMatchScore({scores: {overall_match_score: 72.6}}), 73);
  assert.equal(getJobMatchScore({scores: {overall_match_score: -5}}), 0);
  assert.equal(getJobMatchScore({scores: {overall_match_score: 105}}), 100);
});

test('should compare analyzed jobs numerically by match score', () => {
  const lowerMatch = {scores: {overall_match_score: 45}};
  const higherMatch = {scores: {overall_match_score: 82}};

  assert.ok(compareJobMatchScores(lowerMatch, higherMatch) < 0);
  assert.ok(compareJobMatchScores(higherMatch, lowerMatch) > 0);
});

test('should rank an unavailable match below a valid zero score', () => {
  const zeroMatch = {scores: {overall_match_score: 0}};

  assert.ok(compareJobMatchScores(null, zeroMatch) < 0);
  assert.ok(compareJobMatchScores(zeroMatch, null) > 0);
});
