// THROWAWAY evidence proxy for AU-01 — NOT product code. Kill after use.
// Serves this worktree's vite build (hermes_cli/web_dist) at 127.0.0.1:9262,
// strips /agent-api/* -> console BFF 127.0.0.1:8092/api/*, forwards /api/* -> 8092,
// and relays /auth/* (incl. /auth/whoami) to the REAL 9122 login layer — no synth.
// Lineage: DU-01 du01-proxy.mjs (port changed 9162->9262, ROOT -> AU-01-run tree).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/Users/kevin_studio/Projects/tasks/AU-01-run/hermes_cli/web_dist';
const BFF = { host: '127.0.0.1', port: 8092 };
const SHELL = { host: '127.0.0.1', port: 9122 };
const PORT = 9262;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
};

function relay(target, req, res, upPath) {
  const h = { ...req.headers };
  delete h.host; delete h.connection;
  const ureq = http.request({ ...target, path: upPath, method: req.method, headers: h }, (ures) => {
    res.writeHead(ures.statusCode ?? 502, ures.headers);
    ures.pipe(res);
    ures.on('end', () => console.log(`[proxy] ${req.method} ${req.url} -> ${upPath} ${ures.statusCode}`));
  });
  ureq.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(e) }));
    console.log(`[proxy] ${req.method} ${req.url} -> ${upPath} ERR ${e.code}`);
  });
  req.pipe(ureq);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname.startsWith('/agent-api/')) {
    return relay(BFF, req, res, url.pathname.replace('/agent-api', '') + url.search);
  }
  if (url.pathname.startsWith('/auth/')) {
    return relay(SHELL, req, res, url.pathname + url.search);
  }
  if (url.pathname.startsWith('/api/')) {
    return relay(BFF, req, res, url.pathname + url.search);
  }
  const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile(path.join(ROOT, 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`[proxy] listening 127.0.0.1:${PORT} root=${ROOT}`));
