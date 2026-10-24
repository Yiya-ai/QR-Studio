/* Application-level payloads and rendering. QR encoding: Project Nayuki (MIT).
 * References and design decisions: docs/competitive-research-2026-10-24.md. */
(() => {
  'use strict';
  const utf8 = (text) => new TextEncoder().encode(text);
  const escapeField = (text) => text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  function oneLine(value, label) {
    const text = String(value || '').trim();
    if (/[\r\n\x00-\x1f\x7f]/.test(text)) throw new Error(`${label}不能包含换行或控制字符。`);
    return text;
  }
  function webUrl(value) {
    let text = oneLine(value, '网址');
    if (!text) throw new Error('请填写网址。');
    if (!/^[a-z][a-z\d+.-]*:/i.test(text)) text = `https://${text}`;
    let url;
    try { url = new URL(text); } catch { throw new Error('请输入完整的网址，例如 https://example.com。'); }
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      throw new Error('网址只支持 HTTP / HTTPS，且不能包含账号密码。');
    }
    return url.href;
  }
  function email(value) {
    const text = oneLine(value, '邮箱');
    if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(text)) throw new Error('请输入有效的邮箱地址。');
    return text;
  }
  function phone(value) {
    const text = oneLine(value, '电话号码').replace(/[ ().-]/g, '');
    if (!/^\+?\d{3,20}$/.test(text)) throw new Error('电话号码应为 3–20 位数字，可带国家区号 +。');
    return text;
  }
  function foldLine(line) {
    let output = '', size = 0;
    for (const character of line) {
      const bytes = utf8(character).length;
      if (size + bytes > 75) { output += '\r\n '; size = 1; }
      output += character;
      size += bytes;
    }
    return output;
  }
  function payload(type, values) {
    if (type === 'url') return webUrl(values.url);
    if (type === 'wifi') {
      const ssid = String(values.ssid || '');
      if (!ssid || /[\r\n\x00]/.test(ssid) || utf8(ssid).length > 32) throw new Error('Wi-Fi 名称必填，且不能超过 32 个 UTF-8 字节或包含换行。');
      const auth = ['WPA', 'WEP', 'nopass'].includes(values.auth) ? values.auth : 'WPA';
      const password = String(values.password || '');
      if (auth !== 'nopass' && !password) throw new Error('请填写 Wi-Fi 密码，或选择无密码网络。');
      if (/[\r\n\x00]/.test(password)) throw new Error('Wi-Fi 密码不能包含换行。');
      const escape = (text) => text.replace(/[\\;,:\"]/g, '\\$&');
      return `WIFI:T:${auth};S:${escape(ssid)};${auth === 'nopass' ? '' : `P:${escape(password)};`}${values.hidden ? 'H:true;' : ''};`;
    }
    if (type === 'contact') {
      const name = oneLine(values.name, '姓名');
      if (!name) throw new Error('请填写联系人姓名。');
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:;${escapeField(name)};;;`, `FN:${escapeField(name)}`];
      if (values.organization) lines.push(`ORG:${escapeField(oneLine(values.organization, '单位'))}`);
      if (values.phone) lines.push(`TEL;TYPE=CELL:${phone(values.phone)}`);
      if (values.email) lines.push(`EMAIL:${escapeField(email(values.email))}`);
      if (values.website) lines.push(`URL:${escapeField(webUrl(values.website))}`);
      lines.push('END:VCARD');
      return lines.map(foldLine).join('\r\n');
    }
    if (type === 'email') return `mailto:${encodeURIComponent(email(values.email)).replace(/%40/g, '@')}?subject=${encodeURIComponent(oneLine(values.subject, '主题'))}&body=${encodeURIComponent(values.message || '')}`;
    if (type === 'phone') return `tel:${phone(values.phone)}`;
    if (type === 'sms') return `SMSTO:${phone(values.phone)}:${String(values.message || '')}`;
    return String(values.text || '');
  }
  function encode(content, level = 'M') {
    if (!content.length) throw new Error('请输入需要生成二维码的内容。');
    if (utf8(content).length > 12000) throw new Error('内容超过二维码容量，请缩短内容。');
    const lib = globalThis.qrcodegen;
    const ecc = { L: lib.QrCode.Ecc.LOW, M: lib.QrCode.Ecc.MEDIUM, Q: lib.QrCode.Ecc.QUARTILE, H: lib.QrCode.Ecc.HIGH }[level];
    if (!ecc) throw new Error('无效的容错等级。');
    try { return lib.QrCode.encodeSegments(lib.QrSegment.makeSegments(content), ecc, 1, 40, -1, false); }
    catch { throw new Error('内容超出当前容错等级的容量，或包含无效字符。请缩短内容或降低容错等级。'); }
  }
  function options(input = {}) {
    const dark = input.dark || '#17172a', light = input.light || '#ffffff';
    const margin = Number(input.margin ?? 4), width = Number(input.width ?? 512);
    if (![dark, light].every((color) => /^#[\da-f]{6}$/i.test(color))) throw new Error('请选择有效颜色。');
    if (![4, 6, 8].includes(margin) || ![256, 512, 1024, 2048].includes(width)) throw new Error('无效的尺寸或边距。');
    return { dark, light, margin, width };
  }
  function draw(qr, canvas, input) {
    const o = options(input);
    canvas.width = canvas.height = o.width;
    const ctx = canvas.getContext('2d');
    const scale = Math.floor(o.width / (qr.size + o.margin * 2));
    const offset = Math.floor((o.width - qr.size * scale) / 2);
    ctx.fillStyle = o.light;
    ctx.fillRect(0, 0, o.width, o.width);
    ctx.fillStyle = o.dark;
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) ctx.fillRect(offset + x * scale, offset + y * scale, scale, scale);
    }
    return scale;
  }
  function svg(qr, input) {
    const o = options(input), size = qr.size + o.margin * 2;
    const paths = [];
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) paths.push(`M${x + o.margin},${y + o.margin}h1v1h-1z`);
    }
    // Only numeric matrix coordinates and validated colors enter markup; payloads never do.
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.width}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${o.light}"/><path d="${paths.join('')}" fill="${o.dark}"/></svg>`;
  }
  function luminance(hex) {
    const parts = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722;
  }
  function quality(input, size) {
    const o = options(input), dark = luminance(o.dark), light = luminance(o.light);
    const contrast = (Math.max(dark, light) + .05) / (Math.min(dark, light) + .05);
    const scale = Math.floor(o.width / (size + o.margin * 2));
    return { contrast, scale, warning: dark >= light ? '建议使用深色码点和浅色背景。' : contrast < 4.5 ? '颜色对比偏低，建议换用更深的码点颜色。' : scale < 3 ? '图案较密，建议提高导出尺寸或使用 SVG。' : '' };
  }
  function csvRows(text) {
    const rows = [];
    let row = [], field = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { quoted = false; closed = true; }
        else field += c;
      } else if (c === '"') {
        if (field || closed) throw new Error('CSV 引号格式有误。');
        quoted = true;
      } else if (c === ',' || c === '\n' || c === '\r') {
        row.push(field); field = ''; closed = false;
        if (c !== ',') { rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
      } else {
        if (closed) throw new Error('CSV 引号后应为逗号或换行。');
        field += c;
      }
    }
    if (quoted) throw new Error('CSV 存在未闭合的引号。');
    if (field || row.length || closed) rows.push([...row, field]);
    return rows;
  }
  function batch(text, format = 'lines') {
    if (utf8(text).length > 256 * 1024) throw new Error('批量文本不能超过 256 KB。');
    let rows;
    if (format === 'csv') {
      rows = csvRows(text).filter((row) => row.some((v) => v.trim()));
      if (rows[0]?.length === 2 && rows[0][0].trim().toLowerCase() === 'name' && rows[0][1].trim().toLowerCase() === 'content') rows.shift();
      if (rows.some((row) => row.length !== 2)) throw new Error('CSV 每行必须有两列：name,content。');
    } else rows = text.split(/\r\n|\n|\r/).filter((line) => line.trim()).map((line) => {
      const tab = line.indexOf('\t');
      return tab < 0 ? ['', line] : [line.slice(0, tab), line.slice(tab + 1)];
    });
    if (!rows.length) throw new Error('请先输入批量内容。');
    if (rows.length > 50) throw new Error('一次最多生成 50 个二维码，请分批处理。');
    return rows.map(([name, content], index) => ({ name: name.trim().slice(0, 80) || `二维码 ${index + 1}`, content }));
  }
  function filename(name) {
    let safe = Array.from(name.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_')).slice(0, 64).join('').replace(/^[. ]+|[. ]+$/g, '');
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = `_${safe}`;
    return safe || '二维码';
  }
  // Standard ZIP store records (no compression): local files + directory + end record.
  // Each filename is caller-generated, relative, unique, and UTF-8 flagged.
  function zip(files) {
    const parts = [], directory = [];
    let offset = 0, directorySize = 0;
    const crc32 = (data) => {
      let crc = 0xffffffff;
      for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
      return (crc ^ 0xffffffff) >>> 0;
    };
    for (const file of files) {
      const name = utf8(file.name), data = file.data, crc = crc32(data);
      const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer);
      l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true);
      l.setUint16(12, 33, true); l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true); local.set(name, 30);
      const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
      parts.push(local, data); directory.push(central); offset += local.length + data.length; directorySize += central.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...directory, end], { type: 'application/zip' });
  }
  globalThis.QRStudioCore = { payload, encode, draw, svg, quality, batch, filename, zip, utf8 };
})();
