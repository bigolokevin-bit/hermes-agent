// @vitest-environment jsdom
// R250 — /system 就地换 ?window=：health 在场时地址换窗不花分文、逐行复制三值一字不动；
// 深链带窗直进时 R92 的三值与四段形状重新成立一遍（纯测试，产品码零改动）。
//
// cite-only 记账（既有条道已覆盖处只回指针，本文件不重写）：
// · R92 system.rowcopy.test.tsx:93（三值+逐字+零额外请求本体）、:115/:125/:129（控制台服务(BFF)/运行时引擎/legacy-svc
//   三句逐字）、:137（2031 钟下数据时刻「—」）、:150（无数据戳时段 3 为「—」）、:154/:177（复制数据时刻而非读取
//   时刻，刷新中与刷新后）、:195/:209（剪贴板拒绝时兜底同文）、:220/:230/:234（状态筛选收窄时按钮重编号）。
// · 矩阵族 system.matrix.copy.test.tsx:226（失败行只复制状态词，rid/上游英文/「请求编号」都不进句，零额外读）、:267（读取时刻不进复制句）。
// · R237 system.copy.crosstab.test.tsx:404；R241 system.event.copy.export.cross.test.tsx:246/:279/:323；
//   R248 system.copy.cross.test.tsx:231/:278——那是换窗插在 health↔events 往返中间（供体里健康面当时被壳卸掉），本文件钉的是它的**就地 URL 变体**：health pane 全程在场，地址自己变。
// · R120 system.cross.failure.test.tsx:304/:359/:395；窗算术 system.window.isolation.test.tsx:212/:278；
//   rowCopy.ts:13 引的 R112 口径（sys-updated-at 是读取时刻，永不 substituting 进数据时刻段）。
// 净新陈述（现查）：grep -lE "window=7d|window=30d|window=24h|filter-window" ∩ grep -l "sys-row-copy-" 在 src/modules/health 恰好 1 个文件（即 R248 的往返变体）；「health 在场时就地换 URL」这一格是空的。
// 三条现场裁决（派工口径与产品相反处以产品为准）：
// 1)「矩阵行复制」是跨模块混称：sys-row-copy-<i> 长在 sys3-table 服务表（SystemHealthSurface.tsx:535 th「复制」、
//    :569 td、:572-573 testid）；读源矩阵没有逐行复制，只有表级 sys10-copy/sys-matrix-copy/sys7-export。
// 2)「行集换代」与产品相反：health 产品码 useSearchParams/useLocation/useParams 0 命中、get("window") 0 命中（两组 grep 实测），
//    就地换 ?window= 不换行集、不重编号、不改文本、不发任何请求。本文件钉的是**惰性**，「零额外请求」在此字面为真（对照 R248 返程要花 +4 读、必须标相反）。
// 3)「复制文本含 rid」结构上不可能：rowCopy.ts:19 四段（表名·读数·数据时刻·状态人话）没有 rid 字段；rid 只存在于
//    整表读失败的 sys3Failure（systemHealth.ts:233-242）面上，那一面已由 R120 持有。
// 37 车道口径：sys-evt-* 族在产品里不存在——现查跟踪树 79 行命中 / 20 个 health 测试文件 / health 产品码 0 命中（本文件自己那 3 处不计入）；只能在 DOM 上断言缺席，绝不编造。
// 产品真相（实测）：sys-row-copy-status（SystemHealthSurface.tsx:602）带 role=status + aria-live=polite；sys-updated-at 只在跑过刷新后才渲染（systemRefresh.tsx:117），本文件不点刷新，它必须为 null；
// Sys3State 枚举正常|降级|不可达|待核实（systemHealth.ts:27）；真 0 保留「0 ms」文本，只有缺值才变「—」。
// 跨模块挂载披露：文件在 modules/health，被测 ./HealthPage 与 @/shell/console（ConsoleModulePage），二者只挂载/
// 只读，从未编辑。本文件不新增任何产品 testid；probe- 与 probe-location 是私有证人节点。
// 本文件永不冻结计时器：「已复制」的复位是真 window.setTimeout，播报在点击后立刻读；零成本读基准只在 settle 之后取。
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: string }) => <span {...props}>{children}</span>,
  Button: ({ children, outlined, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => { void outlined; return <button {...props}>{children}</button>; },
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { ConsoleModulePage } from "@/shell/console";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix, useSourceMatrix } from "./sourceReads";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const HEALTH_PATHS = ["/agent-api/api/health", "/agent-api/api/__health-probe__", "/agent-api/api/hermes-summary", "/agent-api/api/skills"];
// GEN1：与 R248 供体逐字同一代 fixture（两行都 正常；降级/不可达的逐字句已由 R92 钉过，本文件不重造）。
const GEN1 = {
  health: { ok: true, asOf: "2026-11-19T15:17:09Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 }]},
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
const PAYLOAD_BY_PATH: Record<string, unknown> = {
  "/agent-api/api/health": GEN1.health,
  "/agent-api/api/__health-probe__": GEN1.console,
  "/agent-api/api/hermes-summary": GEN1.runtime,
  "/agent-api/api/skills": GEN1.domain,
};
// 健康表第一行的复制文本（rowCopy.ts:19 四段单点拼出）。
const ROW_ZERO = "控制台服务 · 12 ms · 2026-11-19 23:17 · 正常";
const arm = (): void => {
  api.fetchJSON.mockImplementation(async (url: unknown) => PAYLOAD_BY_PATH[String(url ?? "undefined")] ?? {});
};
// 账本口径与供体一致：卸载期的无参调用不算；越界路径由 Set 断言当场点名。
const totalReads = (): number => api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).length;
const ledger = (): string[] => api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).map((call) => String(call[0]));
const paramOf = (url: string, key: string): string | null => new URL(url, "http://console.test").searchParams.get(key);
// 只订阅矩阵存储的常驻证人（挂在壳外，跨导航存活）。
function StoreProbe() {
  const snap = useSourceMatrix();
  return <ol>{snap.rows.map((row) => (
    <li key={row.id} data-testid={`probe-${row.id}`}>{`${row.status}|${row.asOf ?? "—"}|${row.requestId ?? ""}`}</li>
  ))}</ol>;
}
// 注意：[data-testid^='probe-'] 会把 probe-location 一起扫进来，按名字排除它。
function probeFaces(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>("[data-testid^='probe-']")]) {
    const id = node.getAttribute("data-testid")!;
    if (id !== "probe-location") out[id] = node.textContent?.trim() ?? "";
  }
  return out;
}
function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="probe-location">{`${loc.pathname}${loc.search}`}</span>;
}
// 就地导航用 useEffect 里捕获的 navigate（渲染期给模块变量赋值会被 react-hooks/globals 打回）。
const nav: { go: ((to: string) => void) | null } = { go: null };
function NavigateCapture() {
  const navigate = useNavigate();
  useEffect(() => {
    nav.go = navigate;
    return () => { nav.go = null; };
  }, [navigate]);
  return null;
}
const address = (): string => textOf("probe-location");
function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}
const textOf = (testid: string): string => q(testid)?.textContent?.trim() ?? "";
// 本项目没有 jest-dom，chai 没有 startsWith；按长度截前缀再比。
const headOf = (text: string, lead: string): string => text.slice(0, lead.length);
// q() 只吃精确 testid；前缀/属性选择器走这里。
const countAll = (selector: string): number => container.querySelectorAll(selector).length;
function serviceRows(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>("[data-testid^='sys3-row-']")]) {
    out[node.getAttribute("data-testid")!.replace("sys3-row-", "")] = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  return out;
}
const copyIndexes = (): number[] => [...container.querySelectorAll<HTMLButtonElement>("button[data-testid^='sys-row-copy-']")]
  .map((node) => Number(node.getAttribute("data-testid")!.replace("sys-row-copy-", "")));
