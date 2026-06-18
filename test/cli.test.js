import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(repoRoot, 'src', 'cli.js');

function runCli(args, { input = null } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        CI: '1',
        NO_COLOR: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    if (input === null) {
      child.stdin.end();
    } else {
      child.stdin.end(input);
    }
  });
}

test('root help lists init command instead of forwarding to init help', async () => {
  const result = await runCli(['--help']);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage: pp \[options\] \[command\]/u);
  assert.match(result.stdout, /init/u);
});

test('non-interactive init requires --yes before prompting', async () => {
  const result = await runCli(['init', '--registry', './registry.personas.json']);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /当前不是交互式终端/u);
  assert.doesNotMatch(result.stderr, /ERR_USE_AFTER_CLOSE/u);
});

test('invalid agent errors before rendering banner', async () => {
  const result = await runCli([
    'init',
    '--registry',
    './registry.personas.json',
    '--agent',
    'nonexistent',
    '--yes'
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Agent "nonexistent" was not found/u);
  assert.doesNotMatch(result.stdout, /色气工坊/u);
});
