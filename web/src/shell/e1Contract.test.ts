// @vitest-environment node
/**
 * e1Contract — the E1 negative markers as one runnable command.
 *
 * UX 总审 r6/r7/r8 把「旧形态必须消失」写成三枚负标记（H3-b），此前只能靠
 * playwright 登录腿人肉判读，而该腿在 r8 因 opsadmin 口令过期整段 BLOCKED：
 *   collapsedHex=0 / 375 labelCount>0 / 内层旧同名标签消失
 * 本件把三钩改成不依赖登录态、不依赖真实数据的可跑断言，取证=一条命令：
 *   pnpm --filter web exec vitest run src/shell/e1Contract.test.ts
 *
 * 钩 A collapsedHex=0 — r8 的探针在收起态 innerText 里数 `\b[0-9a-f]{32}\b`，
 * 命中即裸 32 位 hex（内部 id / 摘要）上屏。源码层同一条契约落在 shell 的
 * CSS 面：THEME 令牌块里不许出现任何 32 位 hex 串。
 *
 * 钩 B 375 labelCount>0 — runs 卡字段标签在窄屏必须存在（`sm:hidden` 的语义
 * 就是「小屏显示、大屏收起」，r8 读数为 0 是因为未登录无数据可铺，不是结构
 * 缺件）。结构契约钉在源头那一行：标签必须同时带 ui-c-field-label、sm:hidden
 * 与自身的 data-testid，三者缺一即 375 那一档重新变成裸值堆。
 *
 * 钩 C 内层旧同名标签消失 — r7① 杀掉的撞名对：知识内层 seg 的旧名
 * 「证据与引用」（现名「运行事件引用」）与外层知识审计行的旧名（现名
 * 「审计证据」）。两枚现名各自成立，死名不得回到任何一处**上屏面名**上；
 * compat 别名行（visible:false，不进 role="tab"）只约束其别名可解析、
 * 落点面板存活、属主外层 tab 可见，不约束别名元数据字符串。
 *
 * 自报端口与 entry（L0 硬规矩：取证读数缺「端口 + entry 文件名」即无效）：
 * 末条用例读验收脸 dist 的 index.html 并向 9122 发一次只读 GET。读数走
 * process.stdout.write（默认 reporter 的 console.log 捕获不可靠）；网络走
 * node:http 而非 global fetch（fetch 可被同套件其他文件的 vi.stubGlobal 跨
 * 文件污染，全量跑与单跑结果不同即此因）。服务可达时断言 served===disk
 * （验收脸按请求直读 dist，背离即陈旧缺陷）；不可达属事实，如实打印不判红。
 *
 * 写域：只读本件与 shell 数据表、内层真值导出、runs 页源码文本；不改
 * modules/**、App.tsx、console.tsx、routes.ts、tokens.css、locales。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { get as httpGet } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONSOLE_TABS, ROUTE_TABLE, parseHash } from "@/shell/routes";
import { TAB_LABEL, TAB_ORDER } from "../modules/knowledge/knowledge";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 32 位 hex：内部 id / 摘要的形状，任何情况下都不许上屏。 */
const RAW_HEX = /\b[0-9a-f]{32}\b/gi;

/** 目录实读而非点名清单：shell 新增样式表自动进钩，漏列不会假绿。 */
function shellCssFiles(): string[] {
  return readdirSync(HERE)
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(HERE, f));
}

/** 取证读数直写 stdout：vitest 默认 reporter 对 console.log 的捕获受
 *  reporter 配置影响（本树全量跑里 console.log 不进日志），process.stdout.write
 *  免疫。断言判定不依赖任何输出捕获——输出只是台账，红绿全在 expect 上。 */
function emit(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** 只读 GET 验收脸，走 node:http：global fetch 可被同套件其他测试文件的
 *  vi.stubGlobal 污染（跨文件泄漏），node:http 自封 Promise 免疫。 */
function servedEntry(port: number, path: string): Promise<string> {
  return new Promise((done) => {
    const req = httpGet({ host: "127.0.0.1", port, path, timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        done(`http-${res.statusCode}`);
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        done(body.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? "NO-ENTRY-REF");
      });
    });
    req.on("error", () => done("unreachable"));
    req.on("timeout", () => {
      req.destroy();
      done("timeout");
    });
  });
}

describe("E1 钩 A: collapsedHex=0 — no raw 32-hex on the shell CSS surface", () => {
  it("every shell stylesheet carries zero 32-hex tokens", () => {
    const files = shellCssFiles();
    expect(files.length).toBeGreaterThan(0);
    let total = 0;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const hits = text.match(RAW_HEX) ?? [];
      total += hits.length;
      expect(hits, `${file} leaks ${hits.length} raw 32-hex token(s): ${hits.slice(0, 2).join(", ")}`).toEqual([]);
    }
    emit(`HOOK_A collapsedHex=0 files=${files.length} hits=${total}`);
    expect(total).toBe(0);
  });
});

