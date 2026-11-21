// @vitest-environment jsdom
/**
 * R241 — /system「健康复制家族 × 审计导出文件」对撞，加计数位跨 tab 往返与 500 同挂载（纯测试，零产品改动）
 *
 * 查重结论（第 33 条道，基线 14c36d5b 现查）：git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- src → 65 处命中 /
 * 17 个文件 / 非测试命中 0 / health 产品码 0。派工点名的 sys-evt-copy-<i> 与 sys-evt-count 没有产品对应物，本文件只在 DOM 上断言缺席、绝不
 * 编造；事件面唯一的逐行复制控件是 aud01-cell-<key>-request-value 里那颗 button[aria-label='复制请求编号']（states.tsx 的 CopyValue），
 * 它只交请求编号一列。
 *
 * 四条「与产品相反」的裁决（也写进各用例的 expect 标签）：
 * ① 「sys-evt-copy-<i> 文本与 CSV 同行（类型/结果/时间）逐字」相反：那族锚不存在，真控件只交一列。诚实重形成三条——复制句 == 文件第 6 列；
 *    该记录的 类型/结果/时间 三格 == 屏上同一行自己的话；复制句不含这三格的字。派工写的「读 -outcome 单元内层 dd」同样相反：-outcome 不存在
 *    （结果格是 aud01-cell-<key>-result，span 套 Badge），-type 是 button 套 span，只有 -time 是 Field 的 dt+dd；屏上秒形、文件分钟形
 *    （model.ts:25-46），只能 slice(0,16) 比。
 * ② 「切到 matrix tab」相反：matrix 是 employees 模块的 tabId（shell/routes.ts:149 与 :304、App.tsx:1214），在 /system 上不匹配、折回第一个
 *    pane 且不改写地址 ⇒ tabButton("matrix") 为 null 如实钉住，对撞改在 health 与 events 两面之间做。
 * ③ 「tab 往返零新增取数」相反：离开的方向零流量，回去要花整整自己的一批（health 与 audit 都没有模块缓存，与 capabilities 的
 *    cachedSkillsState / cachedTools 相反）；算术归 system.window.isolation.test.tsx:212 / :239 / :278，本文件只钉计数位不漂这一半。
 * ④ 「导出仍可用」对零行集合相反：500 之后 listedRows 为空，aud01-export 与 aud5-export 各自关死（auditGates.ts:102 与 :107 两句不同原因），
 *    aud5-export-count 诚实读「将导出 0 条」⇒ 按实测钉 disabled 与各自标题，不伪造一个可用的门。
 *
 * 已覆盖处只回证据、不重写：R235 system.event.copy.paging.test.tsx:289（第 i 句复制 == 文件第 i 条第 6 列 == 屏上那格，位置序、零成本）；
 * R221 system.event.export.test.tsx:315（CSV 与屏上逐格用词同源，含显示名与 8 位短码、无裸内部 id）；R124
 * system.event.export.fulltext.test.tsx:356 与 :400（复制也是全形）；R249 audit.export.paging.detail.test.tsx:324（三处一个数、全列按屏上序，
 * 但它从不碰时间列）；R240 自己的 system.event.export.paging.test.tsx（文件时间格对 from/to、物理行数、秒形与分钟形的折叠）；
 * system.matrix.copy.test.tsx:267（health 行复制句不沾刷新时刻）与 system.matrix.export.test.tsx:302（文件不含读取时刻）；
 * R237 system.copy.crosstab.test.tsx 例③（审计 500 期间 health 逐行复制照样可点且写自己那行、失败锚 rid 复制写全 id、恢复后各自同源）。
 *
 * 净新腿：② 从来没人把导出文件与复制家族对撞过（R237 只做过 copy-vs-copy），这里钉两个方向；③ 计数位（aud01-status 的「已显示 N 条」与
 * aud5-export-count 的「将导出 N 条」）离开前与回来后同一个 N，且仍等于屏上行数；④ 把 R124 的「屏上折 8 位短码 vs 文件持全形」与 R237 的 500
 * 隔离放进同一次挂载，实测那枚 32 位十六进制 id 在文件里 length 等于 32、逐字不截断。挂载：ConsoleModulePage 的 health 与 events 在同一会话里
 * （R237 同款），StoreProbe 挂在壳外订阅矩阵存储当常驻证人——store 是模块级、跨重挂载存活，而两个面自己都没有缓存。本文件不新增任何产品
 * testid；probe- 前缀与 probe-location 是私有证人节点。
 */
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
  Button: ({ children, outlined, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    void outlined;
    return <button {...props}>{children}</button>;
  },
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { ConsoleModulePage } from "@/shell/console";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix, useSourceMatrix } from "./sourceReads";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let restoreDownload: (() => void) | null = null;
let captured = "";
let blobCalls = 0;
let urlStub = vi.fn();

