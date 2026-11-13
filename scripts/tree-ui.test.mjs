import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../tree.js', import.meta.url), 'utf8');

// Exercise the actual UI handlers with deterministic time and deferred PNG encoding.
function fixture({ reduced = false, renderer = 'canvas', privacyMs = Infinity } = {}) {
  let now = 0, nextId = 0, expired = false, activity = 0, lastActivity = 0;
  const nodes = new Map(), timers = new Map(), frames = new Map(), documentEvents = new Map();
  const draws = [], encodes = [], canvases = [], links = [], createdUrls = [], revokedUrls = [];
  const scenes = [], disposed = [];
  function node(tag = 'div') {
    let width = 720;
    const handlers = new Map();
    return {
      tagName: tag.toUpperCase(), value: '', defaultValue: '', textContent: '', dataset: {},
      hidden: false, disabled: false, height: 720, bitmap: '',
      get width() { return width; },
      set width(value) { width = value; this.bitmap = ''; },
      setAttribute(key, value) { this[key] = value; },
      addEventListener(name, fn) { handlers.set(name, fn); },
      getBoundingClientRect() { return {width:720}; },
      setPointerCapture(id) { this.pointer = id; },
      hasPointerCapture(id) { return this.pointer === id; },
      releasePointerCapture() { delete this.pointer; },
      fire(name, event = {}) { return handlers.get(name)?.(event); },
      append() {}, remove() { this.removed = true; },
      click() { this.clicked = true; },
      toBlob(resolve) { this.resolveBlob = resolve; },
      getContext() { return { getImageData: () => ({ data: new Uint8ClampedArray(16) }) }; },
    };
  }
  function get(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }
  const seasons = ['spring', 'summer', 'autumn'].map((season) => Object.assign(node('button'), { dataset: { season } }));
  const palettes = ['natural', 'lavender', 'coral', 'gold', 'sky', 'snow'].map((palette) => Object.assign(node('button'), { dataset: { palette } }));
  const document = {
    hidden: false, body: node(), getElementById: get,
    querySelectorAll(selector) {
      if (selector === '[data-season]') return seasons;
      if (selector === '[data-palette]') return palettes;
      return [...seasons, ...palettes];
    },
    addEventListener(name, fn) { documentEvents.set(name, fn); },
    createElement(tag) {
      const result = node(tag);
      if (tag === 'canvas') canvases.push(result);
      if (tag === 'a') links.push(result);
      return result;
    },
  };
  const media = { matches: reduced, addEventListener(name, fn) { this.change = fn; } };
  const window = {
    matchMedia: () => media,
    setTimeout(fn, ms) { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    QRStudioCore: {
      encode(content) { encodes.push(content); return { size: 25, content }; },
      draw(qr, output) { output.bitmap = qr.content; },
      svg: (qr) => `<svg>${qr.content}</svg>`,
    },
    QRTreeCore: {
      createScene(qr) { const scene = { qr }; scenes.push(scene); return scene; },
      draw(output, scene, options) { output.bitmap = scene.qr.content; draws.push({ output, content: scene.qr.content, ...options }); return renderer; },
      dispose(scene) { if (scene) disposed.push(scene); },
    },
    jsQR: () => ({ data: get('tree-content').value }),
  };
  get('tree-canvas').hidden = true;
  const context = vm.createContext({
    window, document, Blob, Date: { now: () => now }, sessionVersion: 0,
    elements: { input: get('content-input') }, currentQr: undefined,
    noteActivity() { activity++; lastActivity = now; },
    checkPrivacyDeadline() {
      if (!expired && now - lastActivity < privacyMs) return false;
      window.QRTree?.clear();
      context.sessionVersion++;
      expired = false;
      return true;
    },
    URL: {
      createObjectURL(blob) { const url = `blob:tree-test-${createdUrls.length}`; createdUrls.push({ url, blob }); return url; },
      revokeObjectURL(url) { revokedUrls.push(url); },
    },
  });
  vm.runInContext(source, context);
  return {
    get, window, context, document, timers, frames, draws, encodes, canvases, links, createdUrls, revokedUrls, media, seasons, palettes, scenes, disposed,
    type(value) { get('tree-content').value = value; get('tree-content').fire('input'); },
    tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
    },
    frame(time) { for (const [id, fn] of [...frames]) { frames.delete(id); fn(time); } },
    documentEvent(name) { documentEvents.get(name)?.(); },
    expire() { expired = true; },
    get activity() { return activity; },
    get lastActivity() { return lastActivity; },
    get now() { return now; },
  };
}

