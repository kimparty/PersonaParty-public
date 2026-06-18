import path from 'node:path';
import fs from 'fs-extra';
import { fetchJson } from './fetch-helper.js';

export async function fetchRegistry({ explicitRegistry, remoteRegistryUrl, localRegistryPath, systemRegistryPath }) {
  if (explicitRegistry) {
    return readRegistry(explicitRegistry, systemRegistryPath);
  }

  if (remoteRegistryUrl) {
    try {
      return await readRegistry(remoteRegistryUrl, systemRegistryPath);
    } catch {
      return readRegistry(localRegistryPath, systemRegistryPath);
    }
  }

  return readRegistry(localRegistryPath, systemRegistryPath);
}

export async function readRegistry(registryLocation, systemRegistryPath) {
  const sourceUrl = registryLocation || '';
  const registry = await readJsonLocation(sourceUrl);
  const mergedRegistry = await mergeWithSystemRegistry(registry, sourceUrl, systemRegistryPath);

  if (!Array.isArray(mergedRegistry.personas)) {
    throw new Error('Invalid registry: expected a "personas" array.');
  }
  if (!Array.isArray(mergedRegistry.agents)) {
    throw new Error('Invalid system registry: expected an "agents" array.');
  }

  return {
    ...mergedRegistry,
    sourceUrl
  };
}

export function normalizeAgent(agent) {
  if (!agent?.id || !agent?.name || !agent?.defaultFile) {
    throw new Error('Invalid agent entry: each agent requires "id", "name", and "defaultFile".');
  }

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description ?? '',
    adapter: agent.adapter ?? agent.id,
    defaultFile: normalizeOutputPath(agent.defaultFile)
  };
}

async function mergeWithSystemRegistry(registry, sourceUrl, systemRegistryPath) {
  if (Array.isArray(registry.agents)) {
    return registry;
  }

  const systemRegistry = registry.system
    ? await readJsonLocation(resolveSiblingLocation(registry.system, sourceUrl, 'system registry'))
    : await readJsonLocation(systemRegistryPath);

  return {
    ...systemRegistry,
    version: registry.version ?? systemRegistry.version,
    locale: registry.locale ?? systemRegistry.locale,
    personas: registry.personas ?? [],
    sourceUrl
  };
}

async function readJsonLocation(location) {
  const sourceUrl = location || '';
  if (isHttpUrl(sourceUrl)) {
    return fetchJson(sourceUrl);
  }

  const filePath = path.resolve(process.cwd(), sourceUrl);
  try {
    return await fs.readJson(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Registry 文件不存在：${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Registry 不是有效 JSON：${filePath}`);
    }
    throw error;
  }
}

function resolveSiblingLocation(location, sourceUrl, label = 'registry file') {
  if (isHttpUrl(location) || path.isAbsolute(location)) {
    if (!isHttpUrl(location)) {
      throw new Error(`Unsafe ${label} path: ${location}`);
    }
    return location;
  }

  if (isHttpUrl(sourceUrl)) {
    return new URL(location, sourceUrl).toString();
  }

  return resolveContainedPath(path.dirname(path.resolve(process.cwd(), sourceUrl)), location, label);
}

export function normalizePersona(persona) {
  if (!persona?.id || !persona?.name) {
    throw new Error('Invalid persona entry: each persona requires "id" and "name".');
  }

  const hasInlineTemplate = typeof persona.template === 'string' && persona.template.trim().length > 0;
  const hasSourceTemplate = typeof persona.source === 'string' && persona.source.trim().length > 0;
  if (!hasInlineTemplate && !hasSourceTemplate) {
    throw new Error(`Invalid persona "${persona.id}": expected a non-empty "template" or "source".`);
  }

  return {
    id: persona.id,
    name: persona.name,
    description: persona.description ?? '',
    defaults: persona.defaults ?? {},
    relationSlots: normalizeRelationSlots(persona.relationSlots),
    template: persona.template ?? null,
    source: persona.source ?? null,
    transform: normalizeTransform(persona.transform)
  };
}

function normalizeRelationSlots(relationSlots = []) {
  if (!Array.isArray(relationSlots)) {
    return [];
  }

  return relationSlots
    .filter((slot) => typeof slot?.slot === 'string' && slot.slot.trim())
    .map((slot) => ({
      slot: slot.slot.trim(),
      label: typeof slot.label === 'string' ? slot.label : '',
      targetPersonaIds: normalizeStringArray(slot.targetPersonaIds),
      description: typeof slot.description === 'string' ? slot.description : ''
    }));
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
}

export function normalizeStorageProfiles(storageProfiles = {}) {
  return {
    windows: normalizeStorageProfile(storageProfiles.windows),
    linux: normalizeStorageProfile(storageProfiles.linux),
    darwin: normalizeStorageProfile(storageProfiles.darwin),
    default: normalizeStorageProfile(storageProfiles.default)
  };
}

export function normalizeNamePacks(namePacks = []) {
  if (!Array.isArray(namePacks)) {
    return [];
  }

  return namePacks
    .filter((pack) => pack?.id && Array.isArray(pack.names))
    .map((pack) => ({
      id: pack.id,
      name: pack.name ?? pack.id,
      names: pack.names.filter((name) => typeof name === 'string' && name.trim())
    }));
}

export function resolveTemplateUrl(templateUrl, registrySourceUrl) {
  if (isHttpUrl(templateUrl)) {
    return templateUrl;
  }

  if (isHttpUrl(registrySourceUrl)) {
    return new URL(templateUrl, registrySourceUrl).toString();
  }

  const baseDir = registrySourceUrl
    ? path.dirname(path.resolve(process.cwd(), registrySourceUrl))
    : process.cwd();
  return resolveContainedPath(baseDir, templateUrl, 'template source');
}

export function normalizeRemoteTemplate(template, registrySourceUrl) {
  const rawUrl = typeof template === 'string' ? template : template.url ?? template.source;
  const outputPath = typeof template === 'string' ? path.basename(template) : template.path ?? template.output;

  if (!rawUrl || !outputPath) {
    throw new Error('Invalid template entry: each template requires a source URL and output path.');
  }

  return {
    url: resolveTemplateUrl(rawUrl, registrySourceUrl),
    path: normalizeOutputPath(outputPath)
  };
}

function normalizeTransform(transform = {}) {
  const replace = Array.isArray(transform.replace) ? transform.replace : [];
  return {
    replace: replace
      .filter((entry) => typeof entry?.from === 'string' && typeof entry?.to === 'string')
      .map((entry) => ({ from: entry.from, to: entry.to }))
  };
}

function normalizeStorageProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    sharedDir: profile.sharedDir ?? '',
    logPath: profile.logPath ?? '',
    photoDir: profile.photoDir ?? '',
    downloadCommandHint: profile.downloadCommandHint ?? '',
    createPhotoDirHint: profile.createPhotoDirHint ?? ''
  };
}

function normalizeOutputPath(outputPath) {
  const normalized = outputPath.replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || normalized.includes('..')) {
    throw new Error(`Unsafe template output path: ${outputPath}`);
  }
  return normalized;
}

function resolveContainedPath(baseDir, targetPath, label) {
  if (path.isAbsolute(targetPath)) {
    throw new Error(`Unsafe ${label} path: ${targetPath}`);
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, targetPath);
  const relativeTarget = path.relative(resolvedBase, resolvedTarget);

  if (relativeTarget === '' || (!relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget))) {
    return resolvedTarget;
  }

  throw new Error(`Unsafe ${label} path: ${targetPath}`);
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}
