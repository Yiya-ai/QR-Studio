const elements = {
  input: document.querySelector('#content-input'),
  counter: document.querySelector('#content-count'),
  errorLevel: document.querySelector('#error-level'),
  size: document.querySelector('#size-select'),
  foreground: document.querySelector('#foreground-color'),
  background: document.querySelector('#background-color'),
  foregroundValue: document.querySelector('#foreground-value'),
  backgroundValue: document.querySelector('#background-value'),
  canvas: document.querySelector('#qr-canvas'),
  placeholder: document.querySelector('#qr-placeholder'),
  hint: document.querySelector('#preview-hint'),
  download: document.querySelector('#download-button'),
  copy: document.querySelector('#copy-button'),
  clear: document.querySelector('#clear-button'),
  toast: document.querySelector('#toast'),
  filePicker: document.querySelector('#file-picker'),
  decoderFile: document.querySelector('#decoder-file'),
  dropZone: document.querySelector('#drop-zone'),
  decoderImage: document.querySelector('#decoder-image'),
  decoderPreviewEmpty: document.querySelector('#decoder-preview-empty'),
  decoderStatus: document.querySelector('#decoder-status'),
  decodedResult: document.querySelector('#decoded-result'),
  decodedOutput: document.querySelector('#decoded-output'),
  copyDecoded: document.querySelector('#copy-decoded-button'),
  useDecoded: document.querySelector('#use-decoded-button'),
  textFilePicker: document.querySelector('#text-file-picker'),
  textFileInput: document.querySelector('#text-file-input'),
  textFileStatus: document.querySelector('#text-file-status'),
  clearAll: document.querySelector('#clear-all-button'),
  autoClear: document.querySelector('#auto-clear-select'),
  clearOnHide: document.querySelector('#clear-on-hide'),
  privacyStatus: document.querySelector('#privacy-status'),
  margin: document.querySelector('#margin-select'),
  svg: document.querySelector('#download-svg-button'),
  scanCheck: document.querySelector('#scan-check-button'),
  printSingle: document.querySelector('#print-single-button'),
  metrics: document.querySelector('#qr-metrics'),
  quality: document.querySelector('#quality-status'),
  previewJump: document.querySelector('#show-preview-button'),
  zoom: document.querySelector('#zoom-single-button'),
  zoomStage: document.querySelector('#qr-stage'),
};

const presets = {
  url: 'https://example.com/welcome',
  contact: 'BEGIN:VCARD\nVERSION:3.0\nFN:张小语\nTEL:+86 138 0000 0000\nEMAIL:hello@example.com\nEND:VCARD',
  wifi: 'WIFI:T:WPA;S:我的 Wi-Fi;P:请输入密码;;',
};

let toastTimer;
let generationTimer;
let previewUrl;
let privacyTimer;
let lastActivity = Date.now();
let sessionVersion = 0;
let textVersion = 0;
let imageVersion = 0;
let pendingText = false;
let cancelImageLoad;
let currentQr;

function hasPrivateData() {
  return Boolean(elements.input.value || elements.decodedOutput.value || previewUrl || pendingText || window.QRStudio?.hasData());
}

function clearQrCanvas() {
  window.QRStudio?.closeZoom?.('single');
  currentQr = undefined;
  elements.metrics.textContent = '';
  elements.quality.textContent = '';
  // Reset the bitmap as well as hiding it; hidden pixels still contain the QR.
  elements.canvas.width = elements.canvas.width;
  elements.canvas.hidden = true;
  elements.placeholder.hidden = false;
  elements.hint.textContent = '输入内容后即可生成二维码。';
  setControlsDisabled(true);
}

function clearAllData(message = '已清除当前页面的全部数据。', notify = true) {
  sessionVersion++;
  textVersion++;
  imageVersion++;
  window.QRStudio?.clear();
  pendingText = false;
  window.clearTimeout(generationTimer);
  window.clearTimeout(privacyTimer);
  window.clearTimeout(toastTimer);
  cancelImageLoad?.();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  elements.input.value = '';
  elements.input.defaultValue = '';
  elements.decodedOutput.value = '';
  elements.decodedOutput.defaultValue = '';
  elements.textFileInput.value = '';
  elements.decoderFile.value = '';
  elements.decoderImage.removeAttribute('src');
  elements.decoderImage.hidden = true;
  elements.decoderPreviewEmpty.hidden = false;
  elements.decodedResult.hidden = true;
  elements.dropZone.classList.remove('is-dragging');
  elements.toast.textContent = '';
  elements.toast.classList.remove('is-visible');
  setDecodeStatus('请选择一张清晰的二维码图片。');
  setTextFileStatus('支持 UTF-8 编码的 TXT、MD、CSV、JSON 文件。');
  clearQrCanvas();
  updateCounter();
  elements.privacyStatus.textContent = message;
  if (notify) showToast(message);
}

