import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const html = read('index.html');
const app = read('js/app.js');
const content = read('js/content.js');
const errors = [];

for (const match of html.matchAll(/(?:src|href|data-src)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g)) {
  if (!existsSync(resolve(root, match[1]))) errors.push(`Missing local asset: ${match[1]}`);
}

const contentImport = app.match(/import\s*{([^}]+)}\s*from\s*['"]\.\/content\.js[^'"]*['"]/);
if (!contentImport) {
  errors.push('app.js must import the content module');
} else {
  const importedNames = contentImport[1].split(',').map((name) => name.trim()).filter(Boolean);
  const exportedNames = new Set(
    [...content.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1])
  );
  for (const name of importedNames) {
    if (!exportedNames.has(name)) errors.push(`content.js does not export: ${name}`);
  }
}

if (/<style(?:\s|>)/i.test(html)) errors.push('Keep CSS in styles.css, not index.html');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push('Keep JavaScript out of index.html');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Site structure, module exports, and local assets are valid.');
