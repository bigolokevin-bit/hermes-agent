// @vitest-environment jsdom
// R254 — /system 两面导出文件在同一会话对撞，矩阵表级复制文本与事件字段的词汇互斥（纯测试，零产品码改动）
// 净新增两条：
// A（①+③）：两面各自 arm 一次下载捕获（事件 aud01-export 与矩阵 sys7-export 的 CSV），跨一次 tab 切换先后取回再双向对撞。持有
//   captureDownload 的 8 个 health 文件（system.empty / system.event.copy.export.cross / system.event.copy.paging / system.event.empty /
//   system.event.export.fulltext / system.event.export.paging / system.event.export / system.matrix.export）没有一个在同一会话里捕过两面的
//   文件；上游 audit/audit.export.sort.stability.test.tsx:278 的「two files」是同一面两次排序，不是两面。
// B（②另一半）：从来没人把矩阵表级复制文本（sys10-copy 管道形 / sys-matrix-copy 制表符形）与事件字段对撞过——R241 做的是文件 vs 逐行复制句。
// 已覆盖只回证据、不重写（引用位）：② 的一半 R241 system.event.copy.export.cross.test.tsx:279（文件 vs 逐行复制句双向不沾、sys-updated-at
//   只在 health 面）；R237 system.copy.crosstab.test.tsx:404（两族复制各写自己的串、跨 tab 往返逐字不变）；system.matrix.copy.test.tsx
//   :195/:226/:267/:302/:329/:358（矩阵复制自身形制、失败行只给状态词、刷新时刻不进复制句、空搜索拒绝）。
// ③ 的空站门已逐字钉：matrix.export.test.tsx:353；事件侧 R123 system.event.empty.test.tsx:346/:437、R221 system.event.export.test.tsx:365、
//   R241:394/:395（两枚门各自 title）。③ 的往返算术已钉：R241:323-:364、system.window.isolation.test.tsx:212/:239/:278——本文件只按同口径复核账目。
// 现场裁决（写进断言）：
// ·「matrix 站」是 employees 的 tabId（shell/routes.ts:149/:304、App.tsx:1214），/system tab 条没有这一枚 ⇒ tabButton("matrix") 为 null；矩阵就在
//   health 面里；sys-row-copy-<i> 长在 sys3-table（SystemHealthSurface.tsx:535/:569/:572-573），读源矩阵只有表级 sys10-copy / sys-matrix-copy / sys7-export，没有逐行复制。
// ·「切 tab 往返零额外请求」与产品相反：离开方向对对面零流量，回程要花自己那一整批（health 与 audit 都没有模块缓存，与 capabilities 的
//   cachedSkillsState / cachedTools 相反）；只有「两次导出点击本身花零」是字面真的，按刚重取的基准钉。
// · sys-evt-* 族缺席（第 39 道：实测 86 命中 / 22 个文件全是 health 测试文件 / health 产品码 0）：点名的 sys-evt-count、sys-evt-copy-<i> 无对应物，
//   只在 DOM 上断言缺席、绝不编造；诚实计数面按产品重述——事件侧 aud01-status + aud5-export-count + paintedRows，矩阵侧 sys7-export-count + 矩阵行 + 复制句行数。
// · 互斥指「列词汇与行身份不跨界」，不是「没有一个字节相同」：北京分钟形时间戳（2026-11-19 23:17）合法地同时出现在矩阵复制句的「采集时刻」
//   列与 health 逐行复制句第 3 段（同一代 asOf），禁止拿时间戳当判别标记；判别只用两组列头词与矩阵行名 / evt_ / req-。两面占互斥 live 槽
//   （App.tsx:1625 vs :1628），事件面在屏时 sys3-table、矩阵、sys7-export 一个都不存在 ⇒ 两份文件必须跨切换依次捕。
// 本文件不新增任何产品 testid。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
import { SYS10_HEADER, SYS7_HEADER } from "./sourceMatrixCsv";
import { resetSourceMatrix } from "./sourceReads";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let clipWrite = vi.fn();
let activeRestore: (() => void) | null = null;

