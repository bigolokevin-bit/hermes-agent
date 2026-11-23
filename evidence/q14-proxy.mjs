// THROWAWAY evidence proxy for Q14 — NOT product code.
// Serves the Q14 worktree vite build (hermes_cli/web_dist) at 127.0.0.1:9131,
// strips /agent-api/* -> console BFF 127.0.0.1:8092/api/*, forwards /api/* -> 8092.
// Logs every proxied request line to stdout (evidence/proxy.log capture).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/Users/kevin_studio/Projects/tasks/Q14-metrics-bymodel/hermes_cli/web_dist';
const BFF = { host: '127.0.0.1', port: 8092 };
const PORT = 9131;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
};

function proxyToBff(req, res, upstreamPath) {
  const h = { ...req.headers };
  delete h.host; delete h.connection;
  const ureq = http.request({ ...BFF, path: upstreamPath, method: req.method, headers: h }, (ures) => {
    res.writeHead(ures.statusCode ?? 502, ures.headers);
    ures.pipe(res);
    ures.on('end', () => console.log(`[proxy] ${req.method} ${req.url} -> ${upstreamPath} ${ures.statusCode}`));
  });
  ureq.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(e) }));
    console.log(`[proxy] ${req.method} ${req.url} -> ${upstreamPath} ERR ${e.code}`);
  });
  req.pipe(ureq);
}

const LOGIN = { host: '127.0.0.1', port: 7860 }; // 受管登录桥上游（R17 配方）

function relayTo(target, req, res, upPath) {
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

function whoamiSynth(res) {
  // 壳层唯一登录证据 = /auth/whoami 2xx JSON（Auth5Session.tsx:26/46）。
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ user_id: 1, tenant_id: null, granted: true, display: 'opsadmin' }));
  console.log('[proxy] /auth/whoami -> 200 (synth from managed-bridge shape)');
}

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname.startsWith('/agent-api/')) {
    return proxyToBff(req, res, url.pathname.replace('/agent-api', '') + url.search);
  }
  if (url.pathname === '/auth/whoami') {
    return whoamiSynth(res);
  }
  if (url.pathname.startsWith('/auth/')) {
    return relayTo(LOGIN, req, res, url.pathname + url.search);
  }
  if (url.pathname.startsWith('/api/')) {
    return proxyToBff(req, res, url.pathname + url.search);
  }
  let file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile(path.join(ROOT, 'index.html')); // SPA fallback
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`[proxy] listening 127.0.0.1:${PORT} root=${ROOT}`));
