import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAgentTemplates } from '../src/agent-adapters.js';

test('buildAgentTemplates creates split entry and persona files for split-capable adapters', () => {
  const templates = buildAgentTemplates({
    agent: {
      id: 'codex',
      name: 'Codex',
      defaultFile: 'AGENTS.md'
    },
    personaContent: '# Persona',
    split: true
  });

  assert.equal(templates.length, 2);
  assert.deepEqual(templates.map((template) => template.path), ['AGENTS.md', 'PERSONA.md']);
  assert.equal(templates[0].kind, 'entry');
  assert.equal(templates[1].kind, 'persona');
});

test('buildAgentTemplates falls back to a single persona file for custom agents', () => {
  const templates = buildAgentTemplates({
    agent: {
      id: 'custom-agent',
      name: 'Custom Agent',
      defaultFile: 'CUSTOM.md'
    },
    personaContent: '# Persona',
    split: true
  });

  assert.equal(templates.length, 1);
  assert.equal(templates[0].path, 'CUSTOM.md');
  assert.match(templates[0].content, /Generated for Custom Agent/u);
});