const HEALTH_URL = "/agent-api/api/health";
const HEALTH_PATHS = [HEALTH_URL, "/agent-api/api/__health-probe__", "/agent-api/api/hermes-summary", "/agent-api/api/skills"];
/** 判别标记只用词汇与身份（行名/列词/evt_/req-），不用时间戳——裁决见头部。 */
const MATRIX_NAMES = ["系统健康清单", "控制台服务探针", "Hermes 运行时探针", "域服务探针"];
const EVENTS_HEADER = ["时间", "类型", "结果", "操作者", "对象", "请求编号"];
const MINUTE_STAMP = "2026-11-19 23:17";
/** 每条读口的采集时刻都不同，矩阵一代读数才能整代成形。 */
const GEN1 = {
  health: { ok: true, asOf: "2026-11-19T15:17:09Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 }] },
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
/** health 第一行的逐行复制句（rowCopy.ts 单点；延迟由 payload 派生，可逐字钉）。 */
const ROW_ZERO = `控制台服务 · 12 ms · ${MINUTE_STAMP} · 正常`;
const EV_A = "evt_head0000001", EV_B = "evt_head0000002", EV_C = "evt_head0000003";
/** 短横线形 rid：屏上形 == title == 剪贴板 == 文件格，不被 32-hex 短码折叠规则改写。 */
const RID_DASH = "req-header-0001";
const RID_HEX = "f0e1d2c3b4a5968778695a4b3c2d1e0f";
const rowOf = (eventId: string, action: string, outcome: string, at: string, requestId: string | null): Record<string, unknown> => ({
  eventId, action, occurredAt: at, outcome, actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" }, ...(requestId ? { requestId } : {}),
});
const PAGE = { items: [
  rowOf(EV_A, "task.created", "succeeded", "2026-11-20T05:30:00Z", RID_DASH),
  rowOf(EV_B, "approval.rejected", "failed", "2026-11-19T05:00:00Z", RID_HEX),
  rowOf(EV_C, "run.succeeded", "succeeded", "2026-11-18T04:00:00Z", null),
], nextCursor: null };

type SourceKey = "health" | "console" | "runtime" | "domain";
const keyOf = (url: string): SourceKey => url === HEALTH_URL ? "health" : url.includes("__health-probe__") ? "console" : url.includes("hermes-summary") ? "runtime" : "domain";
const answer = (url: string): unknown => url.startsWith("/agent-api/api/audit") ? (url.includes("audit-detail") ? { audit: {} } : PAGE) : GEN1[keyOf(url)];
const arm = (): void => void api.fetchJSON.mockImplementation(async (url: unknown) => answer(String(url ?? "undefined")));
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
/** 请求账的口径：所有带 url 的调用都算（拆卸时的无参调用不算）。 */
const totalReads = (): number => api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).length;
const healthReads = (): number => urls().filter((url) => HEALTH_PATHS.includes(url)).length;
const auditReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;

const q = <T extends HTMLElement = HTMLElement>(testid: string): T | null => container.querySelector<T>(`[data-testid='${testid}']`);
const countAll = (selector: string): number => container.querySelectorAll(selector).length;
const textOf = (testid: string): string => q(testid)?.textContent?.trim() ?? "";
const rowIds = (): string[] => [...container.querySelectorAll("[data-testid^='sys6-row-']")].map((el) => (el.getAttribute("data-testid") ?? "").slice("sys6-row-".length));
const paintedRows = (): string[] => [...container.querySelectorAll("[data-testid^='aud01-row-']")].map((node) => node.getAttribute("data-testid")!.replace("aud01-row-", ""));
/** 读数句里第一个「N 条」；错误句（无数字）如实返回 -1。 */
const shownOf = (testid: string): number => Number(/(\d+)\s*条/.exec(textOf(testid))?.[1] ?? -1);

/** 迭代封顶而非墙钟截止：本域有冻结 Date 的同族写法，墙钟截止永不触发会空转到被判死。 */
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 600 && !cond(); i += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  if (!cond()) throw new Error(`waitFor: ${label} never became true`);
}
async function click(node: Element | null, label: string): Promise<void> {
  if (!node) throw new Error(`missing clickable node: ${label}`);
  await act(async () => { (node as HTMLElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
}
const clickTestId = (testid: string, label: string): Promise<void> => click(q(testid), `${label} (${testid})`);
const tabButton = (tabId: string): HTMLButtonElement | HTMLAnchorElement | null =>
  container.querySelector<HTMLButtonElement | HTMLAnchorElement>(`[role="tab"][data-tab="${tabId}"]`);

/** 下载捕获句柄：Blob 子类记内容，anchor 间谍挡真跳转并记 download 名。第二次 arm 前必须先 restore——
 * anchor 间谍会吞掉 NavLink 的 tab 点击（R241:404-405 记过的坑），所以每面一个独立句柄。 */
type Download = { content: () => string; fileName: () => string; blobCalls: () => number; urlCalls: () => number; restore: () => void };
function captureDownload(): Download {
  let recorded = "", name = "", blobs = 0;
  const OriginalBlob = window.Blob;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  class RecordingBlob extends OriginalBlob { constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); recorded = String(parts[0] ?? ""); blobs += 1; } }
  const urlStub = vi.fn(() => "blob://captured");
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
  Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: RecordingBlob });
  URL.createObjectURL = urlStub as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  const restore = (): void => {
    if (activeRestore === restore) activeRestore = null;
    clickSpy.mockRestore();
    Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: OriginalBlob });
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  };
  activeRestore = restore;
  return { content: () => recorded, fileName: () => name, blobCalls: () => blobs, urlCalls: () => urlStub.mock.calls.length, restore };
}
/** BOM 用转义写，本文件不许出现字面 U+FEFF；按 \r\n 切记录、按逗号切列。 */
const csvRecords = (text: string): string[][] => text.replace(/^\uFEFF/, "").trimEnd().split("\r\n").map((line) => line.split(","));
/** 矩阵复制句：行间 \n、列间按形态给 " | " 或制表符（sourceMatrixCsv.ts:50 / :65）。 */
const gridLines = (text: string, sep: string): string[][] => text.trimEnd().split("\n").map((line) => line.split(sep));

