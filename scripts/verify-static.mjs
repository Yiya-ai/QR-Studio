import { access, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'studio.js',
  'studio-core.js',
  'start.bat',
  'start.ps1',
  'scripts/serve.mjs',
  'scripts/build-static.mjs',
  'deploy/nginx-qr-studio.conf',
  'vendor/qrcodegen.js',
  'vendor/jsqr.js',
];

for (const file of requiredFiles) {
  const path = resolve(root, file);
  await access(path);
  if ((await stat(path)).size === 0) throw new Error(`${file} must not be empty.`);
}

const html = await readFile(resolve(root, 'index.html'), 'utf8');
const script = await readFile(resolve(root, 'app.js'), 'utf8');
const requiredMarkup = ['vendor/qrcodegen.js', 'vendor/jsqr.js', 'studio-core.js', 'studio.js', 'text-file-input', 'decoder-file', 'batch-input'];
const requiredHandlers = ['generateQr', 'decodeFile', 'importTextFile'];

for (const value of requiredMarkup) {
  if (!html.includes(value)) throw new Error(`Required markup is missing: ${value}`);
}
for (const value of requiredHandlers) {
  if (!script.includes(value)) throw new Error(`Required handler is missing: ${value}`);
}

console.log('Static release checks passed.');
