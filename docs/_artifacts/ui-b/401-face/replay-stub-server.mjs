// replay-stub-server.mjs — 忠实回放 9122 现网响应混合（wave-154 根因取证，零外网）
// 9122 实测混合：文档/未知路径 → 200 index.html（SPA 兜底）；/api/status → 200 index.html
// （反代未转发 = 假 200，风暴复位源）；/agent-api/* → 401 {code:'console.unauthenticated'}
// （无 login_url，跳登录分支不触发）；/auth/* → 401 {detail}。
// 用法: node replay-stub-server.mjs <distDir> <port>
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DIST = process.argv[2];
const PORT = Number(process.argv[3] || 9125);

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
async function html(res) {
  const buf = await readFile(join(DIST, "index.html"));
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(buf);
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  if (p.startsWith("/agent-api/")) return json(res, 401, { code: "console.unauthenticated", message: "登录状态已失效。", rid: "replay-stub" });
  if (p.startsWith("/auth/")) return json(res, 401, { detail: "Not authenticated" });
  if (p === "/api/status") return html(res); // ← 假 200：现网 v4_proxy 不转发此路径
  if (p.startsWith("/api/")) return json(res, 401, { detail: "Not authenticated" });
  const file = p === "/" || !p.includes(".") ? "index.html" : p.slice(1);
  try {
    const buf = await readFile(join(DIST, file));
    const type = file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html; charset=utf-8";
    res.writeHead(200, { "content-type": type });
    res.end(buf);
  } catch {
    await html(res); // SPA fallback，与 v4_proxy 一致
  }
});
server.listen(PORT, "127.0.0.1", () => console.log("REPLAY-STORM-STUB listening http://127.0.0.1:" + PORT + " dist=" + DIST));
