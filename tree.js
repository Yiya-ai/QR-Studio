/* Local-only tree workspace. No payloads in URLs or persistent storage. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const core = window.QRStudioCore;
  const renderer = window.QRTreeCore;
  const canvas = $('tree-canvas');
  const stage = $('tree-stage');
  const input = $('tree-content');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const actionIds = ['tree-stage', 'tree-toggle', 'tree-rotate-left', 'tree-rotate-right', 'tree-auto-rotate', 'tree-rain', 'tree-download-color', 'tree-download-qr', 'tree-download-svg', 'tree-download-scene', 'tree-check'];
  const downloads = new Map();
  const exportCanvases = new Set();
  let scene, content = '', generation, frame, idleTimer, revision = 0;
  let season = 'spring', palette = 'natural', angle = Math.PI / 4, progress = 0, target = 0;
  let visible = !$('tree-section').hidden;
  let drag, suppressClick = false, autoRotate = false, rain = false;
  const wrapAngle = (value) => ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  function stopDrag() {
    const pointer = drag;
    drag = undefined;
    delete stage.dataset.dragging;
    if (pointer && stage.hasPointerCapture?.(pointer.id)) stage.releasePointerCapture(pointer.id);
  }
  const qrOptions = { width: 1024, margin: 4, dark: '#17172a', light: '#ffffff' };

  function status(message, state = 'info') {
    $('tree-status').textContent = message;
    $('tree-status').dataset.state = state;
  }
  function cancelMotion() {
    window.clearTimeout(idleTimer);
    idleTimer = undefined;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
  }
  function paint() {
    if (!scene || !visible || document.hidden) return;
    const rendered = renderer.draw(canvas, scene, { season, palette, progress, angle, rain, time: reducedMotion.matches ? 0 : Date.now() / 1000 });
    canvas.dataset.renderer = rendered === 'webgl' ? 'webgl' : 'canvas';
    $('tree-rain').disabled = target === 1 || rendered !== 'webgl';
    if ((rendered === 'webgl' || autoRotate) && !reducedMotion.matches && target === 0 && progress === 0 && idleTimer === undefined) {
      idleTimer = window.setTimeout(() => {
        idleTimer = undefined;
        if (!checkPrivacyDeadline()) {
          if (autoRotate && !drag) angle = wrapAngle(angle + .012);
          paint();
        }
      }, 60);
    }
  }
  function updateView() {
    const isQr = target === 1;
    $('tree-toggle').textContent = isQr ? '回到魔法树' : '展开二维码';
    $('tree-stage').setAttribute('aria-label', isQr ? '切换到树景视图' : '切换到二维码视图');
    canvas.setAttribute('aria-label', isQr ? '保留花叶配色的俯视二维码' : '可拖动旋转的立体魔法树预览');
    $('tree-view-help').textContent = isQr ? '花叶俯视二维码，点击返回树景。浅色配色可先识别自检。' : '拖动树景可 360° 旋转，轻点查看花叶俯视二维码。';
    $('tree-rotate-left').disabled = $('tree-rotate-right').disabled = !scene || isQr;
    $('tree-auto-rotate').disabled = !scene || isQr || reducedMotion.matches;
    $('tree-auto-rotate').setAttribute('aria-pressed', String(autoRotate));
    $('tree-auto-rotate').textContent = autoRotate ? '停止旋转' : '自动旋转';
    $('tree-rain').disabled = !scene || isQr || canvas.dataset.renderer !== 'webgl';
    $('tree-rain').setAttribute('aria-pressed', String(rain));
    $('tree-rain').textContent = rain ? '关闭下雨' : '下雨';
  }
  function animate() {
    cancelMotion();
    if (!scene) return;
    if (reducedMotion.matches || !visible || document.hidden) { progress = target; paint(); return; }
    const from = progress;
    let started;
    const version = revision;
    function step(time) {
      frame = undefined;
      if (version !== revision || !scene || checkPrivacyDeadline()) return;
      if (!visible || document.hidden) { progress = target; return; }
      if (started === undefined) started = time;
      const elapsed = Math.min(1, (time - started) / 950);
      const ease = elapsed * elapsed * (3 - 2 * elapsed);
      progress = from + (target - from) * ease;
      paint();
      if (elapsed < 1) frame = window.requestAnimationFrame(step);
    }
    frame = window.requestAnimationFrame(step);
  }
  function discardScene() {
    revision++;
    window.clearTimeout(generation);
    generation = undefined;
    cancelMotion();
    stopDrag(); autoRotate = false; suppressClick = false; rain = false;
    for (const output of exportCanvases) output.width = 0;
    exportCanvases.clear();
    renderer.dispose?.(scene);
    scene = undefined;
    content = '';
    canvas.width = canvas.width;
    delete canvas.dataset.renderer;
    canvas.hidden = true;
    $('tree-empty').hidden = false;
    for (const id of actionIds) $(id).disabled = true;
  }
  function release(url) {
    window.clearTimeout(downloads.get(url));
    URL.revokeObjectURL(url);
    downloads.delete(url);
  }
  function clear() {
    discardScene();
    input.value = input.defaultValue = '';
    progress = target = 0;
    angle = Math.PI / 4;
    updateView();
    for (const url of [...downloads.keys()]) release(url);
    status('准备好内容后，树景会自动生成。');
  }
  function generate() {
    generation = undefined;
    if (checkPrivacyDeadline() || !input.value.trim()) return;
    try {
      if (input.value.length > 1200) throw new Error('内容超过 1,200 个字符，请缩短后重试。');
      const qr = core.encode(input.value, 'M');
      scene = renderer.createScene(qr);
      content = input.value;
      canvas.hidden = false;
      $('tree-empty').hidden = true;
      progress = target;
      for (const id of actionIds) $(id).disabled = false;
      updateView(); paint();
      status(`已生成 · ${qr.size} × ${qr.size} 码点。拖动可 360° 旋转，轻点查看俯视二维码。`, 'success');
    } catch (error) {
      discardScene();
      status(error.message || '生成失败，请缩短内容后重试。', 'error');
    }
  }
  function queue() {
    if (checkPrivacyDeadline()) return;
    discardScene();
    status(input.value.trim() ? '正在生成树景…' : '准备好内容后，树景会自动生成。');
    if (input.value.trim()) generation = window.setTimeout(generate, 160);
    noteActivity();
  }
  function toggle() {
    if (checkPrivacyDeadline() || !scene) return;
    stopDrag(); autoRotate = false;
    target = target === 1 ? 0 : 1;
    updateView(); animate(); noteActivity();
  }
  function save(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    downloads.set(url, window.setTimeout(() => release(url), 1500));
    status('已发起下载，请在浏览器下载列表查看。', 'success');
  }
  async function download(kind) {
    if (checkPrivacyDeadline() || !scene) return;
    const version = revision, session = sessionVersion;
    const qr = scene.qr;
    let output;
    noteActivity();
    try {
      if (kind === 'svg') {
        save(new Blob([core.svg(qr, qrOptions)], { type: 'image/svg+xml' }), '魔法树-二维码.svg');
        return;
      }
      output = document.createElement('canvas');
      exportCanvases.add(output);
      output.width = output.height = 1024;
      if (kind === 'scene' || kind === 'color') renderer.draw(output, scene, { season, palette, angle, rain: kind === 'scene' && rain, time: reducedMotion.matches ? 0 : Date.now() / 1000, progress: kind === 'color' ? 1 : 0 });
      else core.draw(qr, output, qrOptions);
      const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/png'));
      if (version !== revision || session !== sessionVersion || checkPrivacyDeadline()) return;
      if (!blob) throw new Error('图片导出失败，请重试。');
      save(blob, kind === 'scene' ? '魔法树-展示图.png' : kind === 'color' ? '魔法树-花叶二维码.png' : '魔法树-二维码.png');
    } catch (error) { if (version === revision) status(error.message || '下载失败，请重试。', 'error'); }
    finally { if (output) { output.width = 0; exportCanvases.delete(output); } }
  }
  function scanCheck() {
    if (checkPrivacyDeadline() || !scene) return;
    const output = document.createElement('canvas');
    let pixels;
    try {
      output.width = output.height = 1024;
      renderer.draw(output, scene, { season, palette, angle, progress: 1 });
      pixels = output.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 1024, 1024).data;
      const result = window.jsQR(pixels, 1024, 1024);
      const valid = result?.data === content;
      status(valid ? '花叶二维码识别通过：内容一致。分享或打印后请再用手机扫描。' : '当前花叶配色未通过识别，可换较深配色，或下载标准二维码。', valid ? 'success' : 'warning');
    } catch { status('识别自检未完成，请重试。', 'error'); }
    finally { pixels?.fill(0); output.width = 0; }
    noteActivity();
  }
  input.addEventListener('input', queue);
  $('tree-clear').addEventListener('click', () => { clear(); checkPrivacyDeadline(); });
  $('tree-example').addEventListener('click', () => {
    if (checkPrivacyDeadline()) return;
    input.value = '愿你的每一天，都有新的花开。'; queue();
  });
  $('tree-use-current').addEventListener('click', () => {
    if (checkPrivacyDeadline()) return;
    if (!currentQr || !elements.input.value) { status('请先在“单个制作”中生成一个有效二维码。', 'warning'); return; }
    input.value = elements.input.value; queue();
  });
  stage.addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    suppressClick = false;
    if (checkPrivacyDeadline() || !scene || target || progress !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, angle, moved: false };
    stage.setPointerCapture?.(event.pointerId);
    noteActivity();
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId || checkPrivacyDeadline()) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 6) return;
    drag.moved = true; suppressClick = true;
    stage.dataset.dragging = 'true';
    const width = Math.max(1, stage.getBoundingClientRect().width);
    angle = wrapAngle(drag.angle + distance / width * Math.PI * 2);
    paint(); noteActivity();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(event, (e) => {
    if (drag?.id === e.pointerId) stopDrag();
  });
  stage.addEventListener('click', (event) => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    suppressClick = false; toggle();
  });
  stage.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || checkPrivacyDeadline() || !scene || target) return;
    event.preventDefault();
    angle = wrapAngle(angle + (event.key === 'ArrowLeft' ? -1 : 1) * Math.PI / 12);
    paint(); noteActivity();
  });
  $('tree-toggle').addEventListener('click', toggle);
  for (const [id, direction] of [['tree-rotate-left', -1], ['tree-rotate-right', 1]]) $(id).addEventListener('click', () => {
    if (checkPrivacyDeadline() || !scene || target) return;
    angle = wrapAngle(angle + direction * Math.PI / 6); paint(); noteActivity();
  });
  $('tree-auto-rotate').addEventListener('click', () => {
    if (checkPrivacyDeadline() || !scene || target || reducedMotion.matches) return;
    autoRotate = !autoRotate; updateView(); paint(); noteActivity();
  });
  $('tree-rain').addEventListener('click', () => {
    if (checkPrivacyDeadline() || !scene || target || canvas.dataset.renderer !== 'webgl') return;
    rain = !rain; updateView(); paint(); noteActivity();
    status(rain ? '已开启雨景，俯视二维码时会自动隐藏雨和落叶。' : '已关闭雨景。');
  });
  for (const button of document.querySelectorAll('[data-season], [data-palette]')) button.addEventListener('click', () => {
    if (checkPrivacyDeadline()) return;
    if (button.dataset.season) season = button.dataset.season;
    else palette = button.dataset.palette;
    for (const item of document.querySelectorAll('[data-season]')) item.setAttribute('aria-pressed', String(item.dataset.season === season));
    for (const item of document.querySelectorAll('[data-palette]')) item.setAttribute('aria-pressed', String(item.dataset.palette === palette));
    if (scene) status(target ? '花叶配色已更新，可重新识别自检或下载。' : '树景配色已更新，俯视二维码会使用同一配色。');
    paint(); noteActivity();
  });
  $('tree-download-qr').addEventListener('click', () => download('qr'));
  $('tree-download-color').addEventListener('click', () => download('color'));
  $('tree-download-svg').addEventListener('click', () => download('svg'));
  $('tree-download-scene').addEventListener('click', () => download('scene'));
  $('tree-check').addEventListener('click', scanCheck);
  function setVisible(value) {
    visible = value;
    stopDrag();
    cancelMotion(); progress = target;
    if (value && !checkPrivacyDeadline()) paint();
  }
  document.addEventListener('visibilitychange', () => { stopDrag(); cancelMotion(); progress = target; if (!document.hidden && !checkPrivacyDeadline()) paint(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { autoRotate = false; cancelMotion(); progress = target; } updateView(); paint(); });
  window.QRTree = { clear, hasData: () => Boolean(input.value || scene || generation !== undefined || downloads.size), setVisible };
})();
