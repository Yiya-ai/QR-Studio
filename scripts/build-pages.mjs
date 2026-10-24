import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await Promise.all([
  cp(resolve(root, 'index.html'), resolve(dist, 'index.html')),
  cp(resolve(root, 'styles.css'), resolve(dist, 'styles.css')),
  cp(resolve(root, 'app.js'), resolve(dist, 'app.js')),
  cp(resolve(root, 'studio.js'), resolve(dist, 'studio.js')),
  cp(resolve(root, 'studio-core.js'), resolve(dist, 'studio-core.js')),
  cp(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(dist, 'THIRD_PARTY_NOTICES.md')),
]);
await mkdir(resolve(dist, 'vendor'));
for (const file of ['qrcodegen.js', 'jsqr.js', 'jsqr.LICENSE.txt']) {
  await cp(resolve(root, 'vendor', file), resolve(dist, 'vendor', file));
}

console.log('GitHub Pages bundle created in dist/.');
