import fs from 'fs-extra';
import path from 'node:path';
import { fetchWithTimeout } from './fetch-helper.js';

export async function checkForUpdates({
  packageName,
  currentVersion,
  localRegistryPath,
  remoteRegistryUrl,
  remoteVersionManifestUrl,
  skipRemote
}) {
  const result = {
    cli: null,
    registry: null
  };

  const remoteVersions = skipRemote ? null : await fetchRemoteVersions(remoteVersionManifestUrl);
  result.cli = remoteVersions?.cli
    ? compareVersions(currentVersion, remoteVersions.cli)
    : await checkCliUpdate(packageName, currentVersion);
  result.registry = skipRemote
    ? null
    : await checkRegistryUpdate(localRegistryPath, remoteRegistryUrl, remoteVersions?.registry);

  return result;
}

async function checkCliUpdate(packageName, currentVersion) {
  try {
    const response = await fetchWithTimeout(`https://registry.npmjs.org/${packageName}/latest`, { timeout: 2000 });
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.version || data.version === currentVersion) {
      return null;
    }

    return {
      currentVersion,
      latestVersion: data.version
    };
  } catch {
    return null;
  }
}

async function fetchRemoteVersions(remoteVersionManifestUrl) {
  if (!remoteVersionManifestUrl || !/^https?:\/\//i.test(remoteVersionManifestUrl)) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(remoteVersionManifestUrl, { timeout: 2000 });
    if (!response.ok) {
      return null;
    }
    return normalizeVersionManifest(await response.json());
  } catch {
    return null;
  }
}

async function checkRegistryUpdate(localRegistryPath, remoteRegistryUrl, manifestRegistryVersion) {
  try {
    const localRegistry = await fs.readJson(path.resolve(localRegistryPath));
    const localVersion = Number(localRegistry.version ?? 0);
    const remoteVersion = manifestRegistryVersion ?? await fetchRemoteRegistryVersion(remoteRegistryUrl);

    if (!Number.isFinite(remoteVersion) || remoteVersion <= localVersion) {
      return null;
    }

    return {
      currentVersion: localVersion,
      latestVersion: remoteVersion
    };
  } catch {
    return null;
  }
}

async function fetchRemoteRegistryVersion(remoteRegistryUrl) {
  if (!remoteRegistryUrl || !/^https?:\/\//i.test(remoteRegistryUrl)) {
    return null;
  }

  const response = await fetchWithTimeout(remoteRegistryUrl, { timeout: 2000 });
  if (!response.ok) {
    return null;
  }

  const remoteRegistry = await response.json();
  return Number(remoteRegistry.version ?? 0);
}

function normalizeVersionManifest(manifest) {
  return {
    cli: typeof manifest?.cli?.version === 'string' ? manifest.cli.version : null,
    registry: Number.isFinite(Number(manifest?.registry?.version)) ? Number(manifest.registry.version) : null
  };
}

function compareVersions(currentVersion, latestVersion) {
  if (!latestVersion || compareSemver(latestVersion, currentVersion) <= 0) {
    return null;
  }

  return {
    currentVersion,
    latestVersion
  };
}

function compareSemver(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }

  return 0;
}

function parseVersion(version) {
  return String(version)
    .split(/[.-]/u)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