function generate(f, content = '仅供本地测试 🌸') { f.type(content); f.tick(160); }

test('tree input is debounced and immediately wipes the old rendered code', () => {
  const f = fixture();
  generate(f, 'old content');
  assert.equal(f.get('tree-canvas').bitmap, 'old content');
  f.type('new');
  assert.equal(f.get('tree-canvas').bitmap, '');
  assert.equal(f.get('tree-canvas').hidden, true);
  assert.equal(f.get('tree-download-qr').disabled, true);
  f.tick(100); f.type('newest'); f.tick(159);
  assert.deepEqual(f.encodes, ['old content']);
  f.tick(1);
  assert.deepEqual(f.encodes, ['old content', 'newest']);
  assert.equal(f.get('tree-canvas').bitmap, 'newest');
  assert.equal(f.get('tree-download-qr').disabled, false);
  assert.equal(f.window.QRTree.hasData(), true);
});

test('empty and overlong input never expose the previous scene', () => {
  const f = fixture();
  generate(f);
  f.type('   '); f.tick(1000);
  assert.equal(f.get('tree-canvas').hidden, true);
  assert.equal(f.get('tree-canvas').bitmap, '');
  f.type('x'.repeat(1201)); f.tick(160);
  assert.equal(f.get('tree-status').dataset.state, 'error');
  assert.match(f.get('tree-status').textContent, /1,200/);
  assert.equal(f.encodes.length, 1);
  assert.equal(f.get('tree-download-scene').disabled, true);
});

test('encoder failures clear the output and give a recoverable error', () => {
  const f = fixture(); generate(f);
  f.window.QRStudioCore.encode = () => { throw new Error('内容过长'); };
  f.type('new content'); f.tick(160);
  assert.equal(f.get('tree-status').textContent, '内容过长');
  assert.equal(f.get('tree-canvas').bitmap, '');
  assert.equal(f.get('tree-stage').disabled, true);
});

test('clear cancels debounce and animation without repopulating content', () => {
  const f = fixture(); generate(f);
  f.get('tree-toggle').fire('click');
  assert.equal(f.frames.size, 1);
  const lateFrame = [...f.frames.values()][0];
  f.get('tree-clear').fire('click');
  assert.equal(f.frames.size, 0);
  const drawsBefore = f.draws.length;
  lateFrame(1000);
  assert.equal(f.draws.length, drawsBefore);
  assert.equal(f.get('tree-content').value, '');
  assert.equal(f.get('tree-canvas').bitmap, '');
  assert.equal(f.window.QRTree.hasData(), false);
  f.type('pending'); f.window.QRTree.clear(); f.tick(1000);
  assert.equal(f.encodes.length, 1);
  assert.equal(f.get('tree-canvas').hidden, true);
});

test('hidden workspace stops animation and repaints its final state on return', () => {
  const f = fixture(); generate(f);
  f.get('tree-toggle').fire('click'); f.frame(0);
  assert.equal(f.frames.size, 1);
  f.window.QRTree.setVisible(false);
  assert.equal(f.frames.size, 0);
  const count = f.draws.length;
  f.frame(1000);
  assert.equal(f.draws.length, count);
  f.window.QRTree.setVisible(true);
  assert.equal(f.draws.at(-1).progress, 1);
  assert.equal(f.get('tree-rotate-left').disabled, true);
});

test('document hiding and reduced motion stop requestAnimationFrame work', () => {
  const f = fixture(); generate(f);
  f.get('tree-toggle').fire('click');
  f.document.hidden = true; f.documentEvent('visibilitychange');
  assert.equal(f.frames.size, 0);
  f.document.hidden = false; f.documentEvent('visibilitychange');
  assert.equal(f.draws.at(-1).progress, 1);
  f.get('tree-toggle').fire('click');
  f.media.matches = true; f.media.change();
  assert.equal(f.frames.size, 0);
  assert.equal(f.draws.at(-1).progress, 0);
  f.get('tree-toggle').fire('click');
  assert.equal(f.frames.size, 0);
  assert.equal(f.draws.at(-1).progress, 1);
});