/** 矩阵两种复制走裸 navigator.clipboard.writeText，与事件 CopyValue 的被 mock 助手是两套证人。 */
function armNavigatorClipboard(): void {
  clipWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipWrite } });
}
async function copyMatrix(testid: string): Promise<string> {
  clipWrite.mockClear();
  await click(q(testid), `the ${testid} button`);
  await waitFor(() => clipWrite.mock.calls.length > 0, `${testid} wrote to navigator.clipboard`);
  return String(clipWrite.mock.lastCall?.[0] ?? "");
}
async function copyVia(node: HTMLElement | null | undefined, label: string): Promise<string> {
  if (!node) throw new Error(`missing copy affordance: ${label}`);
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => { node.click(); await Promise.resolve(); });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, `copy landed: ${label}`);
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}
const copyHealthRow = (index: number): Promise<string> => copyVia(q(`sys-row-copy-${index}`), `health row ${index}`);
/** 事件面唯一的逐行复制控件：只交请求编号那一列。 */
const copyEventRid = (key: string): Promise<string> =>
  copyVia(q(`aud01-cell-${key}-request-value`)?.querySelector("button[aria-label='复制请求编号']"), `audit row ${key}`);

async function mount(entry: string): Promise<void> {
  arm();
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>
      <ConsoleModulePage module="system" live={{ health: <HealthPage />, events: <AuditEventsModulePage />, defaults: <div />, version: <div /> }} />
    </MemoryRouter>);
  });
  await act(async () => {});
}
/** 健康面就绪 = 服务表在屏 + 矩阵存储里整代读数成形（四读全成功）。 */
async function settleHealth(): Promise<void> {
  await waitFor(() => !!q("sys3-table"), "health surface ready");
  await waitFor(() => /成功 4/.test(textOf("sys6-summary")), "matrix store holds one settled generation");
}
const settleEvents = (): Promise<void> => waitFor(() => paintedRows().length > 0, "audit list painted");
/** 读源矩阵默认折叠，需点 sys6-toggle；展开不花请求（存储是模块级）。 */
async function expandMatrix(): Promise<void> {
  await click(q("sys6-toggle"), "the matrix toggle");
  await waitFor(() => rowIds().length === 4, "matrix expanded to four rows");
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  clipboard.copyTextToClipboard.mockReset().mockResolvedValue(true);
  armNavigatorClipboard();
  resetSourceMatrix();
  api.fetchJSON.mockReset();
  window.history.replaceState({}, "", "/system?tab=health");
});