// 屏上格子的文本要按行取：sys3-name/sys3-checked/sys3-state 在每行重复。
function rowCellText(key: string, cellTestid: string): string {
  const cell = q(`sys3-row-${key}`)?.querySelector<HTMLElement>(`[data-testid='${cellTestid}']`);
  return cell?.textContent?.trim() ?? "";
}
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  // 迭代封顶而非墙钟截止：本文件不冻结 Date，写法与既有 harness 保持一致。
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  }
  throw new Error(`waitFor: ${label} never became true`);
}
async function copyViaButton(node: HTMLButtonElement | null, label: string): Promise<string> {
  if (!node) throw new Error(`missing copy button: ${label}`);
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    node.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, `copy landed: ${label}`);
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}
async function copyHealthRow(index: number): Promise<string> {
  return copyViaButton(q<HTMLButtonElement>(`sys-row-copy-${index}`), `health row ${index}`);
}
async function mount(entry: string): Promise<void> {
  arm();
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <StoreProbe />
        <NavigateCapture />
        {/* live 槽只给 health 真页；其余三槽裸 div——没有 testid、没有请求，账本只有 health 四条。 */}
        <ConsoleModulePage module="system" live={{ health: <HealthPage />, defaults: <div />, version: <div />, events: <div /> }} />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}