test('season, palette, and rotation update the displayed scene', () => {
  const f = fixture(); generate(f);
  f.seasons[2].fire('click'); f.palettes[4].fire('click');
  assert.equal(f.draws.at(-1).season, 'autumn');
  assert.equal(f.draws.at(-1).palette, 'sky');
  assert.equal(f.seasons[2]['aria-pressed'], 'true');
  assert.equal(f.palettes[4]['aria-pressed'], 'true');
  const before = f.draws.at(-1).angle;
  f.get('tree-rotate-right').fire('click');
  assert.ok(f.draws.at(-1).angle > before);
});

for (const action of ['clear', 'input', 'expired', 'session']) {
  test(`pending PNG cannot download stale data after ${action}`, async () => {
    const f = fixture(); generate(f, 'sensitive old content');
    const pending = f.get('tree-download-qr').fire('click');
    const output = f.canvases.at(-1);
    assert.equal(output.bitmap, 'sensitive old content');
    if (action === 'clear') f.window.QRTree.clear();
    if (action === 'input') f.type('replacement content');
    if (action === 'expired') f.expire();
    if (action === 'session') f.context.sessionVersion++;
    if (action === 'clear' || action === 'input') assert.equal(output.bitmap, '', 'clear must immediately wipe pending PNG canvas');
    output.resolveBlob(new Blob(['old PNG']));
    await pending;
    assert.equal(f.createdUrls.length, 0);
    assert.equal(f.links.length, 0);
    assert.equal(output.width, 0);
    assert.equal(output.bitmap, '');
  });
}

test('successful PNG export releases transient canvas and downloadable URL', async () => {
  const f = fixture(); generate(f);
  const pending = f.get('tree-download-scene').fire('click');
  const output = f.canvases.at(-1);
  output.resolveBlob(new Blob(['test PNG'])); await pending;
  assert.equal(f.links.length, 1);
  assert.equal(f.links[0].download, '魔法树-展示图.png');
  assert.equal(f.links[0].clicked, true);
  assert.equal(output.width, 0);
  f.tick(1500);
  assert.deepEqual(f.revokedUrls, [f.createdUrls[0].url]);
});

test('failed PNG output reports error and still clears temporary pixels', async () => {
  const f = fixture(); generate(f);
  const pending = f.get('tree-download-qr').fire('click');
  const output = f.canvases.at(-1);
  output.resolveBlob(null); await pending;
  assert.equal(output.width, 0);
  assert.equal(f.get('tree-status').dataset.state, 'error');
  assert.equal(f.createdUrls.length, 0);
});

test('clear revokes SVG downloads and drops all private state', async () => {
  const f = fixture(); generate(f);
  await f.get('tree-download-svg').fire('click');
  assert.equal(f.links[0].download, '魔法树-二维码.svg');
  f.window.QRTree.clear();
  assert.deepEqual(f.revokedUrls, [f.createdUrls[0].url]);
  assert.equal(f.window.QRTree.hasData(), false);
  assert.equal(f.timers.size, 0);
});

test('expired privacy deadline blocks generation and animation', () => {
  const f = fixture(); f.type('pending'); f.expire(); f.tick(160);
  assert.equal(f.encodes.length, 0);
  assert.equal(f.get('tree-content').value, '');
  generate(f); f.get('tree-toggle').fire('click'); f.expire(); f.frame(0);
  assert.equal(f.window.QRTree.hasData(), false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.get('tree-canvas').bitmap, '');
});

test('WebGL wind advances render time without user activity or extending privacy deadline', () => {
  const f = fixture({ renderer: 'webgl', privacyMs: 300000 });
  generate(f);
  assert.equal(f.get('tree-canvas').dataset.renderer, 'webgl');
  assert.equal(f.draws.at(-1).time, 0.16);
  assert.equal(f.timers.size, 1);
  const activity = f.activity, lastActivity = f.lastActivity;
  for (let i = 0; i < 5; i++) f.tick(60);
  assert.equal(f.draws.length, 6);
  assert.equal(f.draws.at(-1).time, 0.46);
  assert.equal(f.activity, activity);
  assert.equal(f.lastActivity, lastActivity);
  assert.equal(f.timers.size, 1, 'wind keeps only one scheduled repaint');
  const draws = f.draws.length;
  f.tick(300000 - f.now);
  assert.equal(f.get('tree-content').value, '');
  assert.equal(f.get('tree-canvas').bitmap, '');
  assert.equal(f.window.QRTree.hasData(), false);
  assert.equal(f.draws.length, draws, 'expired content is cleared before another frame is drawn');
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.disposed, [f.scenes[0]]);
});

