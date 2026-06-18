export function renderTemplate(content, variables) {
  let rendered = content;

  for (let index = 0; index < 5; index += 1) {
    const next = rendered.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (placeholder, variable) => {
      return Object.hasOwn(variables, variable) ? variables[variable] : placeholder;
    });

    if (next === rendered) {
      break;
    }

    rendered = next;
  }

  return rendered;
}
