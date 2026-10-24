import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('real local server serves all application assets and rejects private paths and writes', { timeout: 15000 }, async () => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, [fileURLToPath(new URL('./serve.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not start')), 5000);
      const finish = (error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
      child.once('error', finish);
      child.once('exit', (code) => finish(new Error(`Server exited: ${code}`)));
      child.stdout.on('data', (chunk) => { if (String(chunk).includes('is running')) finish(); });
    });
    const base = `http://127.0.0.1:${port}`;
    for (const path of ['/', '/styles.css', '/app.js', '/studio.js', '/studio-core.js', '/vendor/qrcodegen.js', '/vendor/jsqr.js']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.ok(response.headers.get('content-security-policy').includes("connect-src 'none'"));
      assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.ok((await response.text()).length > 0);
    }
    for (const path of ['/.git/config', '/README.md', '/package.json', '/%2e%2e/.env', '/vendor/qrcode.min.js']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 403, path);
      await response.text();
    }
    const post = await fetch(base + '/', { method: 'POST', body: 'synthetic-private-content' });
    assert.equal(post.status, 405);
    await post.text();
    const head = await fetch(base + '/studio.js', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    // Use raw HTTP: fetch implementations may replace a supplied Host header.
    const wrongHost = await new Promise((resolve, reject) => {
      get(base + '/', { headers: { host: 'untrusted.example' } }, (response) => {
        response.resume(); response.on('end', () => resolve(response.statusCode));
      }).on('error', reject);
    });
    assert.equal(wrongHost, 403);
  } finally {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
  }
});