for (const action of ['workspace', 'document', 'reduced', 'clear']) {
  test(`WebGL idle repaint is cancelled on ${action}`, () => {
    const f = fixture({ renderer: 'webgl' }); generate(f);
    assert.equal(f.timers.size, 1);
    if (action === 'workspace') f.window.QRTree.setVisible(false);
    if (action === 'document') { f.document.hidden = true; f.documentEvent('visibilitychange'); }
    if (action === 'reduced') { f.media.matches = true; f.media.change(); }
    if (action === 'clear') f.window.QRTree.clear();
    assert.equal(f.timers.size, 0);
    assert.equal(f.frames.size, 0);
    if (action === 'reduced') assert.equal(f.draws.at(-1).time, 0);
    const draws = f.draws.length;
    f.tick(1000);
    assert.equal(f.draws.length, draws);
    if (action === 'workspace') f.window.QRTree.setVisible(true);
    if (action === 'document') { f.document.hidden = false; f.documentEvent('visibilitychange'); }
    if (action === 'workspace' || action === 'document') assert.equal(f.timers.size, 1, 'visible tree resumes wind');
  });
}

test('WebGL reduced motion starts with frozen wind and no idle timer', () => {
  const f = fixture({ renderer: 'webgl', reduced: true }); generate(f);
  assert.equal(f.draws.at(-1).time, 0);
  assert.equal(f.timers.size, 0);
  f.get('tree-toggle').fire('click');
  assert.equal(f.draws.at(-1).progress, 1);
  assert.equal(f.draws.at(-1).time, 0);
  assert.equal(f.frames.size, 0);
});

test('replacing and clearing a WebGL scene dispose the old GPU resources exactly once', () => {
  const f = fixture({ renderer: 'webgl' }); generate(f, 'first');
  const first = f.scenes[0];
  f.type('second');
  assert.deepEqual(f.disposed, [first]);
  assert.equal(f.get('tree-canvas').dataset.renderer, undefined);
  f.tick(160);
  const second = f.scenes[1];
  assert.notEqual(second, first);
  assert.equal(f.get('tree-canvas').dataset.renderer, 'webgl');
  f.window.QRTree.clear(); f.window.QRTree.clear();
  assert.deepEqual(f.disposed, [first, second]);
  assert.equal(f.timers.size, 0);
});

test('WebGL transitions finish at 950ms and wind runs only in the tree endpoint', () => {
  const f = fixture({ renderer: 'webgl' }); generate(f);
  f.get('tree-toggle').fire('click');
  assert.equal(f.timers.size, 0);
  f.frame(0); f.frame(475);
  assert.equal(f.draws.at(-1).progress, 0.5);
  assert.equal(f.frames.size, 1);
  f.frame(950);
  assert.equal(f.draws.at(-1).progress, 1);
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
  f.get('tree-toggle').fire('click');
  f.frame(1000); f.frame(1950);
  assert.equal(f.draws.at(-1).progress, 0);
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 1);
});

test('pointer dragging rotates a full turn without treating release as a tap', () => {
  const f=fixture(); generate(f); const stage=f.get('tree-stage');
  const start=f.draws.at(-1).angle;
  stage.fire('pointerdown',{pointerId:1,clientX:0,button:0});
  stage.fire('pointermove',{pointerId:1,clientX:360});
  assert.ok(Math.abs(f.draws.at(-1).angle-start-Math.PI)<1e-9);
  stage.fire('pointermove',{pointerId:1,clientX:720});
  assert.ok(Math.abs(f.draws.at(-1).angle-start)<1e-9);
  stage.fire('pointerup',{pointerId:1}); stage.fire('click',{detail:1});
  assert.equal(f.frames.size,0); assert.equal(stage.pointer,undefined);
  stage.fire('pointerdown',{pointerId:2,clientX:20,button:0});
  stage.fire('pointermove',{pointerId:2,clientX:23});
  stage.fire('pointerup',{pointerId:2}); stage.fire('click',{detail:1});
  assert.equal(f.frames.size,1,'a tap still opens the overhead view');
});