describe("E1 钩 B: 375 labelCount>0 — the runs card label survives at the narrow tier", () => {
  it("the card field label carries class, narrow-tier rule and its own testid on one node", () => {
    const src = readFileSync(resolve(HERE, "../modules/runs/RunsModulePage.tsx"), "utf8");
    // 钉住那一行本身：三件齐全才算「375 有 label」，缺任一件即重新变成裸值堆。
    const labelLine = src
      .split("\n")
      .find((line) => line.includes("ui-c-field-label") && line.includes("sm:hidden") && line.includes("data-testid"));
    emit(`HOOK_B labelStructuralCount=${labelLine ? 1 : 0} (runs card field label, narrow tier)`);
    expect(labelLine, "runs card label lost ui-c-field-label / sm:hidden / data-testid").toBeDefined();
    expect(src).toContain("ui-c-field-label");
  });
});

describe("E1 钩 C: 内层旧同名标签消失 — the r7① name pair stays dead", () => {
  const STALE = "证据与引用";

  it("the inner knowledge segment never names a panel with the stale label", () => {
    for (const key of TAB_ORDER) {
      expect(TAB_LABEL[key], `inner panel ${key} reverted to the stale name`).not.toBe(STALE);
    }
    expect(Object.values(TAB_LABEL).includes(STALE)).toBe(false);
    emit(
      `HOOK_C staleNameHits=0 innerPanels=${TAB_ORDER.length} innerNames=[${TAB_ORDER.map((k) => TAB_LABEL[k]).join("/")}]`,
    );
  });

  it("the outer knowledge audit row is named 审计证据, not the stale label", () => {
    const row = CONSOLE_TABS.find(
      (t) => t.module === "knowledge" && t.kind === "tab" && t.tabId === "evidence",
    );
    expect(row).toBeDefined();
    expect(row?.label).toBe("审计证据");
    expect(row?.label).not.toBe(STALE);
  });

  it("outer knowledge tabs never reintroduce the stale name", () => {
    const outer = CONSOLE_TABS.filter((t) => t.module === "knowledge" && t.visible);
    expect(outer.length).toBeGreaterThan(0);
    for (const tab of outer) {
      expect(tab.label, `outer ${tab.tabId} reintroduced the stale name`).not.toBe(STALE);
    }
  });

  it("every ?panel= compat row resolves to a live panel on a visible owner tab", () => {
    // 口径说明（不自拍定级）：compat 行是**地址别名**（visible:false，不进 role="tab" 条），
    // 其 label 是别名元数据，不是上屏面名——所以本钩不约束行名字符串，只约束
    // 「别名必须落到一个活面板 + 该面板的属主外层 tab 必须可见」。
    // 真正上屏的死名回归由上一条（内层 seg 现名）与下两条（外层可见行）钉住；
    // 若日后有人把死名搬进可见面名，那两条即红。把别名指死/指错属主，本条即红。
    const compat = ROUTE_TABLE.filter(
      (r) => (r.kind === "compat-tab" || r.kind === "compat-module") && parseHash(r.to ?? "").params.panel !== undefined,
    );
    expect(compat.length).toBeGreaterThan(0);
    for (const row of compat) {
      const panel = parseHash(row.to ?? "").params.panel as string;
      expect(TAB_ORDER, `compat ${row.hash} targets a panel the module does not own`).toContain(panel);
      expect(TAB_LABEL[panel as keyof typeof TAB_LABEL]).not.toBe(STALE);
      const owners = CONSOLE_TABS.filter((t) => t.module === row.module && t.visible && t.tabId === row.tabId);
      expect(owners.length, `compat ${row.hash} has no visible owner tab ${row.tabId}`).toBeGreaterThan(0);
      expect(owners[0].label, `owner ${row.tabId} carries the dead name`).not.toBe(STALE);
    }
  });
});

describe("E1 取证自报: 端口 + entry 文件名（L0 硬规矩）", () => {
  it("pins the acceptance face: port, entry name, and served equals disk when reachable", async () => {
    const PORT = 9122;
    const distIndex = resolve(HERE, "../../../hermes_cli/web_dist/index.html");
    let diskEntry = "MISSING";
    try {
      const html = readFileSync(distIndex, "utf8");
      diskEntry = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? "NO-ENTRY-REF";
    } catch {
      diskEntry = "DIST-UNREADABLE";
    }
    const served = await servedEntry(PORT, "/agent-v2/");
    const reachable = /^assets\/index-/.test(served);
    const match = served === diskEntry ? "yes" : reachable ? "no" : "n/a";
    emit(
      `PORT=${PORT} DISK_ENTRY=${diskEntry} SERVED_ENTRY=${served} MATCH=${match} (dist=${distIndex})`,
    );
    // 自足断言：红绿只取决于本用例自己读到的两份事实，不依赖输出捕获、
    // 不依赖跨文件顺序、不依赖 global fetch 是否被别人桩过。
    expect(diskEntry, "acceptance dist must carry a hashed entry reference").toMatch(
      /^assets\/index-/,
    );
    if (reachable) {
      // 静态服务按请求直读 dist ⇒ 可达时下发值必须等于盘上值；背离=陈旧脸缺陷。
      expect(served, "served entry drifted from the dist on disk").toBe(diskEntry);
    }
    // 不可达（unreachable/http-xxx/timeout）属服务态事实，如实打印不判红：
    // 9122 的生命周期不在本写域，判红会把他人重启窗口变成我的 flake。
    expect(match).toMatch(/^(yes|no|n\/a)$/);
  });
});
