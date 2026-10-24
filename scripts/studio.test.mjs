import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { test } from 'node:test';

const ctx = vm.createContext({ TextEncoder, URL, Blob, Uint8Array, Uint8ClampedArray, DataView });
for (const file of ['vendor/qrcodegen.js', 'vendor/jsqr.js', 'studio-core.js']) vm.runInContext(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'), ctx);
const core = ctx.QRStudioCore;

test('typed forms create valid Wi-Fi, vCard, mail, tel and SMS payloads', () => {
  assert.equal(core.payload('wifi', { ssid: 'a;b:c"d\\e', password: 'p;w', auth: 'WPA', hidden: true }), 'WIFI:T:WPA;S:a\\;b\\:c\\"d\\\\e;P:p\\;w;H:true;;');
  assert.equal(core.payload('wifi', { ssid: '网络', password: 'ignored', auth: 'nopass' }), 'WIFI:T:nopass;S:网络;;');
  const card = core.payload('contact', { name: '张,小;语', organization: '测试公司', phone: '+86 138-0000-0000', email: 'a@example.com' });
  assert.ok(card.includes('N:;张\\,小\\;语;;;\r\nFN:张\\,小\\;语'));
  assert.ok(card.includes('TEL;TYPE=CELL:+8613800000000'));
  assert.ok(card.endsWith('\r\nEND:VCARD'));
  assert.equal(core.payload('phone', { phone: '+86 (138) 0000-0000' }), 'tel:+8613800000000');
  assert.equal(core.payload('sms', { phone: '12345', message: '你好:测试' }), 'SMSTO:12345:你好:测试');
  assert.equal(core.payload('email', { email: 'a@example.com', subject: 'a&bcc=x', message: '你好\nworld' }), 'mailto:a@example.com?subject=a%26bcc%3Dx&body=%E4%BD%A0%E5%A5%BD%0Aworld');
});

test('payload validation rejects active URLs, credential URLs, injected fields and bad input', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', 'https://example.com\nextra']) assert.throws(() => core.payload('url', { url }));
  assert.equal(core.payload('url', { url: 'example.com/path?q=中文' }), 'https://example.com/path?q=%E4%B8%AD%E6%96%87');
  assert.throws(() => core.payload('contact', { name: 'name\r\nURL:evil' }));
  assert.throws(() => core.payload('email', { email: 'a@example.com?bcc=b@example.com' }));
  assert.throws(() => core.payload('wifi', { ssid: '中文'.repeat(8), auth: 'nopass' }));
  assert.throws(() => core.payload('phone', { phone: '12;123' }));
});

test('CSV and line parser preserve quoted multiline data, names and whitespace', () => {
  const rows = core.batch('\uFEFFname,content\r\n标签,"hello,world"\r\n多行,"line 1\nline ""2"""\r\n', 'csv');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].content, 'hello,world');
  assert.equal(rows[1].content, 'line 1\nline "2"');
  const lines = core.batch('标签\t first \r\n\nsecond');
  assert.equal(lines[0].content, ' first ');
  assert.equal(lines[1].name, '二维码 2');
  assert.throws(() => core.batch('a,"b', 'csv'));
  assert.throws(() => core.batch('a,b,c', 'csv'));
  assert.throws(() => core.batch('name,content,extra\na,b,c', 'csv'));
  assert.equal(core.batch('\n\r\nname,content\n标签,hello', 'csv').length, 1);
  assert.throws(() => core.batch(Array(51).fill('a').join('\n')));
});

test('rendered PNG pixels round-trip with integer modules and at least four quiet modules', () => {
  for (const content of ['中文与 emoji 🔒', '  whitespace\n', 'x'.repeat(400)]) {
    for (const width of [256, 512, 1024]) {
      const qr = core.encode(content, 'M');
      const pixels = new Uint8ClampedArray(width * width * 4);
      const drawContext = {
        fillStyle: '',
        fillRect(x, y, w, h) {
          assert.ok([x, y, w, h].every(Number.isInteger));
          const color = this.fillStyle.slice(1).match(/../g).map((p) => parseInt(p, 16));
          for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) pixels.set([...color, 255], (row * width + col) * 4);
        },
      };
      const canvas = { getContext: () => drawContext };
      const scale = core.draw(qr, canvas, { width, margin: 4 });
      const offset = Math.floor((width - qr.size * scale) / 2);
      assert.ok(offset >= 4 * scale);
      assert.equal(ctx.jsQR(pixels, width, width)?.data, content);
      const output = core.svg(qr, { width, margin: 4 });
      assert.ok(output.includes(`viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"`));
      assert.ok(!output.includes(content));
    }
  }
});

test('SVG escapes by construction and color/quality checks catch unsafe values', () => {
  const qr = core.encode('<script>alert(1)</script>');
  assert.ok(!core.svg(qr).includes('<script>'));
  assert.throws(() => core.svg(qr, { dark: '" onload="alert(1)' }));
  assert.throws(() => core.svg(qr, { margin: 0 }));
  assert.ok(core.quality({ dark: '#ffffff', light: '#ffffff' }, qr.size).warning);
  assert.ok(core.quality({ dark: '#ffffff', light: '#000000' }, qr.size).warning);
  assert.equal(core.quality({ dark: '#000000', light: '#ffffff' }, qr.size).contrast, 21);
  assert.ok(!/[\\/<>:"|?*]/.test(core.filename('../../密码:name')));
  assert.equal(core.filename('CON'), '_CON');
  assert.equal(core.filename('nul.txt'), '_nul.txt');
  assert.equal(core.filename('a'.repeat(63) + '.x'), 'a'.repeat(63));
  assert.equal(core.filename('🔒'.repeat(70)), '🔒'.repeat(64));
});

test('generated ZIP has valid CRCs, UTF-8 filenames and readable SVG files', async () => {
  const known = await core.zip([{ name: 'crc.txt', data: core.utf8('123456789') }]).arrayBuffer();
  assert.equal(new DataView(known).getUint32(14, true), 0xcbf43926);
  const dir = await mkdtemp(join(tmpdir(), 'qr-studio-zip-'));
  try {
    const svg = core.svg(core.encode('ZIP integration test'));
    const zip = core.zip([{ name: '001-标签.svg', data: core.utf8(svg) }, { name: '002-next.svg', data: core.utf8(svg) }]);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    const view = new DataView(bytes.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    assert.equal(view.getUint16(6, true), 0x800);
    await writeFile(join(dir, 'test.zip'), bytes);
    // Independent ZIP implementation, not our writer, checks the archive.
    const command = process.platform === 'win32' ? 'powershell' : 'python3';
    if (process.platform === 'win32') {
      const literal = join(dir, 'test.zip').replace(/'/g, "''");
      const result = execFileSync(command, ['-NoProfile', '-Command', `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${literal}'); try { foreach($e in $z.Entries) { $r=[IO.StreamReader]::new($e.Open()); try { if(-not $r.ReadToEnd().StartsWith('<svg ')) { throw 'Invalid SVG' }; $e.FullName } finally { $r.Dispose() } } } finally { $z.Dispose() }`], { encoding: 'utf8' });
      assert.ok(result.includes('002-next.svg'));
    } else {
      execFileSync(command, ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert len(z.namelist())==2; assert all(z.read(n).startswith(b"<svg ") for n in z.namelist())', join(dir, 'test.zip')]);
    }
  } finally {
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && basename(dir).startsWith('qr-studio-zip-'));
    await rm(dir, { recursive: true, force: true });
  }
});
