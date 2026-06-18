import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { checkForUpdates } from '../src/update-check.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('checkForUpdates reads CLI and registry versions from manifest', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'personaparty-update-'));
  const localRegistryPath = path.join(tempDir, 'registry.personas.json');
  await fs.writeJson(localRegistryPath, { version: 5 });

  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://example.com/version-manifest.json');
    return {
      ok: true,
      async json() {
        return {
          cli: { version: '0.2.0' },
          registry: { version: 6 }
        };
      }
    };
  };

  const updates = await checkForUpdates({
    packageName: 'personaparty',
    currentVersion: '0.1.0',
    localRegistryPath,
    remoteRegistryUrl: null,
    remoteVersionManifestUrl: 'https://example.com/version-manifest.json',
    skipRemote: false
  });

  assert.deepEqual(updates, {
    cli: {
      currentVersion: '0.1.0',
      latestVersion: '0.2.0'
    },
    registry: {
      currentVersion: 5,
      latestVersion: 6
    }
  });
});

test('checkForUpdates does not report older manifest CLI versions', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'personaparty-update-'));
  const localRegistryPath = path.join(tempDir, 'registry.personas.json');
  await fs.writeJson(localRegistryPath, { version: 5 });

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        cli: { version: '0.0.9' },
        registry: { version: 5 }
      };
    }
  });

  const updates = await checkForUpdates({
    packageName: 'personaparty',
    currentVersion: '0.1.0',
    localRegistryPath,
    remoteRegistryUrl: null,
    remoteVersionManifestUrl: 'https://example.com/version-manifest.json',
    skipRemote: false
  });

  assert.deepEqual(updates, {
    cli: null,
    registry: null
  });
});
