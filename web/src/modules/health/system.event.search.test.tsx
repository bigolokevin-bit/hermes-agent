// @vitest-environment jsdom
// R251 — /system 服务搜索 ?q= 与 sys3 逐行复制族的对撞（纯测试，产品码零改动）：
// ① 深链带 q 直进、表体只剩一行时，复制钮从 0 连续重编号，那一句是幸存行自己的四段，被滤掉的行一个字都不进剪贴板，全程零请求；
// ② 打字收窄再清空回全量：序号 0..n-1 重建、每句与过滤前逐字相同、清空同样零请求；事件面是 ?q= 的惰性乘客——地址留着、线路上没有。
//
// 净新缺口（现查）：「序号从 0 重建」这一格只在**状态筛选**下钉过（R92 system.rowcopy.test.tsx:220/:230/:234），?q= 搜索下没人钉——
// SystemHealthSurface.test.tsx:472（过滤行列 + hash 保参 + 零重取）与 :492（空态句 + 限定作用域清空）从不碰 sys-row-copy-，
// system.matrix.copy.test.tsx:331 钉的是矩阵表级门。
// 已覆盖处只回证据、不重写：R92 :93（逐行 verbatim + 零额外请求）、:115/:125/:129（三句逐字）、:137（无数据时刻 → 第三段「—」）、
// :150/:154（复制数据时刻而非刷新时刻）、:195/:209（剪贴板拒绝时的只读兜底同文）；SystemHealthSurface.test.tsx:505（读口未接入时输入框 disabled）；
// system.matrix.copy.test.tsx:226（失败行只复制状态词）/:267（刷新时刻不进复制）；system.matrix.export.test.tsx:20/:266/:355；
// R250 system.matrix.window.copy.test.tsx:185/:235（逐行复制对 ?window= 的字面惰性）；R248 system.copy.cross.test.tsx:231/:278；
// R237 system.copy.crosstab.test.tsx:404；R241 system.event.copy.export.cross.test.tsx:246/:279/:323。
// 三条与派工口径相反的裁决（以产品为准，各写进对应 expect 的标签）：
// 1)「清空关键词回全量恰 1 次取数」相反：serviceSearch.ts:2 明写「filtering never issues a request」，readServiceQuery（:13）只是 get("q")，
//    writeServiceQuery（:16）原地改 window.location.hash ⇒ 收窄与清空都是字面零成本，本文件钉的是「零」而不是「一」。
// 2)「复制句含 rid」结构上不可能：rowCopy.ts:19 四段（表名 · 读数 · 数据时刻 · 状态人话）没有 rid 字段，:13 还明令不得把刷新时刻塞进来。
// 3) 点清空必须限定作用域：sys-search-clear 产品里有三处站点（SourceMatrix.tsx:239 在 sys-search-source-empty 内、SystemHealthSurface.tsx:383
//    搜索条内、:514 在 sys-search-empty 内）；本文件用祖先锚 sys-search-bar 选搜索条那颗，并当场证明选的是哪一颗。
// 38 车道口径：sys-evt-* 族在产品里不存在——现查跟踪树 82 行命中 / 21 个 health 测试文件 / health 产品码 0 命中，只能在 DOM 上断言缺席，绝不编造。
// 事件面对 ?q= 是惰性乘客：AuditEventsModulePage.tsx 里 get("q") 0 命中（全仓产品读者只有 approvals×3、employees、knowledge、skills、tools 与 serviceSearch.ts:13）。
// 跨模块挂载披露：文件在 modules/health，被测 ./HealthPage、@/modules/audit/AuditEventsModulePage 与 @/shell/console 只挂载/只读，从未编辑；
// 本文件不新增任何产品 testid，probe- 与 probe-location 是私有证人节点。永不冻结计时器：「已复制」的复位是真 2500 ms window.setTimeout，播报读于点击后。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
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
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { ConsoleModulePage } from "@/shell/console";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix, useSourceMatrix } from "./sourceReads";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const HEALTH_PATHS = ["/agent-api/api/health", "/agent-api/api/__health-probe__", "/agent-api/api/hermes-summary", "/agent-api/api/skills"];
// 三行服务：q=域 只命中第三行（名字含「域」）；前两行的名字、键、口径路径都不含它（matchesServiceSearch 三样都试）。
const NEEDLE = "域";
const SURVIVOR = "svc-c";
const FILTERED_OUT = ["控制台服务", "知识服务", "svc-a", "svc-b"];
const GEN1 = {
  health: { ok: true, asOf: "2026-11-19T15:17:09Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "svc-b", name: "知识服务", status: "warning", version: "1.4.0", latencyMs: 0 },
    { id: "svc-c", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 }]},
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
// 事件面只要「那一问发出去了、行上屏了」就够：q=hermes 不进线路、sys-evt 族缺席，与行内容无关。
const AUDIT_PAGE = { items: [{ eventId: "evt_search00000001", action: "task.created", occurredAt: "2026-11-20T05:30:00Z", outcome: "succeeded", actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" }, resource: { type: "approval", id: "ap_1122334455667788" }, requestId: "req-search-0001" }], nextCursor: null };
type SourceKey = "health" | "console" | "runtime" | "domain";
// audit 分支在 answer 里提前 return：keyOf 不收 audit，否则 GEN1[key] 走 TS7053。
const keyOf = (url: string): SourceKey => url === HEALTH_PATHS[0] ? "health" : url.includes("__health-probe__") ? "console" : url.includes("hermes-summary") ? "runtime" : "domain";
function answer(url: string): unknown {
  if (url.startsWith("/agent-api/api/audit")) return url.includes("audit-detail") ? { audit: {} } : AUDIT_PAGE;
  return GEN1[keyOf(url)];
}
const arm = (): void => void api.fetchJSON.mockImplementation(async (url: unknown) => answer(String(url ?? "undefined")));
const totalReads = (): number => api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).length;
const auditListUrls = (): string[] => api.fetchJSON.mock.calls.filter((call) => /^\/agent-api\/api\/audit\?/.test(String(call[0]))).map((call) => String(call[0]));
const paramOf = (url: string, key: string): string | null => new URL(url, "http://console.test").searchParams.get(key);
const cursorsOf = (url: string): string[] => [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
// 只订阅矩阵存储的常驻证人（挂在壳外，跨重挂载存活）。
function StoreProbe() {
  const snap = useSourceMatrix();
  return <ol>{snap.rows.map((row) => <li key={row.id} data-testid={`probe-${row.id}`}>{`${row.status}|${row.asOf ?? "—"}|${row.requestId ?? ""}`}</li>)}</ol>;
}
// 硬坑：[data-testid^='probe-'] 会把 probe-location 一起扫进来，按名字排除它。
function probeFaces(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of all("li[data-testid^='probe-']")) out[node.getAttribute("data-testid")!] = node.textContent?.trim() ?? "";
  return out;
}
function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="probe-location">{`${loc.pathname}${loc.search}`}</span>;
}
function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}
const textOf = (testid: string): string => q(testid)?.textContent?.trim() ?? "";
// q() 只吃精确 testid；属性前缀选择器走这里（本项目没有 jest-dom，也没有 startsWith 断言）。
const all = (selector: string): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(selector)];
const countAll = (selector: string): number => all(selector).length;
const headOf = (text: string, lead: string): string => text.slice(0, lead.length);
const address = (): string => textOf("probe-location");
// 取键必须剥掉 sys3-row- 前缀（R250 就红在这里）。
const serviceKeys = (): string[] => all("[data-testid^='sys3-row-']").map((node) => node.getAttribute("data-testid")!.replace("sys3-row-", ""));
const copyButtons = (): string[] => all("button[data-testid^='sys-row-copy-']").map((node) => node.getAttribute("data-testid")!);
const copyIndexes = (): number[] => copyButtons().map((id) => Number(id.replace("sys-row-copy-", "")));
// 屏上格子文本按行取：sys3-name/sys3-checked/sys3-state 每行都重复。
const rowCellText = (key: string, cell: string): string => q(`sys3-row-${key}`)?.querySelector<HTMLElement>(`[data-testid='${cell}']`)?.textContent?.trim() ?? "";
function setInput(value: string): void {
  const input = container.querySelector<HTMLInputElement>("[data-testid='sys-search']")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
// 迭代封顶 600 × 5 ms，不用墙钟截止。
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 600 && !cond(); i += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  if (!cond()) throw new Error(`waitFor: ${label} never became true`);
}
async function copyText(node: HTMLButtonElement | null, label: string): Promise<string> {
  if (!node) throw new Error(`missing copy button: ${label}`);
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => { node.click(); await Promise.resolve(); });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, `copy landed: ${label}`);
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}
const copyRow = (index: number): Promise<string> => copyText(container.querySelector<HTMLButtonElement>(`[data-testid='sys-row-copy-${index}']`), `health row ${index}`);
async function mount(entry: string): Promise<void> {
  arm();
  // live 槽给 health 与 events 两面（互斥，只有当前 tab 那颗在场）；其余两槽裸 div：无 testid、无请求。
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <StoreProbe />
        <ConsoleModulePage module="system" live={{ health: <HealthPage />, events: <AuditEventsModulePage />, defaults: <div />, version: <div /> }} />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}
