const VARIABLE_PATTERN = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

export function extractVariablesFromTemplates(templates) {
  const variables = new Set();

  for (const template of templates) {
    for (const match of template.content.matchAll(VARIABLE_PATTERN)) {
      variables.add(match[1]);
    }
  }

  return [...variables].sort();
}
