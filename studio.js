/* UI extension; all user content stays in this document. */
(() => {
  'use strict';
  const core = window.QRStudioCore;
  const $ = (id) => document.getElementById(id);
  const schemas = {
    url: [['url', '目标网址', 'url', 'https://example.com']],
    wifi: [['ssid', 'Wi-Fi 名称', 'text', '网络名称'], ['auth', '加密方式', 'select', [['WPA', 'WPA / WPA2'], ['WEP', 'WEP'], ['nopass', '无密码网络']]], ['password', 'Wi-Fi 密码', 'password', '密码仅用于生成二维码'], ['hidden', '隐藏网络', 'checkbox']],
    contact: [['name', '姓名', 'text'], ['organization', '单位（选填）', 'text'], ['phone', '手机（选填）', 'tel'], ['email', '邮箱（选填）', 'email'], ['website', '网站（选填）', 'url']],
    email: [['email', '收件邮箱', 'email'], ['subject', '邮件主题（选填）', 'text'], ['message', '邮件正文（选填）', 'textarea']],
    phone: [['phone', '电话号码', 'tel', '+86 138 0000 0000']],
    sms: [['phone', '接收号码', 'tel'], ['message', '短信内容（选填）', 'textarea']],
  };
  let mode = 'text';
  let records = [];
  let batchVersion = 0;
  let batchPending = false;
  let printSource = [];
  let zoomUrl;
  let zoomSource;
  function closeZoom(source) {
    if (source && source !== zoomSource) return;
    if ($('zoom-dialog').open) $('zoom-dialog').close();
    $('zoom-image').removeAttribute('src');
    if (zoomUrl) URL.revokeObjectURL(zoomUrl);
    zoomUrl = undefined;
    zoomSource = undefined;
    $('zoom-title').textContent = '二维码放大预览';
    document.body.classList.remove('is-zooming');
  }
  function setZoom(scale) {
    if (!['100', '150', '200'].includes(scale)) return;
    $('zoom-dialog').dataset.scale = scale;
    for (const button of document.querySelectorAll('[data-zoom]')) button.setAttribute('aria-pressed', String(button.dataset.zoom === scale));
    $('zoom-viewport').scrollTop = $('zoom-viewport').scrollLeft = 0;
  }
  function openZoom(qr, options, name, source) {
    if (checkPrivacyDeadline() || !qr) return;
    closeZoom();
    try {
      // Render a vector image from the matrix, not an enlarged thumbnail bitmap.
      zoomUrl = URL.createObjectURL(new Blob([core.svg(qr, { ...options, width: 2048 })], { type: 'image/svg+xml' }));
      zoomSource = source;
      $('zoom-title').textContent = name ? `放大预览 · ${name}` : '二维码放大预览';
      $('zoom-image').src = zoomUrl;
      setZoom('100');
      $('zoom-dialog').showModal();
      document.body.classList.add('is-zooming');
      noteActivity();
    } catch {
      closeZoom();
      showToast('放大预览未能打开，请重试或下载 SVG 查看。');
    }
  }
  const downloads = new Map();
  const yieldFrame = () => new Promise((resolve) => window.setTimeout(resolve, 0));
  const toolIds = ['generator', 'batch-section', 'decoder-section'];
  let activeTool = 'generator';
  function showTool(id) {
    if (!toolIds.includes(id)) return;
    if (activeTool !== id) { closeZoom(); clearPrint(); }
    activeTool = id;
    for (const toolId of toolIds) $(toolId).hidden = toolId !== id;
    for (const link of document.querySelectorAll('[data-tool]')) {
      if (link.dataset.tool === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (id !== 'decoder-section') {
      $(id === 'generator' ? 'single-settings-slot' : 'batch-settings-slot').append($('output-settings'));
    }
  }
  function followToolHash(scroll = false) {
    const hash = window.location.hash.slice(1) || 'generator';
    const id = hash === 'decoder-title' ? 'decoder-section' : hash;
    if (!toolIds.includes(id)) return;
    showTool(id);
    if (scroll) $(id).scrollIntoView({ block: 'start' });
  }
  const status = (message, state = 'info') => { $('batch-status').textContent = message; $('batch-status').dataset.state = state; };
  function fields() { return [...$('payload-fields').querySelectorAll('input, textarea, select')]; }
  function clearFields() {
    for (const field of fields()) {
      field.disabled = false;
      if (field.type === 'checkbox') field.checked = false;
      else if (field.tagName === 'SELECT') field.selectedIndex = 0;
      else field.value = '';
    }
    $('payload-status').textContent = '';
  }
  function selectType(type, preserve = false) {
    textVersion++;
    pendingText = false;
    mode = type;
    setTextFileStatus('支持 UTF-8 编码的 TXT、MD、CSV、JSON 文件。');
    $('payload-fields').replaceChildren();
    $('payload-fields').hidden = type === 'text';
    elements.input.readOnly = type !== 'text';
    $('payload-preview').open = type === 'text';
    $('payload-summary').hidden = type === 'text';
    $('content-label').textContent = type === 'text' ? '文本内容' : '编码内容（自动生成，可复制）';
    document.querySelector('.quick-actions').hidden = type !== 'text';
    for (const button of document.querySelectorAll('[data-type]')) button.setAttribute('aria-pressed', String(button.dataset.type === type));
    $('payload-status').textContent = type === 'text' ? '' : '填写表单后自动生成；扫码后的操作由手机和扫描软件决定。';
    if (!preserve) { elements.input.value = ''; clearQrCanvas(); updateCounter(); }
    for (const [name, labelText, kind, placeholder] of schemas[type] || []) {
      const label = document.createElement('label');
      label.className = kind === 'checkbox' ? 'privacy-toggle' : 'field-label';
      const field = document.createElement(kind === 'textarea' ? 'textarea' : kind === 'select' ? 'select' : 'input');
      field.id = `field-${name}`; field.name = name;
      label.htmlFor = field.id;
      if (kind === 'select') {
        for (const [value, text] of placeholder) { const option = document.createElement('option'); option.value = value; option.textContent = text; field.append(option); }
      } else {
        if (kind !== 'textarea') field.type = kind;
        field.autocomplete = 'off'; field.spellcheck = false;
        field.maxLength = kind === 'textarea' ? 1500 : 300;
        if (placeholder) field.placeholder = placeholder;
      }
      label.append(document.createTextNode(labelText), field);
      $('payload-fields').append(label);
      field.addEventListener(kind === 'select' || kind === 'checkbox' ? 'change' : 'input', syncPayload);
    }
  }
  function syncPayload() {
    const values = Object.fromEntries(fields().map((field) => [field.name, field.type === 'checkbox' ? field.checked : field.value]));
    const password = $('field-password');
    if (password) { password.disabled = values.auth === 'nopass'; if (password.disabled) password.value = ''; }
    try {
      elements.input.value = core.payload(mode, values);
      $('payload-status').textContent = mode === 'wifi' ? '密码会写入二维码；拿到图片的人可以读取，请只分享给可信的人。' : '已生成标准格式内容。';
      $('payload-status').dataset.state = 'info';
      queueGeneration();
    } catch (error) {
      elements.input.value = '';
      clearQrCanvas(); updateCounter();
      $('payload-status').textContent = error.message;
      $('payload-status').dataset.state = 'warning';
    }
    noteActivity();
  }
  function releaseDownload(url) {
    window.clearTimeout(downloads.get(url));
    URL.revokeObjectURL(url);
    downloads.delete(url);
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    downloads.set(url, window.setTimeout(() => releaseDownload(url), 1500));
    showToast('已发起下载，请在浏览器下载列表查看。');
  }
  const pngBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片导出失败，请重试。')), 'image/png'));
  function exportName() { return core.filename($('export-name').value || '二维码'); }
  async function downloadPng() {
    if (checkPrivacyDeadline() || !currentQr) return;
    const qr = currentQr, version = sessionVersion;
    try {
      const blob = await pngBlob(elements.canvas);
      if (!checkPrivacyDeadline() && version === sessionVersion && qr === currentQr) saveBlob(blob, `${exportName()}.png`);
    } catch (error) { if (version === sessionVersion) showToast(error.message); }
  }
  function clearPrint() {
    for (const canvas of $('print-sheets').querySelectorAll('canvas')) canvas.width = 0;
    $('print-sheets').replaceChildren();
    printSource = [];
    $('print-preview').hidden = true;
  }
  function clearBatch(clearInput = true) {
    closeZoom('batch');
    batchVersion++;
    batchPending = false;
    for (const record of records) { if (record.canvas) record.canvas.width = 0; record.qr = undefined; record.name = ''; }
    records = [];
    $('batch-results').replaceChildren();
    $('batch-empty').hidden = false;
    $('batch-zip-button').disabled = $('batch-print-button').disabled = true;
    $('batch-generate-button').disabled = false;
    if (clearInput) { $('batch-input').value = ''; $('batch-file').value = ''; }
    clearPrint();
    status('准备好内容后，点击“生成这一批”。可在外观与导出设置中调整样式。');
  }
  function clear() {
    closeZoom();
    clearFields(); clearBatch();
    $('export-name').value = '';
    for (const url of [...downloads.keys()]) releaseDownload(url);
  }
  function hasData() {
    return Boolean(zoomUrl || $('batch-input').value || $('export-name').value || records.length || batchPending || printSource.length || fields().some((field) => field.tagName !== 'SELECT' && (field.type === 'checkbox' ? field.checked : field.value)));
  }
  async function generateBatch() {
    if (checkPrivacyDeadline()) return;
    clearBatch(false);
    let rows;
    try { rows = core.batch($('batch-input').value, $('batch-format').value); }
    catch (error) { status(error.message, 'error'); return; }
    const version = batchVersion, session = sessionVersion, options = currentOptions();
    batchPending = true;
    $('batch-empty').hidden = true;
    $('batch-generate-button').disabled = true;
    noteActivity();
    let failures = 0;
    try {
      for (let i = 0; i < rows.length; i++) {
        await yieldFrame();
        if (checkPrivacyDeadline() || version !== batchVersion || session !== sessionVersion) return;
        const row = rows[i];
        const article = document.createElement('article'); article.className = 'batch-card';
        const title = document.createElement('h3'); title.textContent = `${i + 1}. ${row.name}`;
        article.append(title);
        try {
          const qr = core.encode(row.content, options.errorCorrectionLevel);
          const canvas = document.createElement('canvas');
          canvas.setAttribute('aria-label', `二维码 ${i + 1} 预览`);
          core.draw(qr, canvas, { ...options, width: 256 });
          const record = { name: row.name, qr, canvas, options, index: i + 1 };
          records.push(record);
          const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'qr-thumbnail';
          preview.setAttribute('aria-haspopup', 'dialog');
          preview.setAttribute('aria-label', `放大预览第 ${i + 1} 个二维码`);
          const caption = document.createElement('span'); caption.textContent = '放大预览';
          preview.append(canvas, caption);
          preview.addEventListener('click', () => openZoom(record.qr, record.options, record.name, 'batch'));
          article.append(preview);
          const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = '下载 SVG';
          button.addEventListener('click', () => {
            if (checkPrivacyDeadline() || !record.qr) return;
            saveBlob(new Blob([core.svg(record.qr, record.options)], { type: 'image/svg+xml' }), `${String(record.index).padStart(3, '0')}-${core.filename(record.name)}.svg`);
          });
          article.append(button);
        } catch (error) { failures++; const message = document.createElement('p'); message.className = 'field-status'; message.dataset.state = 'error'; message.textContent = error.message; article.append(message); }
        $('batch-results').append(article);
        status(`正在生成 ${i + 1} / ${rows.length}…`);
      }
      status(`成功 ${records.length} 个，失败 ${failures} 个。下载和打印仅包含成功项；外观按本次生成时的设置保存。`, failures ? 'warning' : 'success');
      $('batch-zip-button').disabled = $('batch-print-button').disabled = !records.length;
    } finally {
      rows.length = 0;
      if (version === batchVersion) { batchPending = false; $('batch-generate-button').disabled = false; }
    }
  }
  async function exportBatch() {
    if (checkPrivacyDeadline() || !records.length) return;
    const version = batchVersion, session = sessionVersion, format = $('batch-export-format').value;
    const files = [];
    $('batch-zip-button').disabled = true;
    try {
      for (const record of records) {
        await yieldFrame();
        if (checkPrivacyDeadline() || version !== batchVersion || session !== sessionVersion) return;
        let data;
        if (format === 'svg') data = core.utf8(core.svg(record.qr, record.options));
        else {
          const canvas = document.createElement('canvas');
          try { core.draw(record.qr, canvas, record.options); data = new Uint8Array(await (await pngBlob(canvas)).arrayBuffer()); }
          finally { canvas.width = 0; }
        }
        if (checkPrivacyDeadline() || version !== batchVersion || session !== sessionVersion) return;
        files.push({ name: `${String(record.index).padStart(3, '0')}-${core.filename(record.name)}.${format}`, data });
      }
      saveBlob(core.zip(files), `二维码批量-${format}.zip`);
    } catch { if (version === batchVersion) status('打包失败，请减少数量或改用 SVG 后重试。', 'error'); }
    finally { for (const file of files) file.data.fill(0); files.length = 0; if (version === batchVersion) $('batch-zip-button').disabled = !records.length; }
  }
  function renderPrint() {
    const source = printSource.slice();
    for (const canvas of $('print-sheets').querySelectorAll('canvas')) canvas.width = 0;
    $('print-sheets').replaceChildren();
    const list = source.length === 1 ? Array.from({ length: Number($('print-copies').value) }, () => source[0]) : source;
    $('print-copies').disabled = source.length !== 1;
    for (let start = 0; start < list.length; start += 12) {
      const sheet = document.createElement('div'); sheet.className = 'label-sheet';
      for (const record of list.slice(start, start + 12)) {
        const label = document.createElement('article'); label.className = 'print-label';
        const canvas = document.createElement('canvas');
        // High enough resolution for dense codes; print only neutral colors.
        core.draw(record.qr, canvas, { ...record.options, width: 1024, dark: '#000000', light: '#ffffff' });
        const title = document.createElement('p'); title.textContent = record.name;
        label.append(canvas, title); sheet.append(label);
      }
      $('print-sheets').append(sheet);
    }
    $('print-preview').hidden = false;
  }
  function openPrint(source) {
    if (checkPrivacyDeadline() || !source.length) return;
    clearPrint(); printSource = source.slice(); renderPrint();
    $('print-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('download-svg-button').addEventListener('click', () => {
    if (checkPrivacyDeadline() || !currentQr) return;
    saveBlob(new Blob([core.svg(currentQr, currentOptions())], { type: 'image/svg+xml' }), `${exportName()}.svg`);
  });
  for (const id of ['qr-stage', 'zoom-single-button']) $(id).addEventListener('click', () => openZoom(currentQr, currentOptions(), '', 'single'));
  $('zoom-close-button').addEventListener('click', () => closeZoom());
  $('zoom-clear-button').addEventListener('click', () => clearAllData());
  $('zoom-dialog').addEventListener('cancel', (event) => { event.preventDefault(); closeZoom(); });
  // A delayed close event from an earlier opening must not wipe a new preview.
  $('zoom-dialog').addEventListener('close', () => { if (!$('zoom-dialog').open) closeZoom(); });
  $('zoom-dialog').addEventListener('click', (event) => {
    if (event.target !== $('zoom-dialog')) return;
    const rect = $('zoom-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeZoom();
  });
  for (const button of document.querySelectorAll('[data-zoom]')) button.addEventListener('click', () => {
    if (!checkPrivacyDeadline()) setZoom(button.dataset.zoom);
  });
  $('scan-check-button').addEventListener('click', () => {
    if (checkPrivacyDeadline() || !currentQr) return;
    let pixels;
    try {
      const ctx = elements.canvas.getContext('2d', { willReadFrequently: true });
      pixels = ctx.getImageData(0, 0, elements.canvas.width, elements.canvas.height).data;
      const result = window.jsQR(pixels, elements.canvas.width, elements.canvas.height, { inversionAttempts: 'attemptBoth' });
      const valid = result?.data === elements.input.value;
      elements.quality.textContent = valid ? '识别自检通过：当前图片可读出一致内容。打印后请再用手机检查。' : '识别自检未通过：请增大尺寸、缩短内容或恢复深色码点与白色背景。';
      elements.quality.dataset.state = valid ? 'success' : 'warning';
    } catch { elements.quality.textContent = '自检未完成，请调整尺寸后重试。'; }
    finally { pixels?.fill(0); }
  });
  $('batch-generate-button').addEventListener('click', generateBatch);
  $('batch-zip-button').addEventListener('click', exportBatch);
  $('batch-clear-button').addEventListener('click', () => { clearBatch(); checkPrivacyDeadline(); });
  $('batch-input').addEventListener('input', () => clearBatch(false));
  $('batch-format').addEventListener('change', () => clearBatch(false));
  $('batch-example-button').addEventListener('click', () => {
    clearBatch();
    $('batch-input').value = $('batch-format').value === 'csv' ? 'name,content\n设备 001,ASSET-001\n设备 002,ASSET-002\n产品页面,https://example.com/product' : '设备 001\tASSET-001\n设备 002\tASSET-002\n产品页面\thttps://example.com/product';
    noteActivity();
  });
  $('batch-import-button').addEventListener('click', () => $('batch-file').click());
  $('batch-file').addEventListener('change', async () => {
    const file = $('batch-file').files[0]; $('batch-file').value = '';
    if (!file) return;
    if (file.size > 256 * 1024) { status('文件超过 256 KB，请拆分后导入。', 'error'); return; }
    clearBatch(false);
    const version = batchVersion, session = sessionVersion;
    batchPending = true; noteActivity();
    try {
      const text = await file.text();
      if (checkPrivacyDeadline() || version !== batchVersion || session !== sessionVersion) return;
      $('batch-input').value = text.replace(/^\uFEFF/, '');
      $('batch-format').value = /\.csv$/i.test(file.name) ? 'csv' : 'lines';
      status('已在本地读取文件，请检查内容后生成。'); noteActivity();
    } catch { if (version === batchVersion) status('读取失败，请使用 UTF-8 编码的 TXT 或 CSV 文件。', 'error'); }
    finally { if (version === batchVersion) batchPending = false; }
  });
  $('print-single-button').addEventListener('click', () => { if (currentQr) openPrint([{ name: $('export-name').value || '二维码', qr: currentQr, options: currentOptions() }]); });
  $('batch-print-button').addEventListener('click', () => openPrint(records));
  $('print-close-button').addEventListener('click', clearPrint);
  $('print-copies').addEventListener('change', () => { if (!checkPrivacyDeadline() && printSource.length) renderPrint(); });
  $('print-button').addEventListener('click', () => { if (!checkPrivacyDeadline() && printSource.length) window.print(); });
  window.addEventListener('afterprint', clearPrint);
  for (const button of document.querySelectorAll('[data-type]')) button.addEventListener('click', () => selectType(button.dataset.type));
  for (const link of document.querySelectorAll('[data-tool]')) link.addEventListener('click', () => showTool(link.dataset.tool));
  document.querySelector('.skip-link').addEventListener('click', () => showTool('generator'));
  window.addEventListener('hashchange', () => followToolHash(true));
  $('show-preview-button').addEventListener('click', () => {
    if (checkPrivacyDeadline() || !currentQr) return;
    $('single-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('single-preview').focus({ preventScroll: true });
  });
  $('back-to-editor').addEventListener('click', () => {
    $('generator').scrollIntoView({ behavior: 'smooth', block: 'start' });
    (fields().find((field) => field.tagName === 'INPUT' && field.type !== 'checkbox') || elements.input).focus({ preventScroll: true });
  });
  followToolHash();
  window.QRStudio = { hasData, clear, clearFields, closeZoom, showTool, textMode: () => selectType('text', true), downloadPng };
})();