const HEALTH_URL = "/agent-api/api/health";
const HEALTH_PATHS = [HEALTH_URL, "/agent-api/api/__health-probe__", "/agent-api/api/hermes-summary", "/agent-api/api/skills"];
/** 每条读口的采集时刻都不同，矩阵证人才能分清是谁被写过。 */
const GEN1 = {
  health: { ok: true, asOf: "2026-11-19T15:17:09Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 },
  ] },
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
/** health 第一行的复制句：表名 · 读数 · 数据时刻 · 状态人话（rowCopy.ts 单点；延迟由 payload 派生，可逐字钉）。 */
const ROW_ZERO = "控制台服务 · 12 ms · 2026-11-19 23:17 · 正常";
const EV_DASH = "evt_cross0000001", EV_HEX = "evt_cross0000002", EV_BARE = "evt_cross0000003";
const RID_DASH = "req-cross-0001";
/** 32 位十六进制：照 R124 的夹具形制，屏上折成前 8 位，全形只活在 title 与文件里。 */
const RID_HEX = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
/** 破折号形态的失败 rid：不被短码规则折叠，锚里逐字可见。 */
const FAIL_RID = "req-cross-500";
const RID_COLUMN = 5, TIME_COLUMN = 0;

function rowOf(eventId: string, action: string, outcome: string, at: string, requestId: string | null): Record<string, unknown> {
  return {
    eventId, action, occurredAt: at, outcome,
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    ...(requestId ? { requestId } : {}),
  };
}
/** 三行：dash 形 rid（不折叠）、32 位十六进制 rid（屏上折 8 位）、根本没有 rid 的那行。 */
const PAGE = {
  items: [
    rowOf(EV_DASH, "task.created", "succeeded", "2026-11-20T05:30:00Z", RID_DASH),
    rowOf(EV_HEX, "approval.rejected", "failed", "2026-11-19T05:00:00Z", RID_HEX),
    rowOf(EV_BARE, "run.succeeded", "succeeded", "2026-11-18T04:00:00Z", null),
  ],
  nextCursor: null,
};
/** 失败旗标按引用读：装一次实现就能中途把审计面翻成 500（R229 习语）。 */
const flags: { audit: string | null } = { audit: null };

type SourceKey = "health" | "console" | "runtime" | "domain";
// audit 分支在 answer 里提前 return：keyOf 不收 audit，否则 GEN1[key] 走 TS7053。
const keyOf = (url: string): SourceKey => url === HEALTH_URL ? "health" : url.includes("__health-probe__") ? "console" : url.includes("hermes-summary") ? "runtime" : "domain";
function answer(url: string): unknown {
  if (url.startsWith("/agent-api/api/audit")) {
    if (url.includes("audit-detail")) return { audit: {} };
    if (flags.audit) throw new ApiError("audit upstream exploded", { status: 500, body: "{}", url, requestId: flags.audit });
    return PAGE;
  }
  return GEN1[keyOf(url)];
}
const arm = (): void => void api.fetchJSON.mockImplementation(async (url: unknown) => answer(String(url ?? "undefined")));
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
/** 零成本断言的口径：所有带 url 的调用都算（拆卸时的无参调用不算）。 */
const totalReads = (): number => api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).length;
const healthReads = (): number => urls().filter((url) => HEALTH_PATHS.includes(url)).length;
const auditReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;

