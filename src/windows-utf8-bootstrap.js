import { execSync } from 'node:child_process';
import process from 'node:process';

let bootstrapped = false;
let bootstrapResult = null;

export function ensureWindowsUtf8() {
  if (bootstrapped) {
    return bootstrapResult;
  }

  bootstrapped = true;

  if (process.platform !== 'win32') {
    bootstrapResult = {
      ok: true,
      changed: false,
      platform: process.platform,
      reason: 'not-windows'
    };
    return bootstrapResult;
  }

  try {
    execSync('chcp 65001', { stdio: 'ignore' });
    bootstrapResult = {
      ok: true,
      changed: true,
      platform: process.platform,
      reason: 'code-page-set-to-utf8'
    };
  } catch (error) {
    bootstrapResult = {
      ok: false,
      changed: false,
      platform: process.platform,
      reason: 'chcp-failed',
      error
    };
  }

  for (const stream of [process.stdout, process.stderr]) {
    if (typeof stream?.setDefaultEncoding === 'function') {
      stream.setDefaultEncoding('utf8');
    }
  }

  return bootstrapResult;
}
