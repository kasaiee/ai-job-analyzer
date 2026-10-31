import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCoverLetterText, parseCoverLetter} from './coverLetter.js';

test('should remove whitespace after hyphens inside compound words', () => {
  assert.equal(normalizeCoverLetterText('full- stack and on- demand'), 'full-stack and on-demand');
});

test('should put the closing and email on separate signature lines', () => {
  assert.equal(
    normalizeCoverLetterText('Sincerely, Reza Sharifi m.kasaie.dev@gmail.com'),
    'Sincerely,\n\nReza Sharifi\nm.kasaie.dev@gmail.com',
  );
});

test('should remove a standalone extracted page number at the start', () => {
  assert.equal(normalizeCoverLetterText('1\nWarsaw- based engineer'), 'Warsaw-based engineer');
});

test('should parse the signature for the cover letter template', () => {
  assert.deepEqual(parseCoverLetter('Dear Team,\n\nLetter body.\n\nSincerely,\n\nReza Sharifi\nreza@example.com'), {
    bodyParagraphs: ['Dear Team,', 'Letter body.'],
    closing: 'Sincerely,',
    name: 'Reza Sharifi',
    email: 'reza@example.com',
  });
});

test('should parse a signature that includes a phone after the email', () => {
  assert.deepEqual(parseCoverLetter('Dear Team,\n\nBody.\n\nSincerely,\n\nReza Sharifi\nreza@example.com\n+98 930 000 0000'), {
    bodyParagraphs: ['Dear Team,', 'Body.'],
    closing: 'Sincerely,',
    name: 'Reza Sharifi',
    email: 'reza@example.com',
  });
});
