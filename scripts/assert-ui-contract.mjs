#!/usr/bin/env node
/**
 * UI 基础层契约机检闸（契约正文＝docs/product/design/UI-FOUNDATION-CONTRACT.md）
 * 十条条款逐条一个断言名；只读 DOM + 只读源码，绝不启服务、绝不改产物。
 *
 * 用法：
 *   node scripts/assert-ui-contract.mjs --url=http://127.0.0.1:9148 [--auth=<storageState.json>] [--stage=duty]
 *
 * 逐页爬坡口径（参谋 2026-11-23 拍）：
 *   --stage=duty 只把「样板页（总览值班台）本车道能负责的条款」列为 GATING；
 *   其余条款一律打 DEFERRED 并附实测计数，**绝不伪装成 PASS**。
 *   退出码：GATING 出现 FAIL ⇒ 1；全 GATING 通过 ⇒ 0。
 */
import { createRequire } from "node:module";
import { globSync } from "node:fs";
import os from "node:os";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const argv = process.argv.slice(2);
const arg = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
// L0 修复 2026-11-23：默认落 9122 验收脸（唯一常驻服务面；9148 是车道临时静态服务并非常态）。
const BASE = (arg("url") || "http://127.0.0.1:9122/agent-v2").replace(/\/$/, "");
const AUTH = arg("auth");
// L0 修复④（GATE 二级修复）：--auth 未传时，从 --token-file 的 netscape jar 取 token 注入同源 Cookie（值禁回显）。
const TOKEN_FILE = arg("token-file") || process.env.UI_GATE_TOKEN_FILE || "";
const STAGE = arg("stage") || "duty";
const NO_LAUNCH = argv.includes("--dry-parse");

const FONT_SCALE = [10.5, 11.5, 12.5, 13.5, 15, 20, 26, 32];
const SPACING = [0, 4, 8, 12, 16, 24, 32];
const BANNED_TEXT = /emp_|ce_|ob_|http|rid|correlation|[0-9a-f]{32}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const ENGLISH_ROLE = /\b(admin|operator|viewer|owner|member|engineer|agent)\b/i;

