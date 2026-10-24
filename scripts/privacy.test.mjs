import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const studioSource = await readFile(new URL('../studio.js', import.meta.url), 'utf8');

// Run the actual page handlers with a deterministic clock and deferred file reads.
function fixture(withStudio = false) {
  let now = 100000;
  let nextTimer = 0;
  const timers = new Map();
  const revoked = [];
  const images = [];
  const nodes = new Map();
  const windowEvents = new Map();
  const documentEvents = new Map();
  function node() {
    const handlers = new Map();
    let width = 512;
    return {
      value: '', defaultValue: '', textContent: '', hidden: false, disabled: false,
      dataset: {}, checked: false, maxLength: 2950, bitmap: 'old pixels',
      get width() { return width; },
      set width(value) { width = value; this.bitmap = ''; },
      classList: { add() {}, remove() {} },
      setAttribute(key, value) { this[key] = value; },
      removeAttribute(key) { delete this[key]; },
      focus() {}, scrollIntoView() {},
      append() {}, replaceChildren() {}, querySelectorAll() { return []; },
      showModal() { this.open = true; },
      close() { this.open = false; this.fire('close'); },
      addEventListener(name, fn) { handlers.set(name, fn); },
      fire(name, event = {}) { return handlers.get(name)?.(event); },
    };
  }
  const document = {
    body: node(),
    hidden: false,
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, node());
      return nodes.get(selector);
    },
    querySelectorAll() { return []; },
    getElementById(id) { return this.querySelector(`#${id}`); },
    addEventListener(name, fn) { documentEvents.set(name, fn); },
  };
  document.querySelector('#auto-clear-select').value = '5';
  document.querySelector('#foreground-color').value = '#17172a';
  document.querySelector('#background-color').value = '#ffffff';
  const window = {
    location: { hash: '' },
    QRStudioCore: { svg: () => '<svg xmlns="http://www.w3.org/2000/svg"/>' },
    setTimeout(fn, ms) { timers.set(++nextTimer, { fn, at: now + ms }); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, fn) { windowEvents.set(name, fn); },
    jsQR() { throw new Error('Cancelled image must not reach decoder'); },
  };
  const context = vm.createContext({
    window, document, TextEncoder, Blob, Date: { now: () => now },
    URL: { createObjectURL: () => `blob:test-${images.length}`, revokeObjectURL: (url) => revoked.push(url) },
    Image: class {
      constructor() { images.push(this); }
      removeAttribute(key) { delete this[key]; }
    },
  });
  vm.runInContext(source, context);
  if (withStudio) vm.runInContext(studioSource, context);
  return {
    context, nodes, revoked, images, document, timers,
    get: (id) => document.querySelector(`#${id}`),
    run: (code) => vm.runInContext(code, context),
    jump(ms) { now += ms; },
    tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) { timers.delete(id); timer.fn(); }
      }
    },
    windowEvent: (name, event = {}) => windowEvents.get(name)?.(event),
    documentEvent: (name) => documentEvents.get(name)?.(),
  };
}

test('clipboard fallback reports failure truthfully and always clears temporary text', async () => {
  for (const result of [true, false, 'throws']) {
    const f = fixture();
    f.context.navigator = { clipboard: { writeText: async () => { throw new Error('Denied'); } } };
    const fallback = { value: '', select() {}, remove() { this.removed = true; } };
    f.document.createElement = () => fallback;
    f.document.execCommand = () => { if (result === 'throws') throw new Error('Blocked'); return result; };
    await f.run('copyText("private text", "复制成功")');
    assert.equal(f.get('toast').textContent, result === true ? '复制成功' : '复制未成功，请选中文本后手动复制。');
    assert.equal(fallback.value, '');
    assert.equal(fallback.removed, true);
  }
});

test('changing content type forgets the previous imported filename', () => {
  const f = fixture(true);
  f.get('text-file-status').textContent = '已导入 private-filename.txt';
  f.run('window.QRStudio.textMode()');
  assert.ok(!f.get('text-file-status').textContent.includes('private-filename'));
});

test('actual zoom dialog closes and releases its image at the privacy deadline', () => {
  const f = fixture(true);
  f.get('content-input').value = 'private zoom data';
  f.run('currentQr = {}');
  f.get('zoom-single-button').fire('click');
  assert.equal(f.get('zoom-dialog').open, true);
  assert.ok(f.get('zoom-image').src.startsWith('blob:'));
  f.tick(300000);
  assert.equal(f.get('zoom-dialog').open, false);
  assert.equal(f.get('zoom-image').src, undefined);
  assert.equal(f.get('content-input').value, '');
  assert.deepEqual(f.revoked, ['blob:test-0']);
});

test('zoom close, clear-all, and changed source remove private image without stale-close races', () => {
  const f = fixture(true);
  const open = () => { f.get('content-input').value = 'private'; f.run('currentQr = {}'); f.get('zoom-single-button').fire('click'); };
  open();
  f.get('zoom-close-button').fire('click');
  assert.equal(f.get('zoom-image').src, undefined);
  open();
  f.get('zoom-dialog').fire('close'); // Delayed event from an earlier opening.
  assert.equal(f.get('zoom-dialog').open, true);
  assert.ok(f.get('zoom-image').src);
  f.get('zoom-clear-button').fire('click');
  assert.equal(f.get('zoom-dialog').open, false);
  assert.equal(f.get('content-input').value, '');
  assert.equal(f.get('zoom-image').src, undefined);
  open();
  f.run('queueGeneration()');
  assert.equal(f.get('zoom-dialog').open, false);
  assert.equal(f.get('zoom-image').src, undefined);
  assert.equal(f.revoked.length, 3);
});