function checkPrivacyDeadline() {
  window.clearTimeout(privacyTimer);
  if (!hasPrivateData()) {
    elements.privacyStatus.textContent = '当前页面没有待清理的内容。';
    return false;
  }
  const minutes = Number(elements.autoClear.value);
  if (!minutes) {
    elements.privacyStatus.textContent = '自动清理已关闭；可随时一键清除。';
    return false;
  }
  const remaining = minutes * 60000 - (Date.now() - lastActivity);
  if (remaining <= 0) {
    clearAllData(`已自动清理：${minutes} 分钟无操作。`);
    return true;
  }
  elements.privacyStatus.textContent = `保护已开启 · 无操作约 ${Math.ceil(remaining / 60000)} 分钟后清理`;
  privacyTimer = window.setTimeout(checkPrivacyDeadline, Math.min(remaining, 10000));
  return false;
}

function noteActivity() {
  lastActivity = Date.now();
  checkPrivacyDeadline();
}

function currentOptions() {
  return {
    errorCorrectionLevel: elements.errorLevel.value,
    width: Number(elements.size.value),
    margin: Number(elements.margin.value || 4),
    dark: elements.foreground.value,
    light: elements.background.value,
    color: {
      dark: elements.foreground.value,
      light: elements.background.value,
    },
  };
}

function setControlsDisabled(isDisabled) {
  elements.download.disabled = isDisabled;
  elements.copy.disabled = isDisabled;
  elements.svg.disabled = isDisabled;
  elements.scanCheck.disabled = isDisabled;
  elements.printSingle.disabled = isDisabled;
  elements.previewJump.disabled = isDisabled;
  elements.zoom.disabled = isDisabled;
  elements.zoomStage.disabled = isDisabled;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 3200);
}

function updateCounter() {
  elements.counter.textContent = `${elements.input.value.length.toLocaleString('zh-CN')} / 2,950 · ${new TextEncoder().encode(elements.input.value).length.toLocaleString('zh-CN')} 字节`;
}

function updateColorLabels() {
  elements.foregroundValue.textContent = elements.foreground.value.toUpperCase();
  elements.backgroundValue.textContent = elements.background.value.toUpperCase();
}

function setTextFileStatus(message, state = 'info') {
  elements.textFileStatus.textContent = message;
  elements.textFileStatus.dataset.state = state;
  elements.textFileStatus.setAttribute('role', state === 'error' ? 'alert' : 'status');
}

async function importTextFile(file) {
  if (!file) return;
  const version = ++textVersion;
  pendingText = false;
  elements.textFileInput.value = '';
  if (file.size > 256 * 1024) {
    setTextFileStatus('文件超过 256 KB，请选择更小的文本文件。', 'error');
    return;
  }

  pendingText = true;
  noteActivity();
  try {
    const content = (await file.text()).replace(/^\uFEFF/, '');
    // A late file read must never restore content after a clear or newer input.
    if (checkPrivacyDeadline() || version !== textVersion) return;
    if (!content.trim()) {
      setTextFileStatus('该文件没有可转换的文本内容。', 'error');
      return;
    }
    if (content.length > Number(elements.input.maxLength)) {
      setTextFileStatus(`文件包含 ${content.length.toLocaleString('zh-CN')} 个字符，超过当前二维码可输入的 2,950 个字符。请缩短文本后重试。`, 'error');
      return;
    }

    window.QRStudio?.textMode();
    elements.input.value = content;
    setTextFileStatus(`已导入「${file.name}」，共 ${content.length.toLocaleString('zh-CN')} 个字符。`, 'success');
    queueGeneration();
    elements.input.focus();
  } catch {
    if (version !== textVersion) return;
    setTextFileStatus('读取文件失败，请确认文件为 UTF-8 编码的文本文件。', 'error');
  } finally {
    if (version === textVersion) {
      pendingText = false;
      checkPrivacyDeadline();
    }
  }
}