const q = <T extends HTMLElement = HTMLElement>(testid: string): T | null => container.querySelector<T>(`[data-testid='${testid}']`);
/** 属性选择器要用这个助手：q 会把选择器包成 [data-testid='...']。 */
const all = (selector: string): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(selector)];
const textOf = (testid: string): string => q(testid)?.textContent?.trim() ?? "";
/** sys3 的耗时来自 payload、不逐读抖动，所以整行文字可以逐字比（矩阵 sys6 那族才要折叠 \d+ ms）。 */
const rowsOf = (prefix: string): Record<string, string> => Object.fromEntries(all(`[data-testid^='${prefix}']`).map((node) => [node.getAttribute("data-testid")!, node.textContent?.trim() ?? ""]));
const paintedRows = (): string[] => all("[data-testid^='aud01-row-']").map((node) => node.getAttribute("data-testid")!.replace("aud01-row-", ""));
const keysWith = (suffix: string): string[] => all(`[data-testid^='aud01-cell-'][data-testid$='${suffix}']`).map((node) => node.getAttribute("data-testid")!.replace("aud01-cell-", "").replace(suffix, ""));
/** 值列的屏上形：CopyValue 外层带 testid，firstElementChild 才是那一格（短码在文字里、全形在 title 里）。 */
const ridNode = (key: string): Element | null | undefined => q(`aud01-cell-${key}-request-value`)?.firstElementChild;
const screenRid = (key: string): string => ridNode(key)?.textContent?.trim() ?? "";
const ridTitle = (key: string): string => ridNode(key)?.getAttribute("title") ?? "";
/** -time 是 Field 的 dt+dd，屏上的值在 dd 里；-type 与 -result 整格文字就是用词。 */
const fieldDd = (key: string, field: string): string => q(`aud01-cell-${key}-${field}`)?.querySelector("dd")?.textContent?.trim() ?? "";
const cellWords = (key: string, field: string): string => textOf(`aud01-cell-${key}-${field}`);
/** 读数句里的第一个「N 条」；句子（错误句）没有数字，如实返回 -1。 */
const shownOf = (testid: string): number => Number(/(\d+)\s*条/.exec(textOf(testid))?.[1] ?? -1);

/** 只订阅矩阵存储的常驻证人，挂在 ConsoleModulePage 外面所以跨 tab 存活；probeFaces 只取 li 节点（地址证人 probe-location 不算矩阵面）。 */
function StoreProbe() {
  const snap = useSourceMatrix();
  return <ol>{snap.rows.map((row) => <li key={row.id} data-testid={`probe-${row.id}`}>{`${row.status}|${row.asOf ?? "—"}|${row.requestId ?? ""}`}</li>)}</ol>;
}
const probeFaces = (): Record<string, string> => Object.fromEntries([...container.querySelectorAll<HTMLElement>("li[data-testid^='probe-']")].map((node) => [node.getAttribute("data-testid")!, node.textContent?.trim() ?? ""]));
function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="probe-location">{`${loc.pathname}${loc.search}`}</span>;
}
const address = (): string => textOf("probe-location");

/** 迭代封顶而非墙钟截止：本域有冻结 Date 的同族写法，墙钟截止永不触发会空转到被判死。 */
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 600 && !cond(); i += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  if (!cond()) throw new Error(`waitFor: ${label} never became true`);
}
async function click(node: Element | null, label: string): Promise<void> {
  if (!node) throw new Error(`missing clickable node: ${label}`);
  await act(async () => { (node as HTMLElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
}
const clickTestId = (testid: string, label: string): Promise<void> => click(q(testid), `${label} (${testid})`);
const tabButton = (tabId: string): HTMLButtonElement | HTMLAnchorElement | null => container.querySelector<HTMLButtonElement | HTMLAnchorElement>(`[role="tab"][data-tab="${tabId}"]`);
/** 两族逐行复制都走被 mock 的 copyTextToClipboard 助手（矩阵那两枚才走裸 navigator.clipboard）。 */
async function copyVia(node: HTMLElement | null | undefined, label: string): Promise<string> {
  if (!node) throw new Error(`missing copy affordance: ${label}`);
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => { node.click(); await Promise.resolve(); });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, `copy landed: ${label}`);
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}
const copyHealthRow = (index: number): Promise<string> => copyVia(q(`sys-row-copy-${index}`), `health row ${index}`);
const copyRow = (key: string): Promise<string> => copyVia(q(`aud01-cell-${key}-request-value`)?.querySelector("button[aria-label='复制请求编号']"), `audit row ${key}`);
/** 下载捕获：RecordingBlob 记内容，anchor 间谍挡住真跳转，URL 桩的调用数记「有没有被调用」。 */
function captureDownload(): void {
  captured = "";
  blobCalls = 0;
  const OriginalBlob = window.Blob;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  class RecordingBlob extends OriginalBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); captured = String(parts[0] ?? ""); blobCalls += 1; }
  }
  Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: RecordingBlob });
  urlStub = vi.fn(() => "blob://captured");
  URL.createObjectURL = urlStub as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  restoreDownload = () => {
    Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: OriginalBlob });
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    clickSpy.mockRestore();
  };
}
/** BOM 用转义写，本文件不许出现字面 U+FEFF；按 \r\n 切记录、按逗号切列。 */
const csvRecords = (text: string): string[][] => text.replace(/^\uFEFF/, "").trimEnd().split("\r\n").map((line) => line.split(","));

