import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const APP_CONFIG = {
  packageName: 'personaparty',
  currentVersion: '0.1.0',
  localRegistryPath: path.join(packageRoot, 'registry.personas.json'),
  systemRegistryPath: path.join(packageRoot, 'registry.system.json'),
  defaultRemoteRegistryUrl: null,
  remoteVersionManifestUrl: 'https://raw.githubusercontent.com/kimparty/PersonaParty-public/main/version-manifest.json',
  defaultOutputDir: '.',
  defaultLocale: 'zh-CN'
};