async function generateQr() {
  if (checkPrivacyDeadline()) return;
  const content = elements.input.value;
  updateCounter();
  updateColorLabels();
  clearQrCanvas();

  if (!content) {
    elements.canvas.hidden = true;
    elements.placeholder.hidden = false;
    elements.hint.textContent = '输入内容后即可生成二维码。';
    setControlsDisabled(true);
    return;
  }

  if (!window.qrcodegen?.QrCode || !window.QRStudioCore) {
    elements.canvas.hidden = true;
    elements.placeholder.hidden = false;
    elements.hint.textContent = '二维码组件未能加载，请刷新页面后重试。';
    setControlsDisabled(true);
    return;
  }

  try {
    const options = currentOptions();
    currentQr = window.QRStudioCore.encode(content, options.errorCorrectionLevel);
    window.QRStudioCore.draw(currentQr, elements.canvas, options);
    const quality = window.QRStudioCore.quality(options, currentQr.size);
    elements.metrics.textContent = `版本 ${currentQr.version} · ${currentQr.size} × ${currentQr.size} 格 · 对比度 ${quality.contrast.toFixed(1)}:1`;
    elements.quality.textContent = quality.warning || '边距和颜色检查通过，打印前仍建议实机扫码。';
    elements.quality.dataset.state = quality.warning ? 'warning' : 'success';
    elements.canvas.hidden = false;
    elements.placeholder.hidden = true;
    elements.hint.textContent = '二维码已准备好，可使用手机相机扫描。';
    setControlsDisabled(false);
  } catch (error) {
    elements.canvas.hidden = true;
    elements.placeholder.hidden = false;
    currentQr = undefined;
    elements.hint.textContent = error.message || '生成失败，请检查输入内容。';
    setControlsDisabled(true);
  }
}

function queueGeneration() {
  clearQrCanvas();
  updateCounter();
  noteActivity();
  window.clearTimeout(generationTimer);
  generationTimer = window.setTimeout(generateQr, 120);
}

function downloadPng() {
  if (checkPrivacyDeadline()) return;
  if (elements.download.disabled) return;
  window.QRStudio?.downloadPng();
}

async function copyContent() {
  if (checkPrivacyDeadline()) return;
  if (elements.copy.disabled) return;
  await copyText(elements.input.value, '内容已复制到剪贴板。');
}

async function copyText(content, message) {
  if (checkPrivacyDeadline() || !content) return;
  const version = sessionVersion;
  try {
    await navigator.clipboard.writeText(content);
    if (version !== sessionVersion) return;
    showToast(message);
  } catch {
    if (checkPrivacyDeadline() || version !== sessionVersion) return;
    const fallback = document.createElement('textarea');
    try {
      fallback.value = content;
      fallback.className = 'clipboard-fallback';
      document.body.append(fallback);
      fallback.select();
      const copied = document.execCommand('copy');
      showToast(copied ? message : '复制未成功，请选中文本后手动复制。');
    } catch {
      showToast('复制未成功，请选中文本后手动复制。');
    } finally {
      fallback.value = '';
      fallback.remove();
    }
  }
}

function setDecodeStatus(message, state = 'info') {
  elements.decoderStatus.textContent = message;
  elements.decoderStatus.dataset.state = state;
  elements.decoderStatus.setAttribute('role', state === 'error' ? 'alert' : 'status');
}

function updateImagePreview(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  elements.decoderImage.src = previewUrl;
  elements.decoderImage.hidden = false;
  elements.decoderPreviewEmpty.hidden = true;
}

function loadPreviewImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const release = () => {
      image.onload = null;
      image.onerror = null;
      cancelImageLoad = undefined;
    };
    cancelImageLoad = () => {
      release();
      image.removeAttribute('src');
      reject(new Error('图片读取已取消。'));
    };
    image.onload = () => { release(); resolve(image); };
    image.onerror = () => { release(); reject(new Error('图片无法读取。')); };
    image.src = url;
  });
}