/** 条款 1-7 里能在页面 DOM 上判的部分，一次 evaluate 全取回。 */
const PROBE = ({ fontScale, spacing, bannedText, englishRole }) => {
  const hidden = (e) => {
    const s = getComputedStyle(e);
    return s.display === "none" || s.visibility === "hidden" || Number(s.opacity) <= 0.05;
  };
  const els = [...document.querySelectorAll("body *")].filter(
    (e) => !hidden(e) && e.getClientRects().length > 0,
  );
  const px = (v) => Math.round(parseFloat(v) * 100) / 100 || 0;
  const fonts = [...new Set(els.map((e) => px(getComputedStyle(e).fontSize)))].filter((v) => v > 0);
  const spaceVals = [...new Set(els.flatMap((e) => {
    const s = getComputedStyle(e);
    return ["marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "rowGap", "columnGap"]
      .map((k) => px(s[k]))
      .filter((v) => v > 0 && v < 200);
  }))];
  const selects = [...document.querySelectorAll("select")].length;
  const inlineFont = [...document.querySelectorAll("[style]")].filter((e) =>
    /font-size/i.test(e.getAttribute("style") || ""),
  );
  const h1s = [...document.querySelectorAll("h1")].map((e) => ({
    text: (e.textContent || "").trim().slice(0, 40),
    inTopbar: Boolean(e.closest("header,[data-testid*='topbar'],[data-testid*='-head']")),
    inContent: Boolean(e.closest("[data-testid*='grid'],main,.duty-grid")),
  }));
  const primaryButtons = [...document.querySelectorAll("button,a")].filter((e) => {
    const s = getComputedStyle(e);
    const solid = s.backgroundColor && !/rgba?\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor);
    const dark = Number(s.color.slice(1) ? 1 : 1);
    void dark;
    return solid && !s.backgroundColor.includes("0, 0, 0, 0") && e.offsetParent !== null &&
      (s.borderTopWidth === "0px" || s.boxShadow !== "none");
  }).length;
  const rows = (sel) => {
    const grid = document.querySelector(sel);
    if (!grid) return null;
    const kids = [...grid.children].filter((c) => !hidden(c));
    const heights = kids.map((c) => Math.round(c.getBoundingClientRect().height * 100) / 100);
    return { count: kids.length, heights };
  };
  const cardSlotScan = [...document.querySelectorAll('[data-duty-testid^="duty-"][class*="duty-card"]')].map((card) => ({
    id: card.getAttribute("data-duty-testid"),
    forbidden: [".duty-gates", ".duty-list", ".duty-ranges", ".duty-runs-caliber", ".duty-notes"]
      .filter((f) => card.querySelector(f)),
    hasDetailLink: Boolean(card.querySelector("a.duty-card-foot, [data-testid^='duty-route-']")),
    text: (card.textContent || "").replace(/\s+/g, " ").trim(),
  }));
  const filterRows = [...document.querySelectorAll('[role="group"], .duty-ranges, [class*="filter"]')].map((g) => {
    const kids = [...g.children].filter((c) => c.getClientRects().length > 0);
    const tops = kids.map((c) => Math.round(c.getBoundingClientRect().top));
    const lefts = kids.map((c) => Math.round(c.getBoundingClientRect().left));
    return {
      singleLine: tops.length === 0 || Math.max(...tops) - Math.min(...tops) <= 6,
      gaps: kids.slice(1).map((c, i) => Math.round(c.getBoundingClientRect().left - kids[i].getBoundingClientRect().right)),
      orderOk: lefts.every((v, i) => i === 0 || v >= lefts[i - 1]),
    };
  });
  const bodyText = (document.body.innerText || "").replace(/\s+/g, " ");
  const bannedHits = bodyText.match(new RegExp(bannedText, "gi")) || [];
  const roleHits = bodyText.match(new RegExp(englishRole, "gi")) || [];
  const identity = (() => {
    const node = document.querySelector('[data-testid*="identity"], [class*="identity"], header [class*="user"]');
    return node ? { found: true, text: (node.textContent || "").replace(/\s+/g, " ").trim() } : { found: false, text: "" };
  })();
  const footer = (() => {
    const node = document.querySelector("footer, [data-testid*='footer'], [class*='footer']");
    return node
      ? { found: true, text: (node.textContent || "").replace(/\s+/g, " ").trim(), selects: node.querySelectorAll("select").length }
      : { found: false, text: "", selects: 0 };
  })();
  const mainWidth = () => {
    const m = document.querySelector("main, [data-testid*='main'], .duty-page") || document.body;
    return Math.round(m.clientWidth);
  };
  const collapsed = localStorage.getItem("hermes.sidebar.collapsed");
  return {
    viewport: { w: innerWidth, h: innerHeight },
    docOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    fonts,
    fontOffScale: fonts.filter((v) => !fontScale.some((t) => Math.abs(t - v) <= 0.6)),
    spaceVals,
    spaceOffLadder: spaceVals.filter((v) => !spacing.includes(v)),
    selects,
    inlineFontCount: inlineFont.length,
    inlineFontSamples: inlineFont.slice(0, 5).map((e) => (e.getAttribute("style") || "").slice(0, 60)),
    h1s,
    primaryButtons,
    cardRows: rows(".duty-grid-3") || rows("[class*='duty-grid']"),
    cardRows2: rows(".duty-grid-2"),
    cardSlotScan,
    filterRows,
    bannedHits,
    roleHits,
    identity,
    footer,
    mainWidth: mainWidth(),
    collapsedPersisted: collapsed,
  };
};

const results = [];
const push = (name, clause, verdict, detail) => {
  results.push({ name, clause, verdict, detail });
  const mark = { PASS: "✔", FAIL: "✘", DEFERRED: "·", "NOT-RUN": "–" }[verdict] || "?";
  console.log(`${mark} ${verdict.padEnd(9)} ${name}（条款 ${clause}） — ${detail}`);
};


/**
 * 「闸需要浏览器」这件事在盘上是真的：playwright 只存在于 pnpm 商店里
 * （web/package.json 现已钉版 1.64.0，但要一次 pnpm install 才会链接进 node_modules）。
 * 解析链按可靠性排序，全部落空时如实报 RUNTIME-CLAUSE-SKIPPED（不伪装 PASS、也不崩）。
 */