async function mount(entry: string): Promise<void> {
  arm();
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
async function settleHealth(): Promise<void> {
  await waitFor(() => !!q("sys3-table"), "health surface ready");
  await waitFor(() => Object.values(probeFaces()).every((face) => face.startsWith("ok|")), "matrix store settled");
}
const settleEvents = (): Promise<void> => waitFor(() => paintedRows().length > 0, "audit list painted");

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  clipboard.copyTextToClipboard.mockReset().mockResolvedValue(true);
  resetSourceMatrix();
  api.fetchJSON.mockReset();
  flags.audit = null;
  window.history.replaceState({}, "", "/system?tab=health");
});

afterEach(() => {
  restoreDownload?.();
  restoreDownload = null;
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R241 — 复制家族与导出文件的对撞、计数位、500 同挂载", () => {
  it("① 复制句只交请求编号这一列，同一记录的 类型/结果/时间 三格只与屏上自己的话对齐", async () => {
    await mount("/system?tab=events");
    await settleEvents();
    const rows = paintedRows();
    expect(rows, "三行按服务端回的序上屏").toEqual([EV_DASH, EV_HEX, EV_BARE]);
    expect(keysWith("-request-value"), "只有带 rid 的两行有复制控件").toEqual([EV_DASH, EV_HEX]);
    expect(keysWith("-request-value-absent"), "没 rid 的那行给缺席标记（现状归 R236，不重写）").toEqual([EV_BARE]);
    expect(all("[data-testid^='sys-evt']").length, "派工的 sys-evt-copy-<i> 族不存在（第 33 条道：65 命中 / 17 文件 / 产品码 0）").toBe(0);
    captureDownload();
    const ledger = urls().length;
    await clickTestId("aud01-export", "CSV 门");
    await waitFor(() => captured !== "", "文件交付");
    const data = csvRecords(captured).slice(1);
    expect(csvRecords(captured)[0], "表头六列按现状锁（csv.ts）").toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
    expect(data.length, "文件数据行 == 表体行数").toBe(rows.length);
    expect(data.map((cells) => cells[RID_COLUMN]), "第 6 列：两枚全形、裸行留空（空值不加占位）").toEqual([RID_DASH, RID_HEX, ""]);
    for (const { key, line, rid } of [{ key: EV_DASH, line: data[0], rid: RID_DASH }, { key: EV_HEX, line: data[1], rid: RID_HEX }]) {
      const copied = await copyRow(key);
      expect(copied, "① 裁决后重形：唯一的逐行复制控件只交第 6 列，复制句 == 文件里该记录的 rid 格（位置序归 R235 :289、用词归 R221 :315）").toBe(line[RID_COLUMN]);
      expect(copied, "复制写的是全形（R124 :356 与 :400 的口径，本文件不重写）").toBe(rid);
      const typeWord = cellWords(key, "type"), resultWord = cellWords(key, "result"), screenTime = fieldDd(key, "time");
      expect(typeWord, "屏上类型用词 == 文件第 2 列（-type 是 button 套 span，不是 dd；-outcome 不存在）").toBe(line[1]);
      expect(resultWord, "屏上结果用词 == 文件第 3 列（-result 是 span 套 Badge）").toBe(line[2]);
      expect(screenTime, "屏上 -time 的 dd 是秒形（R240 实测），只有折到分钟才能与文件比").toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(screenTime.slice(0, 16), "文件时间格 == 屏上同一行折到分钟（R249 :324 从不碰时间列，这一格在这里是净新）").toBe(line[TIME_COLUMN]);
      for (const word of [typeWord, resultWord, screenTime, ","]) {
        expect(copied.includes(word), `负向：复制句只交请求编号，不含类型/结果/时间（含分隔符），此处不含「${word}」`).toBe(false);
      }
    }
    expect(screenRid(EV_HEX), "十六进制那枚屏上折成前 8 位").toBe(RID_HEX.slice(0, 8));
    expect(totalReads(), "导出与两次复制都不花一笔请求（onClick 只消费 listedRows）").toBe(ledger);
  });

  it("② 导出文件与 health 行复制句互不沾，sys-updated-at 只在 health 面存在", async () => {
    await mount("/system?tab=health");
    await settleHealth();
    const faces0 = probeFaces();
    // 裁决：matrix 是 employees 的 tabId（routes.ts:149 / :304、App.tsx:1214），/system 的 tab 条里没有这一枚。
    expect(tabButton("matrix"), "派工的「切到 matrix tab」与产品相反：/system 上没有 matrix 这枚 tab").toBeNull();
    expect(Object.keys(rowsOf("sys3-row-")).sort(), "sys-row-copy-<i> 长在 health pane 的 sys3-table 上").toEqual(["sys3-row-svc-a", "sys3-row-svc-b"]);
    const copies = [await copyHealthRow(0), await copyHealthRow(1)];
    expect(copies[0], "health 逐行复制的四段位由 rowCopy.ts 单点拼出").toBe(ROW_ZERO);
    expect(copies[1], "第二行说的是自己那行").toContain("域服务");
    // 复制句不沾刷新时刻这半归 system.matrix.copy.test.tsx:267，文件不含读取时刻那半归 system.matrix.export.test.tsx:302。
    await clickTestId("sys-refresh", "health 页的刷新");
    await waitFor(() => !!q("sys-updated-at"), "读取时刻落屏");
    expect(q("sys-updated-at"), "sys-updated-at 在产品位 systemRefresh.tsx:117 —— health 面上存在").not.toBeNull();
    expect(textOf("sys-updated-at")).toContain("（读取时刻，不是数据时刻）");
    await click(tabButton("events"), "the events tab");
    await settleEvents();
    expect(q("sys-updated-at"), "② 净新：审计面上没有 sys-updated-at 这枚锚（health 专属，产品位只有那一处）").toBeNull();
    expect(q("sys3-table"), "事件面在屏时 health pane 被壳卸掉（互斥 live 槽）").toBeNull();
    expect(all("[data-testid^='sys-row-copy-']"), "逐行复制钮不随事件面在屏").toHaveLength(0);
    expect(all("[data-testid^='sys-evt']"), "sys-evt 族仍不存在").toHaveLength(0);
    captureDownload();
    await clickTestId("aud01-export", "CSV 门");
    await waitFor(() => captured !== "", "文件交付");
    const lines = csvRecords(captured).slice(1);
    // 净新腿：从来没人把导出文件与复制家族对撞过（R237 只做过 copy-vs-copy）。正向——每一行都不含任何复制句；
    for (const [index, line] of lines.entries()) {
      for (const copy of copies) expect(line.includes(copy), `文件第 ${index + 1} 行不含任何 health 行复制句`).toBe(false);
    }
    // 再用无歧义的标记点名（不挑「服务」这种两边都有的词根，整句、表名、单位与采集时刻才算数）。
    for (const marker of ["控制台服务", "域服务", " ms", "2026-11-19 23:17"]) {
      expect(captured, `health 的标记「${marker}」不许渗进事件文件（含采集时刻不许冒充事件时间）`).not.toContain(marker);
    }
    // 反向——health 复制句不含文件里的任何 rid 格与任何事件 id。
    for (const copy of copies) {
      for (const rid of lines.map((cells) => cells[RID_COLUMN]).filter((cell) => cell !== "")) {
        expect(copy.includes(rid), "health 行复制句不含文件里的 rid 格").toBe(false);
      }
      for (const id of [EV_DASH, EV_HEX, EV_BARE]) expect(copy.includes(id), "health 行复制句不含任何事件 id").toBe(false);
    }
    expect(probeFaces(), "审计侧的导出一个字都没写进矩阵存储（常驻证人的意义）").toEqual(faces0);
    expect(address(), "地址仍在 /system 这一页").toContain("/system");
  });

  it("③ tab 往返：计数位不漂（离开方向零流量、回程花自己那一整批——算术归 window.isolation）", async () => {
    await mount("/system?tab=health");
    await settleHealth();
    const healthBase = healthReads();
    expect(healthBase, "首载花的是 health 自己那批四读").toBe(4);
    expect(auditReads(), "事件面还没挂过").toBe(0);
    await click(tabButton("events"), "the events tab");
    await settleEvents();
    const rowsOut = paintedRows(), statusOut = textOf("aud01-status");
    const shownOut = shownOf("aud01-status"), exportOut = shownOf("aud5-export-count");
    expect(rowsOut, "表体三行").toEqual([EV_DASH, EV_HEX, EV_BARE]);
    expect(shownOut, "aud01-status 的 N == 屏上行数").toBe(rowsOut.length);
    expect(exportOut, "aud5-export-count 的 N == 屏上行数").toBe(rowsOut.length);
    // 零成本断言的基准必须在「这次导航自己花的读」落定之后重取（既有坑：一个基准不能横跨两次切 tab）。
    const baseOnEvents = totalReads();
    await copyRow(EV_DASH);
    expect(totalReads(), "复制零成本，基准不是切 tab 之前那个数").toBe(baseOnEvents);
    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "back on the health pane");
    // 裁决：「往返零新增取数」与产品相反——回去要花整整一批四读（本页没有模块缓存，与 capabilities 的
    // cachedSkillsState / cachedTools 相反）；算术归 system.window.isolation.test.tsx :212 / :239 / :278。
    expect(healthReads(), "回 health 重读自己那一批（+4），不是零").toBe(healthBase + 4);
    expect(auditReads(), "离开的方向对事件面零流量").toBe(1);
    const baseOnHealth = totalReads();
    expect(await copyHealthRow(0), "health 面的逐行复制在往返里没被改口").toBe(ROW_ZERO);
    expect(totalReads(), "第二个基准同样只在导航之后重取").toBe(baseOnHealth);
    await click(tabButton("events"), "the events tab again");
    await settleEvents();
    const rowsBack = paintedRows();
    expect(rowsBack, "回来的表体还是同一集合").toEqual(rowsOut);
    expect(shownOf("aud01-status"), "③ 净新：计数位跨往返不漂，仍是同一个 N").toBe(shownOut);
    expect(textOf("aud01-status"), "整句也逐字不漂（窗口标签与「下面还有更多」都没变）").toBe(statusOut);
    expect(shownOf("aud5-export-count"), "导出读数同样不漂").toBe(exportOut);
    expect(shownOf("aud5-export-count"), "而且仍等于屏上行数").toBe(rowsBack.length);
    const baseAfterReturn = totalReads();
    captureDownload();
    await clickTestId("aud01-export", "CSV 门");
    await waitFor(() => captured !== "", "文件交付");
    expect(csvRecords(captured).length - 1, "文件行数与两枚计数位、屏上行数同一个数").toBe(shownOut);
    expect(urls().length, "导出只消费屏上那几行，永不重新取数").toBe(baseAfterReturn);
    expect(auditReads(), "两次进入事件面各花自己那一笔，共两笔").toBe(2);
  });

  it("④ 审计 500：同一次挂载里屏上短码与文件全形对撞、门按实测关死、health 面不被污染", async () => {
    await mount("/system?tab=health");
    await settleHealth();
    const faces0 = probeFaces(), services0 = rowsOf("sys3-row-");
    const healthCopy = await copyHealthRow(0);
    expect(healthCopy).toBe(ROW_ZERO);
    await click(tabButton("events"), "the events tab");
    await settleEvents();
    expect(paintedRows(), "第一笔读成功：三行上屏，含十六进制 rid 那枚").toEqual([EV_DASH, EV_HEX, EV_BARE]);
    expect(screenRid(EV_HEX), "R124 的形制：屏上折成前 8 位短码").toBe(RID_HEX.slice(0, 8));
    expect(ridTitle(EV_HEX), "全形活在 title 里，不占屏上那格").toBe(RID_HEX);
    captureDownload();
    await clickTestId("aud01-export", "CSV 门（有行时可点）");
    await waitFor(() => captured !== "", "文件交付");
    const hexCell = csvRecords(captured).slice(1)[1][RID_COLUMN];
    expect(hexCell.length, "④ 净新：文件那一格是完整 32 位，不截断").toBe(32);
    expect(hexCell, "逐字等于原 id").toBe(RID_HEX);
    expect(captured).toContain(RID_HEX);
    // 负向限定在文件里：屏上短码与失败锚的 rid 都是合法文字，整容器比不了。
    expect(captured, "屏上那枚短码不得冒充文件里的一整格").not.toContain(`${RID_HEX.slice(0, 8)},`);
    // 再把审计面翻成 500。R237 例③ 已钉「500 期间 health 逐行复制可点且写自己那行、失败锚 rid 复制写全 id、
    // 恢复后各自同源」——只引用它；净新是上面那一格与下面这两扇门在同一次挂载里。
    flags.audit = FAIL_RID;
    await clickTestId("aud01-refresh", "重新读这一页");
    await waitFor(() => !!q("aud01-error"), "失败锚亮起");
    expect(paintedRows(), "整页替换：失败后零行").toEqual([]);
    expect(textOf("aud01-status"), "错误态是无数字的一句（产品 :1355-:1365）").toBe("审计事件读取失败");
    expect(shownOf("aud01-status"), "错误句里没有 N 可数").toBe(-1);
    expect(textOf("aud5-export-count"), "导出读数无条件读 0（产品 :1620）").toBe("将导出 0 条");
    for (const [testid, title] of [["aud01-export", "当前筛选没有可导出的记录"], ["aud5-export", "当前筛选无事件可导出"]]) {
      const door = q<HTMLButtonElement>(testid);
      expect(door!.disabled, `裁决：「导出仍可用」对零行集合与产品相反——${testid} 按实测关死，不伪造一个可用的门`).toBe(true);
      expect(door!.getAttribute("title"), `${testid} 用自己的原因句（auditGates.ts:102 与 :107 是两句，不共用一个单点）`).toBe(title);
    }
    await clickTestId("aud01-export", "关死的主导出门");
    expect(blobCalls, "失败态强点不产第二个文件").toBe(1);
    expect(urlStub.mock.calls.length, "也不产第二个 URL").toBe(1);
    expect(textOf("aud01-error-request-id"), "失败锚里逐字带着失败 rid（口径归 R237 例③）").toContain(FAIL_RID);
    // 坑：captureDownload 的 anchor 间谍会吞掉一切 anchor 点击，而 tab 条是 NavLink 的 a ——导航之前必须先撤桩，
    // 否则切 tab 是空操作、sys3-table 永不回来。文件与 URL 的账已在上面三条结清。
    restoreDownload?.();
    restoreDownload = null;
    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "back on the health pane");
    expect(rowsOf("sys3-row-"), "health 表整行一字未动").toEqual(services0);
    expect(all("[data-testid^='sys-row-copy-']"), "复制控件没被清（诚实形状：审计面在屏时 health pane 由壳卸掉，回来时两枚都还在）").toHaveLength(2);
    const isolated = await copyHealthRow(0);
    expect(isolated, "失败期间回来的 health 逐行复制仍写自己那行，逐字与失败前相同").toBe(healthCopy);
    expect(isolated.includes(FAIL_RID), "health 复制串里没有事件面的失败 rid").toBe(false);
    const faces = probeFaces();
    expect(faces, "矩阵面一字未动（StoreProbe 面上出现失败 rid 是合法的，所以负向都限定在锚与文件里）").toEqual(faces0);
    for (const [key, face] of Object.entries(faces)) expect(face.startsWith("ok|"), `${key} 仍是成功面`).toBe(true);
    expect(healthReads(), "回程花的还是自己那批四读").toBe(8);
  });
});
