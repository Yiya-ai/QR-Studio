import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 8085);
const pageUrl = `http://${host}:${port}/`;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function sendText(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

function getSafePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, pageUrl).pathname);
  const requested = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  if (requested.split('/').some((segment) => segment.startsWith('.'))) return null;
  const filePath = resolve(root, `.${requested}`);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return null;
  return filePath;
}

async function serve(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    sendText(response, 405, 'Method not allowed');
    return;
  }

  let filePath;
  try {
    filePath = getSafePath(request.url || '/');
  } catch {
    sendText(response, 400, 'Bad request');
    return;
  }
  if (!filePath) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    await access(filePath);
    const file = await stat(filePath);
    if (!file.isFile()) {
      sendText(response, 404, 'Not found');
      return;
    }
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': file.size,
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

function openBrowser() {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', pageUrl] : [pageUrl];
  execFile(command, args, { windowsHide: true }, () => {});
}

const server = createServer(serve);
server.listen(port, host, () => {
  console.log(`QR-Studio is running at ${pageUrl}`);
  console.log('Press Ctrl+C to stop the server.');
  if (process.argv.includes('--open')) openBrowser();
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Set PORT to another value and try again.`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});
