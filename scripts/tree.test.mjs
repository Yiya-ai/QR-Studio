import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const context = vm.createContext({ TextEncoder, URL, Blob, Uint8Array, Uint8ClampedArray, DataView });
for (const file of ['vendor/qrcodegen.js', 'vendor/jsqr.js', 'studio-core.js', 'tree-core.js']) {
  vm.runInContext(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'), context);
}
const tree = context.QRTreeCore, core = context.QRStudioCore;
function rasterCanvas(width, height = width) {
  const pixels = new Uint8ClampedArray(width * height * 4), calls = [];
  const ctx = {
    save() {}, restore() {}, setTransform() {},
    fillStyle: '#000000', globalAlpha: 1,
    fillRect(x, y, w, h) {
      assert.ok([x, y, w, h].every(Number.isInteger), 'final QR modules are integer aligned');
      const rgb = this.fillStyle.slice(1).match(/../g).map((v) => parseInt(v, 16));
      assert.equal(rgb.length, 3); assert.equal(this.globalAlpha, 1);
      calls.push([x, y, w, h]);
      for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) pixels.set([...rgb, 255], (row * width + col) * 4);
    },
  };
  return { width, height, getContext: () => ctx, pixels, calls };
}

test('tree scenes are deterministic and bounded regardless of QR density', () => {
  for (const text of ['hello', '树下见 🌸', 'x'.repeat(2000)]) {
    const qr = core.encode(text, 'M'), scene = tree.createScene(qr);
    assert.deepEqual(scene, tree.createScene(qr));
    assert.equal(scene.qr, qr);
    assert.equal(scene.leaves.length, 1152);
    assert.equal(scene.branches.length, 25);
    assert.equal(scene.grass.length, 220);
    assert.ok(scene.tiles.length <= 45 * 45);
  }
  for (const qr of [null, {}, { size: Infinity, getModule() {} }, { size: 10000, getModule() {} }, { size: 22, getModule() {} }]) assert.throws(() => tree.createScene(qr));
});

for (const season of ['spring', 'summer', 'autumn']) {
  for (const palette of Object.keys(tree.palettes)) {
    test(`final QR scans with ${season}/${palette}`, () => {
      const text = 'https://example.com/魔法树?q=🌸';
      const scene = tree.createScene(core.encode(text, 'M')), canvas = rasterCanvas(512);
      tree.draw(canvas, scene, { season, palette, progress: 1, angle: 1.4, standardQr: true });
      assert.equal(context.jsQR(canvas.pixels, 512, 512)?.data, text);
      const [, , side] = canvas.calls[1];
      const module = side / (scene.qr.size + 8), [left, top] = canvas.calls[1];
      assert.equal(canvas.calls[2][0], left + 4 * module);
      assert.equal(canvas.calls[2][1], top + 4 * module);
    });
  }
}

test('dense QR export and rectangular canvas preserve content and quiet zones', () => {
  const text = 'x'.repeat(2000), scene = tree.createScene(core.encode(text, 'M'));
  const canvas = rasterCanvas(1024, 900);
  tree.draw(canvas, scene, { palette: 'snow', progress: 1, standardQr: true });
  assert.equal(context.jsQR(canvas.pixels, canvas.width, canvas.height)?.data, text);
  assert.throws(() => tree.draw(rasterCanvas(20), scene, { progress: 1 }), /太小/);
});

test('tree and transition rendering use finite geometry and restore canvas state', () => {
  const scene = tree.createScene(core.encode('测试旋转', 'M'));
  let saves = 0, restores = 0, paths = 0;
  const assertFinite = (...args) => assert.ok(args.every(Number.isFinite));
  const ctx = {
    save() { saves++; }, restore() { restores++; },
    setTransform: assertFinite, fillRect: assertFinite, moveTo: assertFinite,
    lineTo: assertFinite, ellipse: assertFinite,
    beginPath() { paths++; }, closePath() {}, fill() {}, stroke() {},
  };
  const canvas = { width: 720, height: 720, getContext: () => ctx };
  for (const season of ['spring', 'summer', 'autumn']) for (const angle of [0, Math.PI / 4, Math.PI, -20, NaN]) {
    for (const progress of [0, 0.5, 0.99]) tree.draw(canvas, scene, { season, angle, progress });
  }
  assert.equal(saves, restores); assert.ok(paths > 1000);
  assert.throws(() => tree.draw({ width: 0, height: 0, getContext: () => ctx }, scene), /尺寸/);
});

