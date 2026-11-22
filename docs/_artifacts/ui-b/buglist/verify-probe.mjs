// verify-probe.mjs — 定向核验 observer 高价值 claim（通用检测器，输出含 selector+rect+text 可回映射）
// 用法: node verify-probe.mjs [BASE]
import { chromium } from "/Users/kevin_studio/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const BASE = process.argv[2] || "http://127.0.0.1:9122";
const st = JSON.parse(readFileSync("/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json", "utf8"));
const cv = st.access_token_cookie || (st.cookies || []).find(c => c.name === "access_token_cookie")?.value;

const DETECT = () => {
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.getAttribute && el.getAttribute("data-testid") ? "[t=" + el.getAttribute("data-testid") + "]" : "");
  let R = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const vw = innerWidth;
  const vis = (el) => { if (!el || !el.getBoundingClientRect) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const R0 = R; R = (el) => (el && el.getBoundingClientRect) ? R0(el) : [0, 0, 0, 0];
  const out = { stickyHits: [], tallNarrow: [], wrapBtns: [], siblingOverlap: [], dollarClip: [], unknowns: [], navDup: [], usability: null, titleRect: null };
  // A. sticky/fixed header 与内容重叠
  const bars = [...document.querySelectorAll("header,[class*='sticky'],[style*='sticky']")].filter(el => vis(el) && ["sticky", "fixed"].includes(getComputedStyle(el).position));
  const h1 = document.querySelector("main h1,main h2,[data-testid*='title']") || [...document.querySelectorAll("main *")].find(el => el.children.length === 0 && (el.textContent || "").trim().length > 3 && vis(el));
  out.titleRect = h1 ? { sel: sel(h1), t: (h1.textContent || "").trim().slice(0, 18), r: R(h1) } : null;
  for (const bar of bars) for (const el of document.querySelectorAll("main h1,main h2,main button,main [data-testid]")) if (vis(el) && el !== bar && !bar.contains(el)) { const a = bar.getBoundingClientRect(), b = el.getBoundingClientRect(); if (a.bottom > b.top + 1 && a.top < b.bottom - 1 && a.right > b.left && a.left < b.right) { out.stickyHits.push({ bar: sel(bar), el: sel(el), t: (el.textContent || "").trim().slice(0, 16), barR: R(bar), elR: R(b) }); break; } }
  // B. 一字一行（可见叶子元素宽<16 且文本≥2 字符）
  for (const el of document.querySelectorAll("main *")) { if (!vis(el) || el.children.length > 0) continue; const t = (el.textContent || "").trim(); const r = el.getBoundingClientRect(); if (t.length >= 2 && r.width > 0 && r.width < 16 && r.height >= t.length * 8) { out.tallNarrow.push({ sel: sel(el.parentElement), cell: t.slice(0, 8), r: R(el) }); if (out.tallNarrow.length > 4) break; } }
  // C. 按钮折行（文本2-8字 高>30）
  for (const b of document.querySelectorAll("main button")) { const t = (b.textContent || "").trim(); if (t.length >= 2 && t.length <= 8 && vis(b) && b.getBoundingClientRect().height > 32) out.wrapBtns.push({ t, r: R(b) }); if (out.wrapBtns.length > 5) break; }
  // D. 同父叶子兄弟矩形重叠
  outerD: for (const p of document.querySelectorAll("main p,main div")) { const kids = [...p.children].filter(k => vis(k) && k.children.length === 0 && (k.textContent || "").trim().length > 1); for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) { const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect(); if (a.right > b.left + 2 && b.right > a.left + 2 && a.bottom > b.top + 2 && b.bottom > a.top + 2) { out.siblingOverlap.push({ parent: sel(p), x: (kids[i].textContent || "").trim().slice(0, 14), y: (kids[j].textContent || "").trim().slice(0, 14), aR: R(kids[i]), bR: R(b) }); break outerD; } } if (out.siblingOverlap.length > 3) break; }
  // E. ±$ 文本右缘越界
  for (const el of document.querySelectorAll("main *")) { const t = (el.textContent || "").trim(); if (el.children.length === 0 && /^±\$\d*\.?\d*\(?$/.test(t) && vis(el) && el.getBoundingClientRect().right > vw + 1) out.dollarClip.push({ t, r: R(el), vw }); }
  // F. 版本页『未知』出现次数与位置
  for (const el of document.querySelectorAll("main *")) { if (el.children.length === 0 && (el.textContent || "").trim() === "未知" && vis(el)) out.unknowns.push(R(el)); }
  // G. 导航父子同名
  const groups = [...document.querySelectorAll("nav [class*='group'],aside *, nav p, nav span")].filter(e => e.children.length === 0 && vis(e)).map(e => (e.textContent || "").trim());
  const links = [...document.querySelectorAll("nav a")].filter(vis).map(e => (e.textContent || "").trim());
  for (const l of links) for (const g of groups) if (l && g && (g === l || (g.length > 2 && l.startsWith(g) && l !== g))) out.navDup.push(g + " / " + l);
  out.navDup = [...new Set(out.navDup)].slice(0, 6);
  // H. metrics 可用性一句话可见性
  for (const el of document.querySelectorAll("main p,main div")) { const t = (el.textContent || ""); if (el.children.length === 0 && /可用性一句话|未计入|无法计算/.test(t) && t.length > 40) { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); out.usability = { t: t.slice(0, 30), r: R(el), w: Math.round(r.width), display: cs.display, clip: cs.clip, vis: cs.visibility }; break; } }
  return out;
};

const browser = await chromium.launch({ headless: true });
const CASES = [["audit", 375], ["overview?tab=duty", 375]];
for (const [route, vw] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 900 } });
  if (cv) await ctx.addCookies([{ name: "access_token_cookie", value: cv, url: BASE, httpOnly: true, sameSite: "Lax", secure: false }]);
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/" + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    const o = await page.evaluate(DETECT);
    console.log("V " + JSON.stringify({ route, vw, ...o }));
  } catch (e) { console.log("V-ERR " + route + " " + String(e).slice(0, 100)); }
  await ctx.close();
}
await browser.close();