async function settleHealthReady(): Promise<void> {
  await waitFor(() => !!q("sys3-table"), "health surface ready");
  await waitFor(() => Object.values(probeFaces()).every((face) => headOf(face, "ok|") === "ok|"), "matrix store settled");
}
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetSourceMatrix();
  api.fetchJSON.mockReset();
  window.history.replaceState({}, "", "/system");
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});
describe("R250 — health 在场时就地换窗与深链带窗直进：逐行复制三值惰性", () => {
  it("① 就地换窗 ?window=7d → ?window=30d：逐行复制三值一字不动、字面零额外请求（钉惰性；「行集换代」与产品相反）", async () => {
    await mount("/system?window=7d");
    await settleHealthReady();
    const rows0 = serviceRows();
    const keys0 = Object.keys(rows0);
    const indexes0 = copyIndexes();
    expect(indexes0.length, "复制按钮数 == 渲染行数").toBe(keys0.length);
    expect(indexes0, "按钮下标 0..n-1 连续无洞").toEqual(keys0.map((_, i) => i));
    // 硬坑：零成本基准只能在 settle（会花请求的动作）之后取。
    const base = totalReads();
    expect(base, "settle 后账本恰是 health 四条").toBe(4);
    const sentences: string[] = [];
    for (let i = 0; i < indexes0.length; i += 1) {
      const text = await copyHealthRow(i);
      const seg = text.split(" · ");
      expect(seg.length, "rowCopy.ts:19 拼出的句子恰是四段").toBe(4);
      const key = keys0[i];
      expect(seg[0], `行 ${i}：段 1 == 该行屏上的名字格`).toBe(rowCellText(key, "sys3-name"));
      expect(seg[2], `行 ${i}：段 3 == 该行屏上的数据时刻面`).toBe(rowCellText(key, "sys3-checked"));
      expect(seg[3], `行 ${i}：段 4 == 该行屏上的状态格`).toBe(rowCellText(key, "sys3-state"));
      sentences.push(text);
    }
    expect(totalReads(), "逐行复制分文不花").toBe(base);
    expect(q("sys-updated-at"), "不点刷新就没有 sys-updated-at（systemRefresh.tsx:117）").toBeNull();
    expect(sentences.some((s) => s.includes("刷新完成于")), "读取时刻不进复制句（R112 口径，已由 R92 钉死）").toBe(false);
    expect(sentences.some((s) => s.includes("7d")), "地址令牌不许漏进复制句").toBe(false);
    const faces0 = probeFaces();
    await act(async () => { nav.go?.("/system?window=30d"); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(totalReads(), "就地换窗字面零额外请求：health 产品码不读 URL（两组 grep 各 0 命中），「行集换代」前提与产品相反，本例钉的是惰性").toBe(base);
    expect(address().includes("window=30d"), "地址确实换了窗").toBe(true);
    const rows1 = serviceRows();
    expect(Object.keys(rows1), "行集逐字相同、不重编号（惰性；换代前提与产品相反）").toEqual(keys0);
    expect(rows1, "整行文本一字未动").toEqual(rows0);
    const indexes1 = copyIndexes();
    expect(indexes1, "按钮下标与换窗前相同").toEqual(indexes0);
    expect(q(`sys-row-copy-${keys0.length}`), "不得出现越界下标（n==2 时不得有 sys-row-copy-2）").toBeNull();
    for (let i = 0; i < indexes1.length; i += 1) {
      expect(await copyHealthRow(i), `换窗后再复制第 ${i} 行：句与旧句逐字相等（惰性，非换代）`).toBe(sentences[i]);
    }
    expect(textOf("sys-row-copy-status"), "播报读于点击后：「已复制」的复位是真 2500 ms setTimeout，本文件不冻结计时器").toBe("已复制");
    expect(probeFaces(), "矩阵存储面一字未动").toEqual(faces0);
    expect([...new Set(ledger())].sort(), "账本只有 health 四条路径").toEqual([...HEALTH_PATHS].sort());
    for (const read of ledger()) {
      expect(paramOf(read, "window"), `health 线路 ${read} 不带 window 参数`).toBeNull();
      expect(paramOf(read, "from"), "不带 from").toBeNull();
      expect(paramOf(read, "to"), "不带 to").toBeNull();
    }
    expect(countAll("[data-testid^='sys-evt']"), "第 37 车道口径：sys-evt-* 族在产品里不存在（现查跟踪树 79 行命中 / 20 个 health 测试文件 / health 产品码 0 命中），只能在 DOM 上断言缺席，绝不编造").toBe(0);
  });
  it("② 深链 ?window=30d 直接进：R92 的三值与四段形状在带窗地址下重新成立一遍（定性是复现，不是新事实）", async () => {
    await mount("/system?window=30d");
    await settleHealthReady();
    const keys = Object.keys(serviceRows());
    expect(keys, "GEN1 原样两行（不造降级/不可达——那些逐字句已由 R92 钉过）").toEqual(["svc-a", "svc-b"]);
    const indexes = copyIndexes();
    expect(indexes.length, "按钮数 == sys3-row- 数 == 渲染行数").toBe(countAll("[data-testid^='sys3-row-']"));
    expect(indexes.length, "按钮数 == 行数").toBe(keys.length);
    const base = totalReads();
    const first = await copyHealthRow(0);
    expect(first, "R92 的逐字句在带窗地址下原样成立").toBe(ROW_ZERO);
    const segs = [first, await copyHealthRow(1)].map((s) => s.split(" · "));
    for (let i = 0; i < segs.length; i += 1) {
      expect(segs[i].length, "句子恰是四段").toBe(4);
      expect(segs[i][0], `行 ${i}：段 1 == 该行屏上的名字格`).toBe(rowCellText(keys[i], "sys3-name"));
      expect(segs[i][2], `行 ${i}：段 3 == 该行屏上的数据时刻面`).toBe(rowCellText(keys[i], "sys3-checked"));
      expect(segs[i][3], `行 ${i}：段 4 == 该行屏上的状态格`).toBe(rowCellText(keys[i], "sys3-state"));
    }
    expect(q("sys-updated-at"), "深链不点刷新：sys-updated-at 缺席").toBeNull();
    expect(segs.flat().some((s) => s.includes("30d")), "地址令牌不进复制句").toBe(false);
    expect(segs.flat().some((s) => s.includes("刷新完成于")), "读取时刻不进复制句").toBe(false);
    expect(totalReads(), "复制全程分文不花（基准取于 settle 之后）").toBe(base);
    expect(countAll("[data-testid^='sys-evt']"), "sys-evt-* 族缺席（37 车道口径）").toBe(0);
  });
});
