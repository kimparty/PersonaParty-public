import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeAgent, normalizeRemoteTemplate, resolveTemplateUrl } from '../src/registry.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('resolveTemplateUrl keeps local template sources inside registry directory', () => {
  const registryPath = path.join(repoRoot, 'registry.personas.json');
  const resolved = resolveTemplateUrl('templates/maid.md', registryPath);

  assert.equal(resolved, path.join(repoRoot, 'templates', 'maid.md'));
});

test('resolveTemplateUrl rejects local template traversal', () => {
  const registryPath = path.join(repoRoot, 'registry.personas.json');

  assert.throws(
    () => resolveTemplateUrl('../secret.txt', registryPath),
    /Unsafe template source path/u
  );
});

test('resolveTemplateUrl rejects absolute local template paths', () => {
  const registryPath = path.join(repoRoot, 'registry.personas.json');

  assert.throws(
    () => resolveTemplateUrl(path.join(repoRoot, 'secret.txt'), registryPath),
    /Unsafe template source path/u
  );
});

test('normalizeRemoteTemplate still resolves remote URLs against remote registries', () => {
  const normalized = normalizeRemoteTemplate('templates/maid.md', 'https://example.com/registry/personas.json');

  assert.deepEqual(normalized, {
    url: 'https://example.com/registry/templates/maid.md',
    path: 'maid.md'
  });
});

test('normalizeAgent requires defaultFile before templates are built', () => {
  assert.throws(
    () => normalizeAgent({ id: 'custom', name: 'Custom' }),
    /requires "id", "name", and "defaultFile"/u
  );
});