async function decodeFile(file) {
  if (!file) return;
  const version = ++imageVersion;
  cancelImageLoad?.();
  elements.decoderFile.value = '';
  elements.decodedOutput.value = '';
  elements.decodedResult.hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  elements.decoderImage.removeAttribute('src');
  elements.decoderImage.hidden = true;
  elements.decoderPreviewEmpty.hidden = false;
  if (!file.type.startsWith('image/')) {
    setDecodeStatus('请选择 PNG、JPG、WEBP 等图片文件。', 'error');
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    setDecodeStatus('图片超过 12 MB，请选择更小的图片后重试。', 'error');
    return;
  }
  if (typeof window.jsQR !== 'function') {
    setDecodeStatus('解析组件未能加载，请刷新页面后重试。', 'error');
    return;
  }

  updateImagePreview(file);
  noteActivity();
  elements.decodedResult.hidden = true;
  setDecodeStatus('正在解析二维码…');

  let image;
  let canvas;
  let pixels;
  try {
    image = await loadPreviewImage(previewUrl);
    if (checkPrivacyDeadline() || version !== imageVersion) return;
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);
    pixels = context.getImageData(0, 0, width, height).data;
    const result = window.jsQR(pixels, width, height, { inversionAttempts: 'attemptBoth' });
    if (checkPrivacyDeadline() || version !== imageVersion) return;

    if (!result?.data) {
      setDecodeStatus('未识别到二维码。请上传更清晰、完整的二维码图片后重试。', 'error');
      return;
    }

    elements.decodedOutput.value = result.data;
    elements.decodedResult.hidden = false;
    setDecodeStatus('二维码已成功解析，内容如下。', 'success');
  } catch (error) {
    if (version !== imageVersion) return;
    setDecodeStatus('图片解析失败。请更换一张清晰的二维码图片后重试。', 'error');
  } finally {
    pixels?.fill(0);
    if (canvas) canvas.width = 0;
    image?.removeAttribute('src');
  }
}

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    window.QRStudio?.textMode();
    textVersion++;
    pendingText = false;
    elements.input.value = presets[button.dataset.preset];
    elements.input.focus();
    queueGeneration();
  });
});

elements.input.addEventListener('input', () => {
  textVersion++;
  pendingText = false;
  queueGeneration();
});
[elements.errorLevel, elements.size, elements.foreground, elements.background, elements.margin].forEach((control) => {
  control.addEventListener('input', queueGeneration);
  control.addEventListener('change', queueGeneration);
});
elements.download.addEventListener('click', downloadPng);
elements.copy.addEventListener('click', copyContent);
elements.clear.addEventListener('click', () => {
  window.QRStudio?.clearFields();
  textVersion++;
  pendingText = false;
  elements.input.value = '';
  setTextFileStatus('支持 UTF-8 编码的 TXT、MD、CSV、JSON 文件。');
  elements.input.focus();
  queueGeneration();
});
elements.filePicker.addEventListener('click', () => elements.decoderFile.click());
elements.decoderFile.addEventListener('change', () => decodeFile(elements.decoderFile.files[0]));
['dragenter', 'dragover'].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('is-dragging');
  });
});
['dragleave', 'drop'].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
  });
});
elements.dropZone.addEventListener('drop', (event) => decodeFile(event.dataTransfer.files[0]));
elements.textFilePicker.addEventListener('click', () => elements.textFileInput.click());
elements.textFileInput.addEventListener('change', () => importTextFile(elements.textFileInput.files[0]));
elements.copyDecoded.addEventListener('click', () => copyText(elements.decodedOutput.value, '解析结果已复制到剪贴板。'));
elements.useDecoded.addEventListener('click', () => {
  if (checkPrivacyDeadline()) return;
  window.QRStudio?.showTool('generator');
  window.location.hash = 'generator';
  window.QRStudio?.textMode();
  textVersion++;
  pendingText = false;
  elements.input.value = elements.decodedOutput.value;
  queueGeneration();
  document.querySelector('#generator').scrollIntoView({ behavior: 'smooth', block: 'start' });
  elements.input.focus({ preventScroll: true });
  showToast('解析结果已填入生成器。');
});

elements.clearAll.addEventListener('click', () => clearAllData());
elements.autoClear.addEventListener('change', noteActivity);
elements.clearOnHide.addEventListener('change', noteActivity);
// Check an elapsed deadline before an interaction can restart the idle timer.
['pointerdown', 'keydown', 'input', 'change', 'drop', 'click'].forEach((eventName) => {
  document.addEventListener(eventName, () => {
    checkPrivacyDeadline();
    noteActivity();
  }, true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && elements.clearOnHide.checked) {
    clearAllData('已清理：页面已切到后台。', false);
  } else {
    checkPrivacyDeadline();
  }
});
window.addEventListener('focus', checkPrivacyDeadline);
window.addEventListener('pagehide', () => clearAllData('已清理：离开页面。', false));
window.addEventListener('pageshow', (event) => {
  // Some browsers restore form values after scripts run, just before pageshow.
  clearAllData(event.persisted ? '已清理：从历史记录返回。' : '当前页面没有待清理的内容。', false);
  if (!event.persisted) {
    elements.autoClear.value = '5';
    elements.clearOnHide.checked = false;
  }
});
clearAllData('当前页面没有待清理的内容。', false);
updateColorLabels();