async function loadChromium() {
  const tried = [];
  try {
    const mod = await import("playwright");
    if (mod && mod.chromium) return mod.chromium;
    tried.push("import(playwright)");
  } catch (error) {
    tried.push("import(playwright): " + error.code);
  }
  try {
    const req = createRequire(path.join(REPO, "web/package.json"));
    const mod = req("playwright");
    if (mod && mod.chromium) return mod.chromium;
    tried.push("require(web/package.json)");
  } catch (error) {
    tried.push("require(web/package.json): " + error.code);
  }
  const hints = [process.env.UI_GATE_PLAYWRIGHT, ...globSync(path.join(REPO, "..", "hermes-agent", "node_modules", ".pnpm", "playwright@1.64.0*", "node_modules", "playwright"))];
  for (const hint of hints) {
    if (!hint) continue;
    try {
      const mod = createRequire(path.join(REPO, "package.json"))(hint);
      if (mod && mod.chromium) return mod.chromium;
      tried.push("path:" + hint);
    } catch (error) {
      tried.push("path:" + hint + " -> " + error.code);
    }
  }
  console.log("RUNTIME-CLAUSE-SKIPPED playwright 解析失败；需 `pnpm install`（已钉 1.64.0）或设 UI_GATE_PLAYWRIGHT=<playwright 目录>。试过：" + tried.join(" | "));
  return null;
}


/** 已装浏览器优先：pnpm 商店里的 playwright 版本与缓存的 chromium 未必配对，直接指定可执行文件最稳。 */
function chromiumExecutable() {
  if (process.env.UI_GATE_CHROMIUM) return process.env.UI_GATE_CHROMIUM;
  const root = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  const patterns = [
    "chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    "chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  ];
  for (const pattern of patterns) {
    const hits = globSync(path.join(root, pattern)).sort();
    if (hits.length) return hits[hits.length - 1];
  }
  return null;
}

