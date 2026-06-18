import os from 'node:os';
import path from 'node:path';
import { resolveTemplateUrl } from './registry.js';
import { fetchText } from './fetch-helper.js';

export async function materializePersonaTemplate(persona, registrySourceUrl, storageProfiles, targetPlatform) {
  const baseContent = persona.template ?? await readTemplateSource(persona.source, registrySourceUrl);
  const templatedContent = normalizeStorageHints(applyReplacements(baseContent, persona.transform.replace));
  const storageDefaults = resolveStorageDefaults(storageProfiles, targetPlatform);

  return {
    content: templatedContent,
    defaults: {
      ...storageDefaults,
      ...persona.defaults
    }
  };
}

function applyReplacements(content, replacements) {
  let next = content;
  for (const replacement of replacements) {
    next = next.split(replacement.from).join(replacement.to);
  }
  return next;
}

function normalizeStorageHints(content) {
  // Find the image storage rules section
  const match = content.match(/(##\s*(?:图片|照片|日记与图片|日记与照片|日记与图片存储|日记与照片存储)(?:保存规则|存储规则)(?:（必须严格遵守）)?[\s\S]*?)(?=\n##|$)/);
  if (!match) {
    return content;
  }

  const originalSection = match[1];
  const updatedSection = originalSection
    .replace(/2\.\s*.*$/m, '2. {{ DOWNLOAD_COMMAND_HINT }}。')
    .replace(/3\.\s*.*$/m, '3. {{ CREATE_PHOTO_DIR_HINT }}');

  return content.replace(originalSection, updatedSection);
}

async function readTemplateSource(source, registrySourceUrl) {
  const url = resolveTemplateUrl(source, registrySourceUrl);
  if (/^https?:\/\//i.test(url)) {
    return fetchText(url);
  }

  const { default: fs } = await import('fs-extra');
  return fs.readFile(url, 'utf8');
}

function resolveStorageDefaults(storageProfiles, targetPlatform) {
  const platform = targetPlatform || os.platform();
  const profile =
    storageProfiles[platform] ??
    storageProfiles.default ??
    {
      sharedDir: '~/.personaparty/shared',
      logPath: '~/.personaparty/shared/daily.md',
      photoDir: '~/.personaparty/shared/photos'
    };

  const targetSep = platform === 'windows' ? '\\' : '/';

  const resolvedProfile = {
    sharedDir: resolvedProfileValue(profile.sharedDir),
    logPath: resolvedProfileValue(profile.logPath),
    photoDir: resolvedProfileValue(profile.photoDir),
    downloadCommandHint: profile.downloadCommandHint,
    createPhotoDirHint: profile.createPhotoDirHint
  };

  return {
    SHARED_DIR: resolvedProfile.sharedDir,
    SHARED_LOG_PATH: resolvedProfile.logPath,
    SHARED_PHOTO_DIR: resolvedProfile.photoDir,
    DOWNLOAD_COMMAND_HINT: interpolateStorageHint(resolvedProfile.downloadCommandHint, resolvedProfile),
    CREATE_PHOTO_DIR_HINT: interpolateStorageHint(resolvedProfile.createPhotoDirHint, resolvedProfile)
  };

  function resolvedProfileValue(value) {
    return normalizeSeparators(
      String(value ?? '')
        .replaceAll('{HOME}', resolveHome(platform))
        .replaceAll('{LOCALAPPDATA}', resolveLocalAppData(platform)),
      targetSep
    );
  }
}

function resolveHome(platform) {
  if (platform === os.platform() || (platform === 'windows' && os.platform() === 'win32')) {
    return os.homedir();
  }

  if (platform === 'windows') {
    return process.env.USERPROFILE || 'C:\\Users\\user';
  }

  if (platform === 'darwin') {
    const username = currentUsername();
    return `/Users/${username}`;
  }

  const username = currentUsername();
  return `/home/${username}`;
}

function resolveLocalAppData(platform) {
  if (platform === 'windows' && (os.platform() === 'win32') && process.env.LOCALAPPDATA) {
    return process.env.LOCALAPPDATA;
  }

  if (platform === 'windows') {
    const home = resolveHome('windows');
    return `${home}\\AppData\\Local`;
  }

  return path.join(resolveHome(platform), 'AppData', 'Local');
}

function currentUsername() {
  try {
    const info = os.userInfo();
    if (info && info.username) {
      return info.username;
    }
  } catch {
    // ignore and fall through
  }

  const home = os.homedir();
  if (home) {
    const segments = home.replace(/[\\/]+$/, '').split(/[\\/]/);
    const last = segments[segments.length - 1];
    if (last) {
      return last;
    }
  }

  return 'user';
}

function normalizeSeparators(value, targetSep) {
  if (targetSep === '\\') {
    return value.replaceAll('/', '\\');
  }
  return value.replaceAll('\\', '/');
}

function interpolateStorageHint(template, profile) {
  return String(template ?? '')
    .replaceAll('{{ SHARED_PHOTO_DIR }}', profile.photoDir)
    .replaceAll('{{ SHARED_LOG_PATH }}', profile.logPath)
    .replaceAll('{{ SHARED_DIR }}', profile.sharedDir);
}
