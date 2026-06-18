import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

const INDEX_VERSION = 1;

export function getInstallationsIndexPath() {
  return path.join(getAppDataDir(), 'installations.json');
}

export async function readInstallations() {
  const indexPath = getInstallationsIndexPath();
  if (!await fs.pathExists(indexPath)) {
    return {
      version: INDEX_VERSION,
      installations: []
    };
  }

  const index = await fs.readJson(indexPath);
  return {
    version: Number(index.version) || INDEX_VERSION,
    installations: Array.isArray(index.installations) ? index.installations : []
  };
}

export async function writeInstallation(installation) {
  const indexPath = getInstallationsIndexPath();
  const index = await readInstallations();
  const nextInstallations = index.installations.filter((item) => {
    return !pathsEqual(item.outputFile, installation.outputFile);
  });

  nextInstallations.push({
    ...installation,
    id: installation.id ?? createInstallationId(),
    updatedAt: new Date().toISOString()
  });

  await fs.ensureDir(path.dirname(indexPath));
  await fs.writeJson(indexPath, {
    version: INDEX_VERSION,
    installations: nextInstallations
  }, { spaces: 2 });
}

export function createInstallationRecord({
  agent,
  adapter,
  outputFile,
  outputDir,
  persona,
  platform,
  registry,
  relatedInstallations,
  variables,
  generatedFiles = [],
  diaryMode = 'auto',
  outputMode = 'immersive'
}) {
  return {
    id: createInstallationId(),
    personaId: persona.id,
    personaName: persona.name,
    roleName: variables.ROLE_NAME ?? persona.defaults?.ROLE_NAME ?? persona.name,
    roleLabel: variables.LOG_LABEL ?? variables.ARCHETYPE_TITLE ?? persona.name,
    agentId: agent.id,
    agentName: agent.name,
    adapterId: adapter.id,
    adapterName: adapter.title,
    platform,
    registry,
    outputDir,
    outputFile,
    generatedFiles,
    diaryMode,
    outputMode,
    sharedDir: variables.SHARED_DIR ?? '',
    sharedLogPath: variables.SHARED_LOG_PATH ?? '',
    sharedPhotoDir: variables.SHARED_PHOTO_DIR ?? '',
    relatedInstallations,
    createdAt: new Date().toISOString()
  };
}

export function formatInstallationChoice(installation) {
  const parts = [
    installation.roleName || installation.personaName || installation.personaId,
    installation.roleLabel || installation.personaName,
    installation.agentName,
    installation.outputDir
  ].filter(Boolean);

  return parts.join(' · ');
}

function createInstallationId() {
  const time = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${time}-${crypto.randomBytes(4).toString('hex')}`;
}

function getAppDataDir() {
  if (process.env.PERSONAPARTY_HOME) {
    return process.env.PERSONAPARTY_HOME;
  }

  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'PersonaParty');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'PersonaParty');
  }

  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'personaparty');
}

function pathsEqual(p1, p2) {
  if (!p1 || !p2) {
    return p1 === p2;
  }
  const norm1 = path.normalize(p1);
  const norm2 = path.normalize(p2);
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return norm1.toLowerCase() === norm2.toLowerCase();
  }
  return norm1 === norm2;
}