async function remount(entry: string, browserAddress: string): Promise<void> {
  await act(async () => { root.unmount(); });
  window.history.replaceState({}, "", browserAddress);
  root = createRoot(container);
  await mount(entry);
}
async function settleHealth(): Promise<void> {
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
describe("R251 — ?q= 服务搜索下的 sys3 逐行复制重编号，与事件面对 q 的惰性", () => {
  it("① ?q= 收窄表体时逐行复制跟着重编号：只有一个钮 sys-row-copy-0、那一句是幸存行自己的四段、被滤掉的行一个字都不进剪贴板、全程零额外请求", async () => {
    window.history.replaceState({}, "", "/#/system?tab=health&q=域");
    await mount("/system?tab=health&q=域");
    await settleHealth();
    expect(q<HTMLInputElement>("sys-search")?.value, "深链的 q 直接进搜索框（readServiceQuery 读 hash，serviceSearch.ts:13）").toBe(NEEDLE);
    expect(serviceKeys(), "表体只剩命中 NEEDLE 的那一行").toEqual([SURVIVOR]);
    expect(copyButtons(), "序号从 0 重建：只有一个钮，没有 -1/-2 残留（?q= 版本的门，此前只在状态筛选下钉过）").toEqual(["sys-row-copy-0"]);
    expect(q("sys-row-copy-1"), "不得有越界下标").toBeNull();
    const base = totalReads();
    expect(base, "基准只能在会花请求的步骤之后取：settle 后账本恰是 health 四条").toBe(4);
    const text = await copyRow(0);
    const seg = text.split(" · ");
    expect(seg.length, "rowCopy.ts:19 拼出的句子恰是四段").toBe(4);
    expect(seg[0], "段 1 == 幸存行屏上的名字格").toBe(rowCellText(SURVIVOR, "sys3-name"));
    expect(seg[1], "段 2 == 幸存行屏上的读数格（真 0 保留「0 ms」，只有缺值才「—」）").toBe(rowCellText(SURVIVOR, "sys3-latency"));
    expect(seg[2], "段 3 == 幸存行屏上的数据时刻格").toBe(rowCellText(SURVIVOR, "sys3-checked"));
    expect(seg[3], "段 4 == 幸存行屏上的状态格").toBe(rowCellText(SURVIVOR, "sys3-state"));
    for (const gone of FILTERED_OUT) expect(text.includes(gone), `被滤掉行的「${gone}」一个字都不进剪贴板`).toBe(false);
    expect(text.includes("刷新完成于"), "读取时刻不进复制句（rowCopy.ts:13 明令，R112 口径）").toBe(false);
    expect(q("sys-updated-at"), "没点刷新就没有 sys-updated-at，它的值更进不了句子（systemRefresh.tsx:117）").toBeNull();
    expect(textOf("sys-row-copy-status"), "播报读于点击后：复位是真 2500 ms setTimeout，本文件不冻结计时器").toBe("已复制");
    expect(q("sys-row-copy-fallback-text"), "剪贴板没被拒就没有兜底文本框").toBeNull();
    expect(totalReads(), "派工的「回全量恰 1 次取数」与产品相反：serviceSearch.ts:2 规定 filtering never issues a request，深链带 q 进来同样分文不花，钉的是字面零").toBe(base);
  });
  it("② 清空 ?q= 回全量：复制序号 0..n-1 重建且每句与过滤前逐字相同、清空也是零请求；事件面上 ?q= 只是乘客——地址留着、线路上没有、sys-evt 族缺席", async () => {
    window.history.replaceState({}, "", "/#/system");
    await mount("/system?tab=health");
    await settleHealth();
    const keys0 = serviceKeys();
    expect(keys0, "全量三行").toEqual(["svc-a", "svc-b", "svc-c"]);
    expect(copyIndexes(), "过滤前序号 0..n-1 连续").toEqual([0, 1, 2]);
    const base = totalReads();
    const before: string[] = [];
    for (let i = 0; i < keys0.length; i += 1) before.push(await copyRow(i));
    await act(async () => { setInput(NEEDLE); await Promise.resolve(); });
    await waitFor(() => serviceKeys().length === 1, "打字收窄到一行");
    expect(serviceKeys(), "打字收窄只留命中行").toEqual([SURVIVOR]);
    expect(copyIndexes(), "收窄时序号从 0 重建").toEqual([0]);
    expect(window.location.hash, "打字把 q 写进 hash（writeServiceQuery 原地改 window.location.hash）").toContain("q=");
    expect(await copyRow(0), "收窄期那一句与全量时第 3 行逐字相同").toBe(before[2]);
    expect(q("sys-search-empty"), "还剩一行，不落到搜索空态：sys-search-empty 里那颗清空（SystemHealthSurface.tsx:514）不在场").toBeNull();
    const clears = all("[data-testid='sys-search-clear']");
    expect(clears.length, "sys-search-clear 产品里有三处站点，此刻在场的只有搜索条这一颗（SourceMatrix.tsx:239 那颗要矩阵零命中才出现）").toBe(1);
    const barClear = q("sys-search-bar")?.querySelector("[data-testid='sys-search-clear']") ?? null;
    expect(barClear?.textContent?.trim(), "点的是搜索条内那颗（SystemHealthSurface.tsx:383），祖先锚证明").toBe("清空搜索");
    await act(async () => { (barClear as HTMLElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    await waitFor(() => serviceKeys().length === 3, "清空回全量");
    expect(q<HTMLInputElement>("sys-search")?.value, "清空把输入框归零").toBe("");
    expect(window.location.hash, "hash 里的 q= 被抹掉（writeServiceQuery(null) 走 params.delete）").not.toContain("q=");
    expect(serviceKeys(), "整组行集逐字复原").toEqual(keys0);
    expect(copyIndexes(), "序号 0..n-1 连续重建，无越界残留").toEqual([0, 1, 2]);
    for (let i = 0; i < keys0.length; i += 1) expect(await copyRow(i), `清空后第 ${i} 行与过滤前逐字相同`).toBe(before[i]);
    expect(textOf("sys-row-copy-status"), "清空后照样播报「已复制」").toBe("已复制");
    expect(q("sys-row-copy-fallback-text"), "全程剪贴板都接了，兜底从不出现").toBeNull();
    expect(totalReads(), "清空回全量同样是零请求：派工的「恰 1 次取数」与产品相反（serviceSearch.ts:2），钉字面零成本").toBe(base);
    // 后半：把地址换成 tab=events&q=hermes 重新直进，事件面证明 q 上得了地址、上不了线路。
    await remount("/system?tab=events&q=hermes", "/#/system?tab=events&q=hermes");
    await waitFor(() => auditListUrls().length > 0, "审计列表那一问落地");
    await waitFor(() => countAll("[data-testid^='aud01-row-']") > 0, "审计行上屏");
    expect(address(), "react-router 侧地址里 q=hermes 一字未改").toContain("q=hermes");
    expect(window.location.hash, "浏览器地址里 q=hermes 也一字未改：它是个乘客").toContain("q=hermes");
    const listUrls = auditListUrls();
    expect(listUrls.length, "那一问确实发出去了，否则下面的负断言是空的").toBeGreaterThan(0);
    for (const url of listUrls) {
      expect(paramOf(url, "q"), `审计线路 ${url} 不带 q —— AuditEventsModulePage 里 get("q") 0 命中，?q= 对事件面是惰性乘客`).toBeNull();
      expect(cursorsOf(url), "第一页不带游标").toEqual([]);
    }
    expect(countAll("[data-testid^='sys-evt']"), "38 车道口径：sys-evt-* 族在产品里不存在（现查跟踪树 82 行命中 / 21 个 health 测试文件 / health 产品码 0 命中），只能在 DOM 上断言缺席，绝不编造").toBe(0);
    expect(q("sys3-table"), "live 槽互斥：tab=events 时 health pane 不在场").toBeNull();
  });
});