test('Canvas fallback distinguishes spring blossoms from summer and autumn leaves', () => {
  const scene = tree.createScene(core.encode('botanical fallback', 'M'));
  const centers = {};
  let season;
  const ctx = {
    save() {}, restore() {}, setTransform() {}, fillRect() {}, moveTo() {},
    lineTo() {}, ellipse() {}, beginPath() {}, closePath() {}, stroke() {},
    fill() { if (this.fillStyle === '#f1d780') centers[season]++; },
  };
  for (season of ['spring', 'summer', 'autumn']) {
    centers[season] = 0;
    tree.draw({width:720,height:720,getContext:()=>ctx}, scene, {season});
  }
  assert.ok(centers.spring > scene.leaves.length * .8);
  assert.ok(centers.spring < scene.leaves.length, 'spring retains some green leaves');
  assert.equal(centers.summer, 0);
  assert.equal(centers.autumn, 0);
});

test('colored endpoint stays in WebGL without a dark 2D overlay', () => {
  const scene = tree.createScene(core.encode('handoff', 'M'));
  const calls = [], gpuCalls = [];
  const ctx = {
    globalAlpha: 1, save() {}, restore() {}, setTransform() {},
    fillRect(...rect) { calls.push({rect, color: this.fillStyle}); },
  };
  const canvas = {width:720, height:600, getContext:()=>ctx};
  context.QRTreeWebGL = {draw:(_canvas,_scene,options)=>{gpuCalls.push(options);return true;}};
  try {
    for(const progress of [.8,.925,1]) assert.equal(tree.draw(canvas,scene,{progress}),'webgl');
    assert.equal(calls.length,0,'no 2D overlay is allowed at the color endpoint');
    assert.equal(gpuCalls.length,3);
    assert.equal(gpuCalls[2].progress,1);
    tree.draw(canvas,scene,{progress:1,standardQr:true});
    assert.equal(gpuCalls.length,3,'standard export bypasses GPU');
    assert.ok(calls.length>2);
    assert.ok(calls.slice(2).every(call=>call.color===tree.palettes.natural.ink));
  } finally { delete context.QRTreeWebGL; }
});

test('Canvas fallback keeps all colored modules and follows the selected season', () => {
  const scene=tree.createScene(core.encode('flower colors','M'));
  const colorsBySeason=[];
  for(const season of ['spring','summer','autumn']) {
    const paletteColors=new Set();
    const canvas=rasterCanvas(512);
    tree.draw(canvas,scene,{progress:1,season,palette:'natural'});
    const [left,top,side]=canvas.calls[1], unit=side/(scene.qr.size+8);
    let colored=0;
    for(let y=0;y<scene.qr.size;y++)for(let x=0;x<scene.qr.size;x++) {
      const px=left+(x+4)*unit+Math.floor(unit/2),py=top+(y+4)*unit+Math.floor(unit/2);
      const rgb=Array.from(canvas.pixels.slice((py*512+px)*4,(py*512+px)*4+3));
      const hex='#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
      if(scene.qr.getModule(x,y)) { assert.notEqual(hex,'#ffffff'); assert.notEqual(hex,tree.palettes.natural.ink);paletteColors.add(hex);colored++; }
      else assert.equal(hex,'#ffffff');
    }
    assert.equal(canvas.calls.length,colored+2);
    colorsBySeason.push([...paletteColors].sort().join(','));
  }
  assert.equal(new Set(colorsBySeason).size,3);
});
