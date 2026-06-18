#!/usr/bin/env node

import process from 'node:process';
import { Command } from 'commander';
import { ensureWindowsUtf8 } from './windows-utf8-bootstrap.js';

ensureWindowsUtf8();
const { initCommand } = await import('./commands/init.js');

const program = new Command();

program
  .name('pp')
  .description('Scaffold templated multi-file AI persona prompt workspaces.')
  .version('0.1.0');

program.addCommand(initCommand());

const knownTopLevelCommands = new Set(['init', 'help']);
const rootHelpOptions = new Set(['--help', '-h', '--version', '-V']);
const hasSubcommand = process.argv.length > 2 && !process.argv[2].startsWith('-') && knownTopLevelCommands.has(process.argv[2]);
const hasRootHelpOption = process.argv.length > 2 && rootHelpOptions.has(process.argv[2]);
const hasInitOptions = process.argv.length > 2 && process.argv[2].startsWith('-') && !hasRootHelpOption;

if (process.argv.length <= 2 || hasInitOptions) {
  process.argv.splice(2, 0, 'init');
} else if (!hasSubcommand && !hasRootHelpOption) {
  process.argv.splice(2, 0, 'init');
}

program.parseAsync(process.argv).catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
