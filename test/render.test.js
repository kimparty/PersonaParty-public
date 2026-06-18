import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTemplate } from '../src/render.js';

test('renderTemplate resolves nested placeholders across passes', () => {
  const rendered = renderTemplate('Hello {{ NAME }}', {
    NAME: '{{ TITLE }} {{ LAST }}',
    TITLE: 'Dr.',
    LAST: 'Lin'
  });

  assert.equal(rendered, 'Hello Dr. Lin');
});

test('renderTemplate leaves unresolved cyclic placeholders bounded', () => {
  const rendered = renderTemplate('{{ A }}', {
    A: '{{ B }}',
    B: '{{ A }}'
  });

  assert.match(rendered, /^\{\{\s*[AB]\s*\}\}$/u);
});
