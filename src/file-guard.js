import path from 'node:path';
import fs from 'fs-extra';

const KNOWN_AGENT_FILES = ['GEMINI.md', 'AGENTS.md', 'CLAUDE.md'];

export async function findExistingAgentFiles(dir, additionalFiles = []) {
  const fileNames = [...new Set([...KNOWN_AGENT_FILES, ...additionalFiles])];
  const found = [];

  for (const fileName of fileNames) {
    const fullPath = path.join(dir, fileName);
    if (await fs.pathExists(fullPath)) {
      found.push(fullPath);
    }
  }

  return found;
}
