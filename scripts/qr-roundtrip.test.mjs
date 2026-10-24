import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const [encoder, decoder] = await Promise.all([
  readFile(new URL('../vendor/qrcodegen.js', import.meta.url), 'utf8'),
  readFile(new URL('../vendor/jsqr.js', import.meta.url), 'utf8'),
]);
function element() {
  return {
    children: [], setAttribute() {}, setAttributeNS() {},
    appendChild(child) { this.children.push(child); },
    hasChildNodes() { return this.children.length > 0; },
    get lastChild() { return this.children.at(-1); },
    removeChild() { this.children.pop(); },
  };
}
const context = vm.createContext({
  TextEncoder, navigator: { userAgent: 'test' },
  document: { documentElement: { tagName: 'svg' }, createElementNS: element },
});
vm.runInContext(encoder, context);
vm.runInContext(decoder, context);

for (const content of ['privacy-test', '隐私验证：本地二维码 123', 'WIFI:T:WPA;S:我的 Wi-Fi;P:密码123;;', '二维码 🔒 café', 'a'.repeat(200), '  保留空格\n', '1234567890'.repeat(40)]) {
  test(`QR encode/decode round trip: ${content.slice(0, 35)}`, () => {
    const matrix = context.qrcodegen.QrCode.encodeText(content, context.qrcodegen.QrCode.Ecc.MEDIUM);
    const count = matrix.size;
    const scale = 5;
    const size = (count + 8) * scale;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!matrix.getModule(col, row)) continue;
        for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
          const at = (((row + 4) * scale + y) * size + (col + 4) * scale + x) * 4;
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
        }
      }
    }
    const result = context.jsQR(pixels, size, size);
    assert.equal(result?.data.replace(/^\uFEFF/, ''), content);
  });
}