afterEach(() => {
  activeRestore?.();
  activeRestore = null;
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R254 — 两面导出文件的同会话对撞与矩阵复制句的词汇互斥", () => {
  it("① 跨 tab 捕两面导出文件再对撞：列词汇与行身份不跨界，两次导出点击都花零请求", async () => {
    await mount("/system?tab=health");
    await settleHealth();
    await click(tabButton("events"), "the events tab");
    await settleEvents();
    const rows = paintedRows();
    expect(rows, "事件表体三行按服务端回的序上屏").toEqual([EV_A, EV_B, EV_C]);
    const dlEvents = captureDownload();
    // 零成本断言的基准必须在「这次导航自己花的读」落定之后重取（R230 记过的坑）。
    const baseEvents = totalReads();
    await clickTestId("aud01-export", "事件面的 CSV 门");
    await waitFor(() => dlEvents.content() !== "", "events file delivered");
    const eventsFile = dlEvents.content();
    const eventsName = dlEvents.fileName();
    // anchor 间谍会吞 NavLink 的 tab 点击，导航之前先撤这一面的桩（R241:404-405 的坑）。
    dlEvents.restore();
    const eventsRecords = csvRecords(eventsFile);
    expect(eventsRecords[0], "事件文件表头逐字等于六个中文列词（audit/csv.ts:12）").toEqual(EVENTS_HEADER);
    const eventsData = eventsRecords.slice(1);
    expect(eventsData.length, "文件数据行 == 屏上表体行数").toBe(rows.length);
    expect(shownOf("aud01-status"), "aud01-status 的 N == 表体行数（:1363 形「已显示 N 条审计事件（…）」）").toBe(rows.length);
    expect(shownOf("aud5-export-count"), "aud5-export-count 的 N == 表体行数（:1620 无条件「将导出 N 条」）").toBe(rows.length);
    expect(dlEvents.blobCalls(), "一次点击恰好一个 Blob").toBe(1);
    expect(dlEvents.urlCalls(), "一次点击恰好一个对象 URL").toBe(1);
    expect(eventsName, "文件名 audit-<窗口标签>-YYYYMMDD-HHmm.csv（csv.ts:50-57）").toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    expect(totalReads(), "导出只消费屏上已加载的行，这次点击花零请求（基准刚重取）").toBe(baseEvents);

    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "back on the health pane");
    await settleHealth();
    await expandMatrix();
    // 裁决登记：「切 tab 往返零额外请求」与产品相反——回程花整整一批四读（无模块缓存）；
    // 算术本身归 R241:323-:364 与 system.window.isolation.test.tsx:212/:239/:278，这里只复核账目。
    expect(healthReads(), "回程花的是 health 自己那一整批：首载 4 + 回程 4，不是零").toBe(8);
    expect(auditReads(), "离开方向对事件面零流量，只有进去那一次的一笔读").toBe(1);
    const dlMatrix = captureDownload();
    const baseMatrix = totalReads();
    const door = q<HTMLButtonElement>("sys7-export");
    expect(door!.disabled, "四行全成功时矩阵导出门是开的").toBe(false);
    expect(door!.getAttribute("title"), "启用态 title 逐字（SourceMatrix.tsx:178）").toBe("导出当前矩阵；不会再发请求");
    await clickTestId("sys7-export", "矩阵面的 CSV 门");
    await waitFor(() => dlMatrix.content() !== "", "matrix file delivered");
    const matrixFile = dlMatrix.content();
    expect(csvRecords(matrixFile)[0].join(","), "矩阵文件表头逐字 == SYS7_HEADER 五个英文 token（sourceMatrixCsv.ts:3；中文五列是两种复制形态的 :45）").toBe(SYS7_HEADER.join(","));
    const matrixData = csvRecords(matrixFile).slice(1);
    expect(matrixData.length, "文件数据行 == 屏上矩阵行数").toBe(rowIds().length);
    expect(rowIds().length, "矩阵四行都在表体里").toBe(4);
    expect(textOf("sys7-export-count"), "计数位「N 行」== 文件数据行（SourceMatrix.tsx:209）").toBe(`${matrixData.length} 行`);
    expect(dlMatrix.blobCalls(), "这一次点击同样恰好一个 Blob").toBe(1);
    expect(dlMatrix.urlCalls(), "这一次点击同样恰好一个对象 URL").toBe(1);
    expect(dlMatrix.fileName(), "矩阵文件名 system-sources-YYYYMMDD-HHmm.csv（sourceMatrixCsv.ts:89）").toMatch(/^system-sources-\d{8}-\d{4}\.csv$/);
    expect(totalReads(), "矩阵导出点击也花零（基准在 expandMatrix 之后重取）").toBe(baseMatrix);

    // 对撞·正向：事件文件的表头行不含矩阵五个列词（只比表头行，避免数据格英文 token 偶然命中）。
    const eventsHead = eventsRecords[0].join(",");
    for (const token of SYS7_HEADER) expect(eventsHead.includes(token), `事件文件表头行不含矩阵列词「${token}」`).toBe(false);
    for (const marker of MATRIX_NAMES) expect(eventsFile.includes(marker), `事件文件不含矩阵行名「${marker}」`).toBe(false);
    // 事件自己走 /agent-api/api/audit?，四个矩阵读口路径一个都不许出现。
    for (const path of HEALTH_PATHS) expect(eventsFile.includes(path), `事件文件不含矩阵读口路径「${path}」`).toBe(false);
    // 对撞·反向：矩阵文件不含六个事件列词、不含任何事件 id、不含任何请求编号前缀。
    for (const word of EVENTS_HEADER) expect(matrixFile.includes(word), `矩阵文件不含事件列词「${word}」`).toBe(false);
    for (const id of [EV_A, EV_B, EV_C]) expect(matrixFile.includes(id), "矩阵文件不含任何事件 id").toBe(false);
    expect(matrixFile.includes("evt_"), "矩阵文件不含任何 evt_ 前缀").toBe(false);
    expect(matrixFile.includes("req-"), "矩阵文件不含任何 req- 请求编号").toBe(false);
    expect(countAll("[data-testid^='sys-evt']"), "sys-evt-* 族不存在（第 39 道：86 命中 / 22 个 health 测试文件 / health 产品码 0），只在 DOM 上断言缺席").toBe(0);
    expect(tabButton("matrix"), "「matrix 站」是 employees 的 tabId（routes.ts:149/:304、App.tsx:1214），/system 上没有这一枚").toBeNull();
    dlMatrix.restore();
  });

  it("② 矩阵表级复制句与事件字段双向词汇互斥：共有的分钟形时刻合法，判别只用列词与行身份", async () => {
    await mount("/system?tab=health");
    await settleHealth();
    await expandMatrix();
    const ids = rowIds();
    expect(ids.length, "矩阵四行在屏").toBe(4);
    const base = totalReads();
    const pipe = await copyMatrix("sys10-copy");
    const tabText = await copyMatrix("sys-matrix-copy");
    const gridPipe = gridLines(pipe, " | ");
    const gridTab = gridLines(tabText, "\t");
    expect(gridPipe[0], "管道句表头逐字 SYS10_HEADER 五个中文词、列间「 | 」（sourceMatrixCsv.ts:45/:50）").toEqual([...SYS10_HEADER]);
    expect(gridTab[0], "表格句同一套词、列间制表符（:65）").toEqual([...SYS10_HEADER]);
    expect(gridPipe.length, "管道句行数 == 矩阵行数 + 表头").toBe(ids.length + 1);
    expect(gridTab.length, "表格句行数 == 矩阵行数 + 表头").toBe(ids.length + 1);
    for (const word of EVENTS_HEADER) { expect(pipe.includes(word), `管道句不含事件列词「${word}」`).toBe(false); expect(tabText.includes(word), `表格句不含事件列词「${word}」`).toBe(false); }
    for (const text of [pipe, tabText]) {
      expect(text.includes("evt_"), "矩阵复制句不含任何事件 id 前缀").toBe(false);
      expect(text.includes("req-"), "矩阵复制句不含任何请求编号（失败行 rid 只进屏上 title，口径逐字归 system.matrix.copy.test.tsx:226）").toBe(false);
    }
    // 裁决的正向钉桩：同一代 asOf 的北京分钟形时间戳合法地同时出现在 health 逐行复制句第 3 段与矩阵
    // 复制句的「采集时刻」列——互斥只在列词汇与行身份层面成立，不做「无共享字节」的假断言。
    const healthCopy = await copyHealthRow(0);
    expect(healthCopy, "逐行复制句四段位由 rowCopy.ts 单点拼出").toBe(ROW_ZERO);
    expect(healthCopy.includes(MINUTE_STAMP), "正向：分钟形数据时刻在逐行复制句里合法出现").toBe(true);
    expect(pipe.includes(MINUTE_STAMP), `正向：同一代 asOf 也在矩阵管道句「${SYS10_HEADER[4]}」列里——两族共有而仍不含任何事件词`).toBe(true);
    expect(totalReads(), "两次表级复制加一次逐行复制都花零请求（基准在 expandMatrix 之后重取）").toBe(base);

    await click(tabButton("events"), "the events tab");
    await settleEvents();
    expect(paintedRows(), "三行上屏，dash 形 rid 那行在首位").toEqual([EV_A, EV_B, EV_C]);
    const ridCopy = await copyEventRid(EV_A);
    expect(ridCopy, "事件面唯一的逐行复制控件只交那一行自己的请求编号，逐字 toBe（短横线形不被折叠：屏上==title==剪贴板==文件格）").toBe(RID_DASH);
    for (const word of SYS10_HEADER) expect(ridCopy.includes(word), `rid 复制句不含矩阵中文列词「${word}」`).toBe(false);
    for (const token of SYS7_HEADER) expect(ridCopy.includes(token), `rid 复制句不含矩阵英文列 token「${token}」`).toBe(false);
    for (const name of MATRIX_NAMES) expect(ridCopy.includes(name), `rid 复制句不含矩阵行名「${name}」`).toBe(false);
    expect(q("sys3-table"), "事件面在屏时 health pane 被壳卸掉（App.tsx:1625 vs :1628 互斥 live 槽）").toBeNull();
    expect(countAll("[data-testid^='sys-evt']"), "事件面同样没有任何 sys-evt 族节点（第 39 道）").toBe(0);
  });
});
