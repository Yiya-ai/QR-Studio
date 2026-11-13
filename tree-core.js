/* Original procedural QR garden. No assets, network, storage or animation loop. */
(() => {
  'use strict';
  const palettes = Object.freeze({
    natural: { name: '自然', leaves: ['#f6c4d7', '#ef9cbe', '#ffe4ed', '#d97aa4'], ink: '#62384e' },
    lavender: { name: '薰衣草', leaves: ['#c9b5ed', '#a484cc', '#e5d7f8', '#8863b1'], ink: '#4c386b' },
    coral: { name: '珊瑚', leaves: ['#f2a397', '#e67c7e', '#ffd2b9', '#cd5e73'], ink: '#733b45' },
    gold: { name: '金色', leaves: ['#edce7c', '#dba650', '#fff0b7', '#bd863f'], ink: '#65501f' },
    sky: { name: '晴空', leaves: ['#a5cde6', '#72aad5', '#d4eaf7', '#5182bb'], ink: '#294e74' },
    snow: { name: '初雪', leaves: ['#e9e9f0', '#c8cfdf', '#ffffff', '#a5b2c9'], ink: '#3d4b64' },
  });
  const seasonLeaves = {
    summer: ['#91bb76', '#59885b', '#c3d69a', '#447650'],
    autumn: ['#e5ad67', '#ce794d', '#f4d18a', '#b25844'],
  };
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const mix = (a, b, t) => a + (b - a) * t;
  function createScene(qr) {
    if (!qr || !Number.isInteger(qr.size) || qr.size < 21 || qr.size > 177 || (qr.size - 21) % 4 || typeof qr.getModule !== 'function') {
      throw new Error('请先生成有效的二维码。');
    }
    // A bounded seed makes the same code grow the same tree, without retaining its text.
    let seed = qr.size;
    for (let y = 0; y < qr.size; y += 3) for (let x = 0; x < qr.size; x += 3) seed = (Math.imul(seed, 31) + Number(qr.getModule(x, y))) >>> 0;
    function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    const branches = [], leaves = [], grass = [];
    const trunk = [[0, 0, 0], [.035, .24, -.02], [-.035, .52, .035], [.055, .80, .02], [-.065, 1.1, -.03], [.035, 1.42, .015], [-.045, 1.75, .03], [-.08, 2.15, -.02]];
    branches.push({ points: trunk, width: 0.14 });
    // Overlapping crowns follow real branch ends instead of a uniform particle sphere.
    for (let i = 0; i < 24; i++) {
      const theta = i * 2.399963, level = i / 23;
      const height = 1.15 + level * 0.85;
      const reach = 0.68 * Math.sin((level * 0.7 + 0.25) * Math.PI);
      const tip = [Math.cos(theta) * reach, height, Math.sin(theta) * reach];
      const rootHeight = height * .5;
      const upper = trunk.findIndex((p) => p[1] >= rootHeight), lo = trunk[upper - 1], hi = trunk[upper];
      const root = lo.map((v, k) => mix(v, hi[k], (rootHeight - lo[1]) / (hi[1] - lo[1])));
      branches.push({ points: [root, [tip[0] * .25, height * .70, tip[2] * .25], [tip[0] * .68, height * .96, tip[2] * .68], tip], width: 0.038 + (1 - level) * 0.023 });
      for (let j = 0; j < 48; j++) {
        const a = random() * Math.PI * 2, z = random() * 2 - 1, radius = Math.cbrt(random());
        const r = Math.sqrt(1 - z * z) * radius;
        leaves.push({
          x: tip[0] + Math.cos(a) * r * 0.36,
          y: tip[1] + z * radius * 0.34,
          z: tip[2] + Math.sin(a) * r * 0.36,
          size: 0.026 + random() * 0.035, tilt: random() * Math.PI,
          color: Math.floor(random() * 4), variation: random(),
        });
      }
    }
    for (let i = 0; i < 220; i++) {
      const edge = Math.floor(random() * 4), along = random() * 2.28 - 1.14;
      const across = 1.04 + random() * 0.1;
      grass.push({ x: edge < 2 ? along : across * (edge === 2 ? 1 : -1), z: edge < 2 ? across * (edge === 0 ? 1 : -1) : along, height: 0.035 + random() * 0.08, tilt: (random() - 0.5) * 0.08 });
    }
    // The decorative floor samples large codes; only the face-on view is for scanning.
    const floorSize = Math.min(qr.size, 45), tiles = [];
    for (let y = 0; y < floorSize; y++) for (let x = 0; x < floorSize; x++) {
      if (qr.getModule(Math.floor(x * qr.size / floorSize), Math.floor(y * qr.size / floorSize))) tiles.push([x, y]);
    }
    return { qr, branches, leaves, grass, tiles, floorSize };
  }
  function draw(canvas, scene, options = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx || !scene?.qr) throw new Error('树景尚未生成。');
    const width = canvas.width, height = canvas.height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192) throw new Error('画布尺寸无效。');
    const size = Math.min(width, height), palette = palettes[options.palette] || palettes.natural;
    const season = ['spring', 'summer', 'autumn'].includes(options.season) ? options.season : 'spring';
    const progress = Math.max(0, Math.min(1, finite(options.progress, 0)));
    const angle = finite(options.angle, Math.PI / 4);
    const colors = options.palette && options.palette !== 'natural' ? palette.leaves : seasonLeaves[season] || palette.leaves;
    function drawFinal(alpha = 1) {
      const scale = Math.floor(size * 0.82 / (scene.qr.size + 8));
      if (scale < 1) throw new Error('画布太小，无法完整显示二维码。');
      const side = (scene.qr.size + 8) * scale;
      const left = Math.floor((width - side) / 2), top = Math.floor((height - side) / 2);
      ctx.save();
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha;
        ctx.fillStyle = '#f4f0e6'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(left, top, side, side);
        for (let y = 0; y < scene.qr.size; y++) for (let x = 0; x < scene.qr.size; x++) {
          if (scene.qr.getModule(x, y)) {
            ctx.fillStyle = options.standardQr ? palette.ink : colors[(x * 17 + y * 31) % colors.length];
            ctx.fillRect(left + (x + 4) * scale, top + (y + 4) * scale, scale, scale);
          }
        }
      } finally { ctx.restore(); }
    }
    if (!options.standardQr && globalThis.QRTreeWebGL?.draw(canvas, scene, { ...options, progress, angle })) {
      return 'webgl';
    }
    // Explicit standard exports remain independent of the flower-colored view.
    if (progress === 1 || options.standardQr) { drawFinal(); return; }
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f4f0e6';
      ctx.fillRect(0, 0, width, height);
      const scale = size * 0.255, cx = width / 2, cy = (height - size) / 2 + size * 0.73;
      const c = Math.cos(angle), s = Math.sin(angle);
      function project(x, y, z) { return [cx + (x * c - z * s) * scale, cy + (x * s + z * c) * scale * 0.48 - y * scale]; }
      function polygon(points, fill) {
        ctx.fillStyle = fill; ctx.beginPath();
        points.forEach((p, i) => { const q = project(...p); if (i) ctx.lineTo(...q); else ctx.moveTo(...q); });
        ctx.closePath(); ctx.fill();
      }
      const fade = 1 - progress;
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#e4e0da'; ctx.beginPath(); ctx.ellipse(cx, cy + size * 0.095, size * 0.31, size * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      const corners = [[-1.17, 0, -1.17], [1.17, 0, -1.17], [1.17, 0, 1.17], [-1.17, 0, 1.17]];
      // Draw the back edges before the front ones as the garden rotates.
      const sides = corners.map((p, i) => ({ a: p, b: corners[(i + 1) % 4] }));
      sides.sort((a, b) => ((a.a[0] + a.b[0]) - (b.a[0] + b.b[0])) * s + ((a.a[2] + a.b[2]) - (b.a[2] + b.b[2])) * c);
      for (const { a, b } of sides) polygon([a, b, [b[0], -0.07, b[2]], [a[0], -0.07, a[2]]], a[0] === b[0] ? '#bdbbb1' : '#cecac0');
      polygon(corners, '#faf9f5');
      const unit = 2.12 / scene.floorSize;
      for (const [x, z] of scene.tiles) {
        const a = -1.06 + x * unit, b = -1.06 + z * unit;
        const tone = Math.round(78 + 4 * Math.sin(x * 2.31 + z * 5.17) + 2 * Math.cos(x * 4.73 - z * 1.91));
        polygon([[a, 0.002, b], [a + unit, 0.002, b], [a + unit, 0.002, b + unit], [a, 0.002, b + unit]], `hsl(48, 10%, ${tone}%)`);
      }
      ctx.globalAlpha = fade * fade;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const branches = scene.branches.map((branch) => ({ ...branch, depth: branch.points.at(-1)[0] * s + branch.points.at(-1)[2] * c })).sort((a, b) => a.depth - b.depth);
      for (const branch of branches) {
        ctx.strokeStyle = '#795b48';
        for (let i = 1; i < branch.points.length; i++) {
          ctx.lineWidth = branch.width * scale * (1 - .86 * (i - 1) / (branch.points.length - 1));
          ctx.beginPath(); ctx.moveTo(...project(...branch.points[i - 1]));
          ctx.lineTo(...project(...branch.points[i])); ctx.stroke();
        }
      }
      for (const blade of scene.grass) {
        ctx.lineWidth = Math.max(1, size / 650); ctx.strokeStyle = season === 'autumn' ? '#b9a16c' : '#8d9f6b'; ctx.beginPath();
        ctx.moveTo(...project(blade.x, 0, blade.z)); ctx.lineTo(...project(blade.x + blade.tilt, blade.height, blade.z)); ctx.stroke();
      }
      const leaves = scene.leaves.map((leaf) => ({ leaf, depth: leaf.x * s + leaf.z * c })).sort((a, b) => a.depth - b.depth);
      for (const { leaf } of leaves) {
        const p = project(leaf.x, leaf.y, leaf.z), r = leaf.size * scale;
        const rotation = leaf.tilt + angle * 0.25;
        if (season === 'spring' && leaf.variation > 0.1) {
          ctx.fillStyle = colors[leaf.color];
          for (let petal = 0; petal < 5; petal++) {
            const a = rotation + petal * Math.PI * 2 / 5;
            ctx.beginPath();
            ctx.ellipse(p[0] + Math.cos(a) * r * .52, p[1] + Math.sin(a) * r * .32, r * .53, r * .32, a, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#f1d780'; ctx.beginPath();
          ctx.ellipse(p[0], p[1], r * .18, r * .12, rotation, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = season === 'spring' ? '#a8cc70' : colors[leaf.color];
          ctx.beginPath();
          // Broad palmate leaves have shallow notches rather than narrow shards.
          const outline = [[0,-1], [.24,-.42], [.73,-.71], [.56,-.15], [1,.08], [.46,.33], [.33,.78], [0,.55], [-.36,.79], [-.49,.27], [-1,.03], [-.55,-.2], [-.72,-.67], [-.22,-.43]];
          outline.forEach(([x, y], i) => {
            const px = p[0] + (x * Math.cos(rotation) - y * Math.sin(rotation)) * r;
            const py = p[1] + (x * Math.sin(rotation) + y * Math.cos(rotation)) * r * .65;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          });
          ctx.closePath(); ctx.fill();
        }
      }
      if (progress > 0) {
        // The code lifts out of the garden; the final frame above snaps to exact pixels.
        ctx.globalAlpha = progress;
        const q = scene.qr, module = Math.max(1, Math.floor(size * 0.82 / (q.size + 8))), side = (q.size + 8) * module;
        const top = Math.floor((height - side) / 2), left = Math.floor((width - side) / 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(left, top, side, side);
        for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) {
          if (!q.getModule(x, y)) continue;
          ctx.fillStyle = colors[(x * 17 + y * 31) % colors.length];
          const from = project((x / q.size - 0.5) * 2.12, 0, (y / q.size - 0.5) * 2.12);
          ctx.fillRect(mix(from[0], left + (x + 4) * module, progress), mix(from[1], top + (y + 4) * module, progress), module, module);
        }
      }
    } finally { ctx.restore(); }
  }
  const dispose = (scene) => globalThis.QRTreeWebGL?.dispose(scene);
  globalThis.QRTreeCore = Object.freeze({ createScene, draw, palettes, dispose });
})();
