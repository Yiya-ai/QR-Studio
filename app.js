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
};

const presets = {
  url: 'https://example.com/welcome',
  contact: 'BEGIN:VCARD\nVERSION:3.0\nFN:张小语\nTEL:+86 138 0000 0000\nEMAIL:hello@example.com\nEND:VCARD',
  wifi: 'WIFI:T:WPA;S:我的 Wi-Fi;P:请输入密码;;',
};

let toastTimer;
let generationTimer;
let previewUrl;

function currentOptions() {
  return {
    errorCorrectionLevel: elements.errorLevel.value,
    width: Number(elements.size.value),
    margin: 2,
    color: {
      dark: elements.foreground.value,
      light: elements.background.value,
    },
  };
}

function setControlsDisabled(isDisabled) {
  elements.download.disabled = isDisabled;
  elements.copy.disabled = isDisabled;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 3200);
}

function updateCounter() {
  elements.counter.textContent = `${elements.input.value.length.toLocaleString('zh-CN')} / 2,950`;
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
  if (file.size > 256 * 1024) {
    setTextFileStatus('文件超过 256 KB，请选择更小的文本文件。', 'error');
    return;
  }

  try {
    const content = (await file.text()).replace(/^\uFEFF/, '');
    if (!content.trim()) {
      setTextFileStatus('该文件没有可转换的文本内容。', 'error');
      return;
    }
    if (content.length > Number(elements.input.maxLength)) {
      setTextFileStatus(`文件包含 ${content.length.toLocaleString('zh-CN')} 个字符，超过当前二维码可输入的 2,950 个字符。请缩短文本后重试。`, 'error');
      return;
    }

    elements.input.value = content;
    setTextFileStatus(`已导入「${file.name}」，共 ${content.length.toLocaleString('zh-CN')} 个字符。`, 'success');
    queueGeneration();
    elements.input.focus();
  } catch {
    setTextFileStatus('读取文件失败，请确认文件为 UTF-8 编码的文本文件。', 'error');
  } finally {
    elements.textFileInput.value = '';
  }
}

async function generateQr() {
  const content = elements.input.value.trim();
  updateCounter();
  updateColorLabels();

  if (!content) {
    elements.canvas.hidden = true;
    elements.placeholder.hidden = false;
    elements.hint.textContent = '输入内容后即可生成二维码。';
    setControlsDisabled(true);
    return;
  }

  if (!window.QRCode?.CorrectLevel) {
    elements.canvas.hidden = true;
    elements.placeholder.hidden = false;
    elements.hint.textContent = '二维码组件未能加载，请刷新页面后重试。';
    setControlsDisabled(true);
    return;
  }

  try {
    const options = currentOptions();
    const renderTarget = document.createElement('div');
    new window.QRCode(renderTarget, {
      text: content,
      width: options.width,
      height: options.width,
      colorDark: options.color.dark,
      colorLight: options.color.light,
      correctLevel: window.QRCode.CorrectLevel[options.errorCorrectionLevel],
    });

    const sourceCanvas = renderTarget.querySelector('canvas');
    if (!sourceCanvas) throw new Error('Canvas QR rendering is unavailable.');

    elements.canvas.width = options.width;
    elements.canvas.height = options.width;
    const context = elements.canvas.getContext('2d');
    context.clearRect(0, 0, options.width, options.width);
    context.drawImage(sourceCanvas, 0, 0, options.width, options.width);
    elements.canvas.hidden = false;
    elements.placeholder.hidden = true;
    elements.hint.textContent = '二维码已准备好，可使用手机相机扫描。';
    setControlsDisabled(false);
  } catch (error) {
    elements.canvas.hidden = true;
    elements.placeholder.hidden = false;
    elements.hint.textContent = '内容过长，无法生成二维码。请减少文字或降低容错等级后重试。';
    setControlsDisabled(true);
  }
}

function queueGeneration() {
  window.clearTimeout(generationTimer);
  generationTimer = window.setTimeout(generateQr, 120);
}

function downloadPng() {
  if (elements.download.disabled) return;
  const link = document.createElement('a');
  link.download = `二维码-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = elements.canvas.toDataURL('image/png');
  link.click();
  showToast('PNG 二维码已开始下载。');
}

async function copyContent() {
  if (elements.copy.disabled) return;
  await copyText(elements.input.value.trim(), '内容已复制到剪贴板。');
}

async function copyText(content, message) {
  try {
    await navigator.clipboard.writeText(content);
    showToast(message);
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = content;
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.append(fallback);
    fallback.select();
    document.execCommand('copy');
    fallback.remove();
    showToast(message);
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

function loadPreviewImage() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法读取。'));
    image.src = previewUrl;
  });
}

async function decodeFile(file) {
  if (!file) return;
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
  elements.decodedResult.hidden = true;
  setDecodeStatus('正在解析二维码…');

  try {
    const image = await loadPreviewImage();
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);
    const result = window.jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'attemptBoth' });

    if (!result?.data) {
      setDecodeStatus('未识别到二维码。请上传更清晰、完整的二维码图片后重试。', 'error');
      return;
    }

    elements.decodedOutput.value = result.data;
    elements.decodedResult.hidden = false;
    setDecodeStatus('二维码已成功解析，内容如下。', 'success');
  } catch (error) {
    setDecodeStatus('图片解析失败。请更换一张清晰的二维码图片后重试。', 'error');
  }
}

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    elements.input.value = presets[button.dataset.preset];
    elements.input.focus();
    queueGeneration();
  });
});

elements.input.addEventListener('input', queueGeneration);
[elements.errorLevel, elements.size, elements.foreground, elements.background].forEach((control) => {
  control.addEventListener('input', queueGeneration);
  control.addEventListener('change', queueGeneration);
});
elements.download.addEventListener('click', downloadPng);
elements.copy.addEventListener('click', copyContent);
elements.clear.addEventListener('click', () => {
  elements.input.value = '';
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
  elements.input.value = elements.decodedOutput.value;
  queueGeneration();
  document.querySelector('#generator').scrollIntoView({ behavior: 'smooth', block: 'start' });
  elements.input.focus({ preventScroll: true });
  showToast('解析结果已填入生成器。');
});

setControlsDisabled(false);
elements.input.value = elements.input.value.trim();
generateQr();
