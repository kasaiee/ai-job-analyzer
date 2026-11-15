import assert from 'node:assert/strict';
import test from 'node:test';
import {compactContactLinks, formatContactLink, parseContactLinks} from './resumeContact.js';

test('should hide protocol and www in displayed resume contact links', () => {
  assert.equal(formatContactLink('https://www.linkedin.com/in/name'), 'linkedin.com/in/name');
  assert.equal(formatContactLink('https://github.com/name'), 'github.com/name');
  assert.equal(formatContactLink('www.example.com'), 'example.com');
});

test('should preserve a new link row while editing and remove it when saving', () => {
  assert.deepEqual(parseContactLinks('https://example.com\n'), ['https://example.com', '']);
  assert.deepEqual(
    compactContactLinks(['https://example.com', '', '  https://github.com/name  ']),
    ['https://example.com', 'https://github.com/name'],
  );
});