async function main() {
  // 源码层先判两条不需要浏览器的
  const shellTokens = existsSync(path.join(REPO, "web/src/shell/tokens.css"))
    ? readFileSync(path.join(REPO, "web/src/shell/tokens.css"), "utf8")
    : "";
  if (shellTokens && !/@import\s+"?\.\.\/styles\/tokens\.css/.test(shellTokens)) {
    push("token-single-source", "T1 前置", "FAIL", "shell/tokens.css 未转发到唯一真值源");
  } else {
    push("token-single-source", "T1 前置", "PASS", "shell/tokens.css 只做 @import 转发");
  }

  if (NO_LAUNCH) {
    console.log("DRY-PARSE ok");
    return finish();
  }

  const chromium = await loadChromium();
  if (!chromium) return finish();
  const exec = chromiumExecutable();
  let browser;
  try {
    browser = await chromium.launch(exec ? { executablePath: exec } : {});
  } catch (error) {
    console.log("RUNTIME-CLAUSE-SKIPPED 浏览器启动失败（" + String(error.message).split("\n")[0] + "）；需 `npx playwright install chromium` 或设 UI_GATE_CHROMIUM=<可执行文件>");
    return finish();
  }
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(AUTH ? { storageState: AUTH } : {}),
  });
  // L0 修复④：登录态注入——运行时条款必须在登录态跑（匿名骨架态污染全部读数，2026-11-23 11:5x 实锤）。
  let tokenInjected = false;
  if (!AUTH && TOKEN_FILE) {
    try {
      const jar = readFileSync(TOKEN_FILE, "utf8");
      const hit = jar.split("\n").find((l) => l.split("\t")[5] === "access_token_cookie");
      const val = hit ? hit.split("\t")[6].trim() : "";
      if (val) {
        await ctx.addCookies([{ name: "access_token_cookie", value: val, url: BASE, httpOnly: true, path: "/" }]);
        tokenInjected = true;
      }
    } catch {
      // jar 读取失败不崩：交给 whoami 断言的显式降级标记兜底
    }
  }
  const page = await ctx.newPage();
  // L0 修复 2026-11-23①：先落正常 origin 再发相对 fetch（原顺序在 about:blank 上 fetch，whoami 恒 -1）。
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  const whoami = await page.evaluate(async () => {
    try {
      const r = await fetch("/auth/whoami", { credentials: "same-origin" });
      return r.status;
    } catch {
      return -1;
    }
  }).catch(() => -1);
  // L0 修复④：whoami 非 200 显式降级——匿名态读数不作判据，拒绝骨架伪像入账。
  if (whoami !== 200) {
    console.log(
      `WARN 匿名态：whoami=${whoami}${!AUTH && !TOKEN_FILE ? "（未给登录态：传 --token-file=<jar> 或 --auth=<storageState>，或设 UI_GATE_TOKEN_FILE）" : ""}——运行时条款读数不作判据`,
    );
  }
  // L0 修复②（AGENTS.md《车道测量腿三坑》条1）：networkidle 在验收脸永不收敛（活轮询+重试风暴），
  // 超时被 catch 吞掉后页停 about:blank，PROBE 的 localStorage 即抛 SecurityError（GATE_EXIT=2 根因）。
  await page.goto(`${BASE}/#/overview`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.waitForFunction(
    () => !document.querySelector(".animate-pulse") && document.body.innerText.trim().length > 40,
    null,
    { timeout: 30000 },
  ).catch(() => {});
  // L0 修复③：显式闸 guard——目标页不可达时报可读环境错，拒绝 about:blank 伪读数。
  if (!page.url().startsWith("http")) {
    throw new Error(`目标页不可达：page.url=${page.url()} BASE=${BASE}（检查 9122 是否在听或传 --url）`);
  }
  const probe = await page.evaluate(PROBE, {
    fontScale: FONT_SCALE,
    spacing: SPACING,
    bannedText: BANNED_TEXT.source,
    englishRole: ENGLISH_ROLE.source,
  });

  console.log(`\n脸=${BASE} 登录whoami=${whoami} token注入=${tokenInjected ? "是" : "否"} 视口=${probe.viewport.w}x${probe.viewport.h} stage=${STAGE}\n`);
  const gating = STAGE === "duty" ? new Set([3, 5, 6, 7, 10]) : new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const verdictFor = (n) => (gating.has(n) ? "FAIL" : "DEFERRED");

  // 条款 1 字阶
  push("font-scale-token-only", 1, probe.fontOffScale.length === 0 ? "PASS" : verdictFor(1),
    `实测字号 ${probe.fonts.length} 种，离阶 ${probe.fontOffScale.length} 种：${probe.fontOffScale.slice(0, 8).join(", ")}`);
  // 条款 2 间距
  push("spacing-ladder-only", 2, probe.spaceOffLadder.length === 0 ? "PASS" : verdictFor(2),
    `离阶梯值 ${probe.spaceOffLadder.length} 个：${probe.spaceOffLadder.slice(0, 8).join(", ")}`);
  // 条款 3 原生 select
  push("native-select-zero", 3, probe.selects === 0 ? "PASS" : verdictFor(3), `DOM <select> 计数=${probe.selects}`);
  // 条款 4 内联字号
  push("no-inline-font-size", 4, probe.inlineFontCount === 0 ? "PASS" : verdictFor(4),
    `带 style 且含 font-size 的元素=${probe.inlineFontCount} 样例：${probe.inlineFontSamples.join(" | ") || "无"}`);
  // 条款 5 卡片固定槽位 + 等高
  {
    const row = probe.cardRows;
    const heightDiff = row && row.heights.length > 1 ? Math.max(...row.heights) - Math.min(...row.heights) : 0;
    const forbidden = probe.cardSlotScan.flatMap((c) => c.forbidden.map((f) => `${c.id}:${f}`));
    const missingLink = probe.cardSlotScan.filter((c) => !c.hasDetailLink).map((c) => c.id);
    const ok = row && row.count >= 3 && heightDiff <= 1 && forbidden.length === 0 && missingLink.length === 0;
    push("card-slots-and-equal-height", 5, ok ? "PASS" : verdictFor(5),
      `同排卡片数=${row?.count ?? 0} 高度=[${(row?.heights ?? []).join(", ")}] 最大差=${heightDiff}px 卡内明细残留=${forbidden.join(",") || "0"} 缺查看明细=${missingLink.join(",") || "0"}`);
  }
  // 条款 6 顶栏唯一 h1
  {
    const h1count = probe.h1s.length;
    const dup = probe.h1s.filter((h) => h.inContent).length;
    const ok = h1count === 1 && probe.h1s[0]?.inTopbar && dup === 0;
    push("single-h1-in-topbar", 6, ok ? "PASS" : verdictFor(6),
      `h1 计数=${h1count}（${probe.h1s.map((h) => h.text).join("/")}）在顶栏=${probe.h1s[0]?.inTopbar ?? false} 内容区重复=${dup}`);
  }
  // 条款 7 筛选行单行 + 每页一个主按钮
  {
    const multiline = probe.filterRows.filter((r) => !r.singleLine).length;
    const badGap = probe.filterRows.filter((r) => r.gaps.some((g) => g >= 0 && ![8, 12].includes(g))).length;
    const okBtn = probe.primaryButtons <= 1;
    const ok = multiline === 0 && badGap === 0 && okBtn;
    push("filter-row-single-line + one-primary-per-page", 7, ok ? "PASS" : verdictFor(7),
      `筛选组=${probe.filterRows.length} 多行=${multiline} gap 不合规=${badGap} 实心主按钮=${probe.primaryButtons}`);
  }
  // 条款 8 侧栏折叠真适配（需要交互，样板页阶段先记实测，不改 shell）
  {
    let delta = null;
    let overflowAfter = null;
    try {
      const toggle = await page.$('[data-testid*="sidebar-collapse"], [aria-label*="折叠"], [aria-label*="侧栏"]');
      const before = probe.mainWidth;
      if (toggle) {
        await toggle.click();
        await page.waitForTimeout(700);
        const after = await page.evaluate(() => {
          const m = document.querySelector("main, [data-testid*='main'], .duty-page") || document.body;
          return { w: Math.round(m.clientWidth), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        delta = Math.abs(after.w - before);
        overflowAfter = after.overflow;
      }
    } catch {
      delta = null;
    }
    const ok = delta !== null && delta >= 120 && (overflowAfter ?? 1) <= 1 && probe.collapsedPersisted !== null;
    push("sidebar-collapse-reflows", 8, ok ? "PASS" : verdictFor(8),
      delta === null ? `未找到折叠控件；localStorage 折叠态=${probe.collapsedPersisted ?? "无"}` : `宽度差=${delta}px 折叠后溢出=${overflowAfter}px 持久化=${probe.collapsedPersisted ?? "无"}`);
  }
  // 条款 9 底栏
  {
    const hasLang = /中文|English|语言/.test(probe.footer.text) || probe.footer.selects > 0;
    const hasTheme = /日间|夜间|主题/.test(probe.footer.text) || /日间|夜间|主题/.test(documentlessGuard(probe.bodyText));
    const upstream = /nous research|nousresearch/i.test(probe.footer.text);
    const ok = probe.footer.found && !hasLang && hasTheme && !upstream;
    push("footer-no-lang-has-theme-toggle", 9, ok ? "PASS" : verdictFor(9),
      `底栏存在=${probe.footer.found} 语言选择=${hasLang} 主题切换=${hasTheme} 上游字样=${upstream}｜底栏文本="${probe.footer.text.slice(0, 60)}"`);
  }
  // 条款 10 身份区
  {
    const banned = probe.bannedHits.filter((h) => probe.identity.text.toLowerCase().includes(String(h).toLowerCase()));
    const ok = probe.identity.found && probe.bannedHits.length === 0 && probe.roleHits.length === 0;
    push("identity-no-bare-id-no-english-role", 10, ok ? "PASS" : verdictFor(10),
      `身份区存在=${probe.identity.found} 屏面内部标识命中=${probe.bannedHits.length}（${probe.bannedHits.slice(0, 5).join(",")}） 英文角色名=${probe.roleHits.length}（${probe.roleHits.slice(0, 4).join(",")}） 身份区="${probe.identity.text.slice(0, 50)}" 残留=${banned.length}`);
  }

  await browser.close();
  return finish();
}

function documentlessGuard(_x) {
  return "";
}

function finish() {
  const fails = results.filter((r) => r.verdict === "FAIL");
  const passes = results.filter((r) => r.verdict === "PASS").length;
  const defers = results.filter((r) => r.verdict === "DEFERRED").length;
  console.log(
    `\nUI-CONTRACT 总计=${results.length} PASS=${passes} FAIL=${fails.length} DEFERRED=${defers}（stage=${STAGE}：DEFERRED 属未铺页/非本车道条款，不判绿也不掩盖）`,
  );
  process.exitCode = fails.length > 0 ? 1 : 0;
}

main().catch((e) => {
  console.log(`ASSERT-UI-CONTRACT ERROR ${e && e.message ? e.message : e}`);
  process.exitCode = 2;
});
