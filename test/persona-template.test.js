import assert from 'node:assert/strict';
import { test } from 'node:test';
import { materializePersonaTemplate } from '../src/persona-template.js';

const storageProfiles = {
  windows: {
    sharedDir: '{LOCALAPPDATA}/PersonaParty/shared',
    logPath: '{LOCALAPPDATA}/PersonaParty/shared/daily.md',
    photoDir: '{LOCALAPPDATA}/PersonaParty/shared/photos',
    downloadCommandHint: 'win hint',
    createPhotoDirHint: 'win mkdir'
  },
  linux: {
    sharedDir: '{HOME}/.personaparty/shared',
    logPath: '{HOME}/.personaparty/shared/daily.md',
    photoDir: '{HOME}/.personaparty/shared/photos',
    downloadCommandHint: 'linux hint',
    createPhotoDirHint: 'linux mkdir'
  },
  darwin: {
    sharedDir: '{HOME}/Library/Application Support/PersonaParty/shared',
    logPath: '{HOME}/Library/Application Support/PersonaParty/shared/daily.md',
    photoDir: '{HOME}/Library/Application Support/PersonaParty/shared/photos',
    downloadCommandHint: 'mac hint',
    createPhotoDirHint: 'mac mkdir'
  },
  default: {
    sharedDir: '{HOME}/.personaparty/shared',
    logPath: '{HOME}/.personaparty/shared/daily.md',
    photoDir: '{HOME}/.personaparty/shared/photos'
  }
};

const persona = {
  template: 'log: {{ SHARED_LOG_PATH }}\nphoto: {{ SHARED_PHOTO_DIR }}',
  defaults: { ROLE_NAME: 'Test' },
  transform: { replace: [] }
};

test('windows default paths use backslashes only', async () => {
  const result = await materializePersonaTemplate(persona, null, storageProfiles, 'windows');
  assert.match(result.defaults.SHARED_LOG_PATH, /\\PersonaParty\\shared\\daily\.md$/u);
  assert.doesNotMatch(result.defaults.SHARED_LOG_PATH, /\//u);
  assert.doesNotMatch(result.defaults.SHARED_DIR, /\//u);
  assert.doesNotMatch(result.defaults.SHARED_PHOTO_DIR, /\//u);
});

test('linux default paths use forward slashes only', async () => {
  const result = await materializePersonaTemplate(persona, null, storageProfiles, 'linux');
  assert.match(result.defaults.SHARED_LOG_PATH, /^\/home\/[^/]+\/\.personaparty\/shared\/daily\.md$/u);
  assert.doesNotMatch(result.defaults.SHARED_LOG_PATH, /\\/u);
  assert.doesNotMatch(result.defaults.SHARED_DIR, /\\/u);
});

test('darwin default paths use forward slashes only and Users home', async () => {
  const result = await materializePersonaTemplate(persona, null, storageProfiles, 'darwin');
  assert.match(
    result.defaults.SHARED_LOG_PATH,
    /^\/Users\/[^/]+\/Library\/Application Support\/PersonaParty\/shared\/daily\.md$/u
  );
  assert.doesNotMatch(result.defaults.SHARED_LOG_PATH, /\\/u);
});
