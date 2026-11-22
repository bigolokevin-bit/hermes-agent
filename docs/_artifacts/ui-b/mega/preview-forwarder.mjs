// mega 取证转发器：静态面 → 本地 vite preview，数据腿 → 现网 8183（可注入登录 cookie）。
// 用法: node preview-forwarder.mjs <port> <staticPort> <cookie:1|0>
// cookie 来源 ~/.local/state/sekoi-ops/ui-qa-auth-state.json（两种形状都吃：
//   {cookies:[{name,value,...}]} 或 {name: value}），值绝不打印。
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [PORT_S, STATIC_S, COOKIE_S] = process.argv.slice(2);
const PORT = Number(PORT_S || 4182);
const STATIC = Number(STATIC_S || 4181);
const USE_COOKIE = COOKIE_S === '1';
const LIVE = { host: '100.117.184.117', port: 8183 };

function cookieHeader() {
  if (!USE_COOKIE) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.local/state/sekoi-ops/ui-qa-auth-state.json'), 'utf8'));
    if (Array.isArray(raw.cookies)) {
      return raw.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    }
    return Object.entries(raw).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}=${v}`).join('; ');
  } catch {
    return null;
  }
}

const isData = (u) => u.startsWith('/agent-api/') || u.startsWith('/api/') || u.startsWith('/auth/');

const server = http.createServer((req, res) => {
  const fwd = isData(req.url)
    ? { host: LIVE.host, port: LIVE.port, headers: { ...req.headers, host: `${LIVE.host}:${LIVE.port}`, ...(cookieHeader() ? { cookie: cookieHeader() } : {}) } }
    : { host: '127.0.0.1', port: STATIC, headers: req.headers };
  const p = http.request(fwd, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  p.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('forward-error ' + e.code);
  });
  req.pipe(p);
});

server.listen(PORT, '127.0.0.1', () => console.log(`FORWARDER_LISTEN 127.0.0.1:${PORT} static=${STATIC} cookie=${USE_COOKIE}`));