test('extended form and batch data participate in idle cleanup and clear-all', () => {
  const f = fixture();
  f.run('window.QRStudio = { privateData: true, hasData() { return this.privateData; }, clear() { this.privateData = false; } }; noteActivity()');
  f.tick(300000);
  assert.equal(f.run('window.QRStudio.privateData'), false);
  f.run('window.QRStudio.privateData = true');
  f.get('clear-all-button').fire('click');
  assert.equal(f.run('window.QRStudio.privateData'), false);
});

test('clear button wipes all page surfaces, URLs, file selections and pending generation', () => {
  const f = fixture();
  for (const id of ['content-input', 'decoded-output', 'text-file-input', 'decoder-file']) f.get(id).value = 'private';
  f.get('qr-canvas').bitmap = 'private QR';
  f.get('decoder-image').src = 'blob:private';
  f.run("previewUrl = 'blob:private'; queueGeneration()");
  f.get('clear-all-button').fire('click');
  for (const id of ['content-input', 'decoded-output', 'text-file-input', 'decoder-file']) assert.equal(f.get(id).value, '');
  assert.equal(f.get('decoder-image').src, undefined);
  assert.equal(f.get('qr-canvas').bitmap, '');
  assert.equal(f.get('qr-canvas').hidden, true);
  assert.equal(f.get('decoded-result').hidden, true);
  assert.equal(f.get('download-button').disabled, true);
  assert.deepEqual(f.revoked, ['blob:private']);
  f.tick(500);
  assert.equal(f.get('content-input').value, '');
});

test('default five-minute timeout resets on activity and expires at the deadline', () => {
  const f = fixture();
  f.get('content-input').value = 'private';
  f.run('noteActivity()');
  f.tick(299999);
  assert.equal(f.get('content-input').value, 'private');
  f.documentEvent('keydown');
  f.tick(1);
  assert.equal(f.get('content-input').value, 'private');
  f.tick(299999);
  assert.equal(f.get('content-input').value, '');
});

test('each offered timeout expires, and disabled automatic clearing preserves content', () => {
  for (const minutes of [1, 5, 15, 30, 0]) {
    const f = fixture();
    f.get('auto-clear-select').value = String(minutes);
    f.get('content-input').value = 'private';
    f.run('noteActivity()');
    f.tick((minutes || 60) * 60000);
    assert.equal(f.get('content-input').value, minutes ? '' : 'private');
  }
});

test('suspended tabs clear before a new click can reset an expired deadline', () => {
  const f = fixture();
  f.get('content-input').value = 'private';
  f.run('noteActivity()');
  f.jump(300001);
  f.documentEvent('click');
  assert.equal(f.get('content-input').value, '');
});

test('background, page exit and back-forward cache restore clear content', () => {
  const f = fixture();
  f.get('content-input').value = 'private';
  f.document.hidden = true;
  f.documentEvent('visibilitychange');
  assert.equal(f.get('content-input').value, 'private');
  f.get('clear-on-hide').checked = true;
  f.documentEvent('visibilitychange');
  assert.equal(f.get('content-input').value, '');
  f.get('content-input').value = 'private';
  f.windowEvent('pagehide');
  assert.equal(f.get('content-input').value, '');
  f.get('content-input').value = 'restored';
  f.windowEvent('pageshow', { persisted: true });
  assert.equal(f.get('content-input').value, '');
});

test('late text reads cannot repopulate cleared content or overwrite newer input', async () => {
  for (const action of ['clear', 'type', 'expire']) {
    const f = fixture();
    let resolve;
    f.context.file = { size: 12, name: 'private.txt', text: () => new Promise((done) => { resolve = done; }) };
    const pending = f.run('importTextFile(file)');
    if (action === 'clear') f.get('clear-all-button').fire('click');
    if (action === 'type') { f.get('content-input').value = 'new'; f.get('content-input').fire('input'); }
    if (action === 'expire') f.jump(300001);
    resolve('late secret');
    await pending;
    assert.equal(f.get('content-input').value, action === 'type' ? 'new' : '');
    assert.ok(!f.get('text-file-status').textContent.includes('private.txt'));
  }
});

test('normal page show clears browser-restored form data and restores safe defaults', () => {
  const f = fixture();
  f.get('content-input').value = 'restored secret';
  f.get('auto-clear-select').value = '0';
  f.get('clear-on-hide').checked = true;
  f.windowEvent('pageshow', { persisted: false });
  assert.equal(f.get('content-input').value, '');
  assert.equal(f.get('auto-clear-select').value, '5');
  assert.equal(f.get('clear-on-hide').checked, false);
});

test('file imports still work, and newest import wins when reads finish out of order', async () => {
  const f = fixture();
  let first, second;
  f.context.first = { size: 10, name: 'first.txt', text: () => new Promise((done) => { first = done; }) };
  f.context.second = { size: 10, name: 'second.txt', text: () => new Promise((done) => { second = done; }) };
  const a = f.run('importTextFile(first)');
  const b = f.run('importTextFile(second)');
  second('newer'); await b;
  first('older'); await a;
  assert.equal(f.get('content-input').value, 'newer');
});

test('clear during image loading cancels work and never restores its preview or results', async () => {
  const f = fixture();
  f.context.file = { size: 20, type: 'image/png' };
  const pending = f.run('decodeFile(file)');
  assert.equal(f.images.length, 1);
  f.get('clear-all-button').fire('click');
  await pending;
  assert.equal(f.images[0].src, undefined);
  assert.equal(f.get('decoder-image').src, undefined);
  assert.equal(f.get('decoded-output').value, '');
  assert.equal(f.revoked.length, 1);
  assert.equal(f.get('decoder-status').dataset.state, 'info');
});