test('pointer cancellation, hidden view and privacy cleanup stop a drag', () => {
  for(const action of ['cancel','hidden','clear','expired']) {
    const f=fixture(); generate(f); const stage=f.get('tree-stage');
    stage.fire('pointerdown',{pointerId:1,clientX:0,button:0});
    stage.fire('pointermove',{pointerId:1,clientX:120});
    if(action==='cancel')stage.fire('pointercancel',{pointerId:1});
    if(action==='hidden')f.window.QRTree.setVisible(false);
    if(action==='clear')f.window.QRTree.clear();
    if(action==='expired'){f.expire();stage.fire('pointermove',{pointerId:1,clientX:130});}
    const count=f.draws.length;
    stage.fire('pointermove',{pointerId:1,clientX:240});
    assert.equal(f.draws.length,count); assert.equal(stage.pointer,undefined);
    assert.equal(stage.dataset.dragging,undefined);
  }
});

test('auto rotation does not count as activity, stops at QR view and resets on clear', () => {
  const f=fixture({renderer:'webgl'}); generate(f);
  f.get('tree-auto-rotate').fire('click'); const angle=f.draws.at(-1).angle, activity=f.activity;
  f.tick(60); assert.notEqual(f.draws.at(-1).angle,angle); assert.equal(f.activity,activity);
  f.get('tree-toggle').fire('click'); f.frame(0); f.frame(950);
  assert.equal(f.get('tree-auto-rotate')['aria-pressed'],'false'); assert.equal(f.timers.size,0);
  f.window.QRTree.clear(); assert.equal(f.get('tree-auto-rotate').disabled,true);
  const reduced=fixture({reduced:true}); generate(reduced);
  reduced.get('tree-auto-rotate').fire('click'); assert.equal(reduced.timers.size,0);
});

test('arrow keys rotate the tree and remain disabled in the QR view', () => {
  const f=fixture({reduced:true}); generate(f); const stage=f.get('tree-stage');
  const angle=f.draws.at(-1).angle; let prevented=false;
  stage.fire('keydown',{key:'ArrowRight',preventDefault(){prevented=true;}});
  assert.equal(prevented,true); assert.ok(f.draws.at(-1).angle>angle);
  f.get('tree-toggle').fire('click'); const count=f.draws.length;
  stage.fire('keydown',{key:'ArrowLeft',preventDefault(){}}); assert.equal(f.draws.length,count);
});

test('colored QR export uses the overhead renderer and cancels stale PNG output', async () => {
  const f=fixture(); generate(f);
  const pending=f.get('tree-download-color').fire('click'); const output=f.canvases.at(-1);
  assert.equal(f.draws.at(-1).progress,1);
  f.window.QRTree.clear(); output.resolveBlob(new Blob(['png'])); await pending;
  assert.equal(f.createdUrls.length,0); assert.equal(output.width,0);
});

test('rain is opt-in, follows the renderer, and resets during privacy cleanup', () => {
  const f=fixture({renderer:'webgl'}); generate(f);
  assert.equal(f.draws.at(-1).rain,false);
  f.get('tree-rain').fire('click'); assert.equal(f.draws.at(-1).rain,true);
  const activity=f.activity; f.tick(60); assert.equal(f.activity,activity);
  f.get('tree-toggle').fire('click'); f.frame(0); f.frame(950);
  assert.equal(f.get('tree-rain').disabled,true);
  f.window.QRTree.clear(); generate(f);
  assert.equal(f.draws.at(-1).rain,false);
  assert.equal(f.get('tree-rain')['aria-pressed'],'false');
  const fallback=fixture(); generate(fallback);
  assert.equal(fallback.get('tree-rain').disabled,true);
  fallback.get('tree-rain').fire('click'); assert.equal(fallback.draws.at(-1).rain,false);
});

test('rain respects reduced motion and is excluded from colored QR downloads', async () => {
  const f=fixture({renderer:'webgl',reduced:true}); generate(f);
  f.get('tree-rain').fire('click'); assert.equal(f.draws.at(-1).rain,true);
  assert.equal(f.draws.at(-1).time,0); assert.equal(f.timers.size,0);
  const pending=f.get('tree-download-color').fire('click');
  assert.equal(f.draws.at(-1).rain,false); assert.equal(f.draws.at(-1).progress,1);
  f.canvases.at(-1).resolveBlob(new Blob(['png'])); await pending;
  assert.equal(f.links.at(-1).download,'魔法树-花叶二维码.png');
});
