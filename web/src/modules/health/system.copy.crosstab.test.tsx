// @vitest-environment jsdom
/**
 * R237 — /system 复制控件跨 tab 的同源与互不污染（纯测试，只加用例，零产品改动）
 *
 * 派工单点名的两枚锚，现查结果是「不存在」与「跨道混称」，如实记录、不编造：
 *
 * 1) `sys-evt-copy-<i>` / `sys-evt-count` 本代不存在（第 31 条道确认）。
 *    `git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src`
 *    → 49 处命中，全部落在 15 个 health 测试文件里，内容只有两类：既有用例里
 *    记录缺席的注释，和我自己在断言里写的「零 sys-evt 节点」。health 产品码命中 0。
 *    命中文件：system.cross.failure / system.cross.isolation / system.empty /
 *    system.event.combo / system.event.copy.paging / system.event.empty /
 *    system.event.export / system.event.export.fulltext / system.event.rows /
 *    system.filters / system.matrix.export / system.refresh.race /
 *    system.state.isolation / system.time / system.window.isolation。
 *    ⇒ 事件面唯一的逐行复制控件是 `aud01-cell-<key>-request-value`（内含
 *    button[aria-label='复制请求编号']），空 rid 行是 `-request-value-absent`
 *    （文本「该字段未返回」，不给死按钮）。本文件用这两枚真面重写 ① 的复制腿。
 *
 * 2) `?tab=matrix` 不属于 /system。`matrix` 是 employees 模块的 tabId
 *    （shell/routes.ts:149，label「能力与权限」，hash `#/employees?tab=matrix`；
 *    shell/console.test.tsx:133 / :148 / :160 与 App.tsx:1214 都在 /employees 一侧）。
 *    /system 上这个 token 无人认领 → 折到第一个 pane 系统健康且不改写地址
 *    （R135 ③ health/system.filters.test.tsx:223；resolveTab 只吃 TAB_ALIAS）。
 *    而 `sys-row-copy-<i>` 一直在 /system 的健康 pane 上，是 `sys3-table` 的第六列
 *    （渲染点只有 SystemHealthSurface.tsx:535 / :569 / :572-573 与共享的
 *    :601-608 状态位与兜底框）。读源矩阵 `sys6-*` 没有任何逐行复制按钮，
 *    它只有表级 `sys10-copy`（竖线）与 `sys-matrix-copy`（制表符），由 R159 钉过。
 *    ⇒ 「?tab=matrix 下的 sys-row-copy-<i>」是把两个模块的名字叠在一起；
 *    本文件按产品事实拆成两族复制：逐行 `sys-row-copy-*` 与表级 `sys10/sys-matrix-copy`。
 *
 * 3) 「事件行与健康行对同一读源逐字相等」与产品相反。健康行来自
 *    `/agent-api/api/health` 的 sources（每行共享 payload 顶层采集时刻），
 *    事件行来自 `/agent-api/api/audit`，是两次不同的读、两份不同的数据；
 *    而且两面占的是壳里互斥的 live 槽（App.tsx:1625 health vs :1628 events），
 *    任何时刻只有一面在屏上。可写的同源等式是「每行的复制文本 == 它自己在屏上的值」，
 *    并且在 tab 往返的两个方向都成立——本文件就钉这个。
 *
 * 既有用例已覆盖处只回证据，不重写：
 * · R92 health/system.rowcopy.test.tsx :93 / :137 / :154 / :195 / :220 —— 逐行复制的
 *   逐字文本、缺字段与真 0、无采集时刻时守「—」、绝不沾刷新时刻、剪贴板拒的只读兜底、
 *   筛选下按钮重编号。但它挂的是单面 HealthPage，没有 tab 条也没有事件面。
 *   现查 `sys-row-copy` 在测试里被点击的地方只有 system.rowcopy.test.tsx 与
 *   system.time.test.tsx:227，两处都是单面挂载；system.empty.test.tsx:194 / :226
 *   只断言按钮数为零。⇒ 没有人跨 tab 点过逐行复制，也没有人在事件面活着的会话里点过。
 * · R159 health/system.matrix.copy.test.tsx :195 / :226 / :267 / :302 / :329 / :358
 *   —— 表级两种复制的五格逐字、失败行只说「失败」而 rid 留在屏上、复制文本不沾刷新时刻、
 *   未接线腿说人话、筛空时拒复制且不发请求、无可用腿时两钮全关。
 * · R171 health/system.time.test.tsx :287 / :324 / :372 / :422 —— 采集时刻六面逐字同源
 *   （含 sys-row-copy 第三段与两种复制的第五列）、2031 假时钟下任何时间面与复制文本
 *   都不沾读取时刻、单一显示口径、换代零残留。
 * · R224-first health/system.window.isolation.test.tsx :212 / :239 / :278 —— 切 tab
 *   对 health 四条路径零请求且矩阵存储面一字不动；事件读失败只亮 `aud01-error`
 *   不清不 dash 矩阵；回 health 重读一整批且读取时刻不等于任何数据面。
 * · R228 health/system.event.combo.test.tsx :259 / :310；R229 的失败锚 rid 点击与
 *   两表同败；R230 health/system.refresh.race.test.tsx :334 / :396 / :461 / :502；
 *   R235 的位置序对撞；R123 两扇导出门各自的原因句；R124 的 32 位 hex rid 折行。
 * · 事件面侧的上游道：R181 / R206 / R214 / R161 / R213 / R215 / R236 / R237 /
 *   R238 / R240 / R241 / R242 / R243 / R244 / R245（各自的行号见各自文件）。
 *
 * 本文件只写这三条没人合过的腿：
 * ① 逐行复制文本跨 tab 往返逐字不变，并且两族复制在同一次会话里各写自己的串
 *    （它们共用同一个 copyTextToClipboard 助手，所以必须互相不含对方的值）；
 * ② 假时钟 2031 下，逐行复制与矩阵两种复制同时不沾读取时刻，跨 tab 往返仍然如此；
 * ③ 事件读口 500 时健康表的逐行复制照样可点、照写自己那行、绝不含失败 rid，
 *    而失败锚的 rid 复制写的是完整 id；恢复后两面各自与自己屏上同源。
 *
 * 复制的两套机制在同一文件里并存：逐行 `sys-row-copy-*` 与事件面的
 * `CopyValue` / `RequestIdLine` 走可 mock 的 copyTextToClipboard 助手；
 * 矩阵两种复制与 `sys6-rid-*`、`hlt5` 的 rid 走裸 navigator.clipboard.writeText，
 * 所以两种都要各自装证人（armNavigatorClipboard / copyVia）。
 *
 * 「切 tab 零新增取数」的诚实形状：离开 health 去 events 对 health 四条路径零流量，
 * 但回去要花整整一批四读——健康页没有模块缓存（与 capabilities 的
 * cachedSkillsState / cachedTools 相反），事件面同样没有缓存，回来花它自己那一笔。
 * 这不是污染，是本代的真口径；本文件全部按「相对已捕获基数」断言，不写绝对总数。
 *
 * 本文件不新增任何产品 testid；`probe-` 前缀与 `crosstab-location` 是私有证人节点。
 * 冻结族只读：sys3-* / sys4-detail-* / sys5-* / sys6-* / sys7-export* / sys8-* /
 * sys10-* / sys13-* / sys15-* / sys-matrix-copy* / sys-search* / sys-refresh* /
 * sys-busy-note / sys-updated-at / sys-state-* / sys-row-copy-* / sys-copy-scope /
 * hlt5-* / aud01-* / aud2-* / audF-state-* / agent-v2-page-audit。
 */
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
  Button: ({ children, outlined, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    void outlined;
    return <button {...props}>{children}</button>;
  },
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { useLocation } from "react-router";
import { ApiError } from "@/lib/api-error";
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { ConsoleModulePage } from "@/shell/console";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix, useSourceMatrix } from "./sourceReads";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const HEALTH_URL = "/agent-api/api/health";
const HEALTH_PATHS = [HEALTH_URL, "/agent-api/api/__health-probe__", "/agent-api/api/hermes-summary", "/agent-api/api/skills"];
const IDS = ["console", "domain", "health", "runtime"] as const;

/** 每条读口给不同的顶层采集时刻，跨面的「不等于读取时刻」才不是空话。 */
const GEN1 = {
  health: {
    ok: true,
    asOf: "2026-11-19T15:17:09Z",
    sources: [
      { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
      { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 },
    ],
  },
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
/** 健康表第一行的复制文本：表名 · 读数 · 数据时刻 · 状态人话（rowCopy.ts 单点）。 */
const ROW_ZERO = "控制台服务 · 12 ms · 2026-11-19 23:17 · 正常";
const EVENT_ID = "evt_aaaa1111bbbb2222";
const EVENT_RID = "req-20261120-aaaa";
const EVENTS = {
  items: [
    {
      eventId: EVENT_ID,
      event_type: "approval_approved",
      occurredAt: "2026-11-20T05:30:00Z",
      outcome: "succeeded",
      actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
      resource: { type: "approval", id: "ap_1122334455667788" },
      requestId: EVENT_RID,
    },
  ],
  nextCursor: null,
};
/** 破折号形态，不被短码规则折叠：屏上文本 === title === 剪贴板 === 文件那一格。 */
const FAIL_RID = "req-crosstab-500";

/** 旗标按引用读：mount 只装一次实现，翻旗不需要重装（R229 习语）。 */
const flags: { health: string | null; audit: string | null } = { health: null, audit: null };

type SourceKey = "audit" | "health" | "console" | "runtime" | "domain";
function keyOf(url: string): SourceKey {
  if (url.startsWith("/agent-api/api/audit")) return "audit";
  if (url === HEALTH_URL) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}

function switchable(url: string): unknown {
  const key = keyOf(url);
  if (key === "audit") {
    if (url.includes("audit-detail")) return { audit: {} };
    if (flags.audit) {
      throw new ApiError("audit upstream exploded", { status: 500, body: "{}", url, requestId: flags.audit });
    }
    return EVENTS;
  }
  if (key === "health" && flags.health) {
    throw new ApiError("health upstream exploded", { status: 500, body: "{}", url, requestId: flags.health });
  }
  return GEN1[key];
}

function arm(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => switchable(String(url ?? "undefined")));
}

function readsFor(path: string): number {
  return api.fetchJSON.mock.calls.filter((call) => String(call[0] ?? "undefined") === path).length;
}
function healthReads(): number {
  return HEALTH_PATHS.reduce((sum, path) => sum + readsFor(path), 0);
}
function auditReads(): number {
  return api.fetchJSON.mock.calls.filter((call) => String(call[0] ?? "undefined").startsWith("/agent-api/api/audit?")).length;
}
/** 零额外请求的计量口径：所有带 url 的调用（teardown 的无参调用不算）。 */
function totalReads(): number {
  return api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).length;
}

/** 只订阅矩阵存储的常驻证人；挂在壳外，所以跨 tab 存活。耗时逐读抖动，不收。 */
function StoreProbe() {
  const snap = useSourceMatrix();
  return (
    <ol>
      {snap.rows.map((row) => (
        <li key={row.id} data-testid={`probe-${row.id}`}>
          {`${row.status}|${row.asOf ?? "—"}|${row.requestId ?? ""}`}
        </li>
      ))}
    </ol>
  );
}
function probeFaces(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>("[data-testid^='probe-']")]) {
    out[node.getAttribute("data-testid")!] = node.textContent?.trim() ?? "";
  }
  return out;
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="crosstab-location">{`${loc.pathname}${loc.search}`}</span>;
}
function address(): string {
  return textOf("crosstab-location");
}

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}
function textOf(testid: string): string {
  return q(testid)?.textContent?.trim() ?? "";
}
/** 耗时逐读抖动，折叠后再比整行文本。 */
function fold(text: string): string {
  return text.replace(/\d+ ms/g, "<n> ms");
}
/** 本项目没有 jest-dom，chai 没有 startsWith；按长度截前缀再比。 */
function headOf(text: string, lead: string): string {
  return text.slice(0, lead.length);
}
function rowsBy(prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>(`[data-testid^='${prefix}']`)]) {
    out[node.getAttribute("data-testid")!] = fold(node.textContent ?? "");
  }
  return out;
}
function matrixRows(): Record<string, string> {
  return rowsBy("sys6-row-");
}
function serviceRows(): Record<string, string> {
  return rowsBy("sys3-row-");
}
function asOfFaces(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of IDS) {
    out[`sys6-asof-${id}`] = textOf(`sys6-asof-${id}`);
    out[`sys8-asof-${id}`] = textOf(`sys8-asof-${id}`);
  }
  return out;
}
function paintedRows(): string[] {
  return [...container.querySelectorAll("[data-testid^='aud01-row-']")].map((node) => node.getAttribute("data-testid")!.replace("aud01-row-", ""));
}
/** 事件面那格的屏上形态：CopyValue 外层带 testid，首枚子 span 是显示值，完整 id 在它的 title 里。 */
function screenRid(key: string): string {
  const cell = q(`aud01-cell-${key}-request-value`);
  return cell?.firstElementChild?.textContent?.trim() ?? "";
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  // 迭代封顶而非 Date.now() 截止：本文件有测试冻结 Date，墙钟截止永不触发会空转到 vitest 判死。
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

async function click(node: Element | null, label: string): Promise<void> {
  if (!node) throw new Error(`missing clickable node: ${label}`);
  await act(async () => {
    (node as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mount(entry = "/system?tab=health"): Promise<void> {
  arm();
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <StoreProbe />
        <ConsoleModulePage
          module="system"
          live={{ health: <HealthPage />, events: <AuditEventsModulePage />, defaults: <div />, version: <div /> }}
        />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

async function settleHealthReady(): Promise<void> {
  await waitFor(() => !!q("sys3-table"), "health surface ready");
  await waitFor(() => Object.values(probeFaces()).every((face) => face.startsWith("ok|")), "matrix store settled");
}
async function settleEvents(): Promise<void> {
  await waitFor(() => paintedRows().length > 0, "audit list painted");
}
function tabButton(tabId: string): HTMLButtonElement | HTMLAnchorElement | null {
  return container.querySelector<HTMLButtonElement | HTMLAnchorElement>(`[role="tab"][data-tab="${tabId}"]`);
}
/** 展开读源矩阵（默认折叠）并等四行在屏上。 */
async function expandMatrix(): Promise<void> {
  await click(q("sys6-toggle"), "the matrix toggle");
  await waitFor(() => container.querySelectorAll("[data-testid^='sys6-row-']").length === 4, "matrix expanded");
}

/** 矩阵两种复制用的是裸 navigator.clipboard，不是 copyTextToClipboard 助手。 */
let clipWrite = vi.fn();
function armNavigatorClipboard(): void {
  clipWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipWrite } });
}
async function copyVia(testid: string): Promise<string> {
  clipWrite.mockClear();
  await click(q(testid), `the ${testid} button`);
  await waitFor(() => clipWrite.mock.calls.length > 0, `${testid} wrote to the clipboard`);
  return String(clipWrite.mock.lastCall?.[0] ?? "");
}

/** 健康表逐行复制：走可 mock 的助手。 */
async function copyHealthRow(index: number): Promise<string> {
  const button = q<HTMLButtonElement>(`sys-row-copy-${index}`);
  if (!button) throw new Error(`missing health row copy button: sys-row-copy-${index}`);
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, `health row ${index} copied`);
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}

/** 事件面唯一的逐行复制控件。 */
async function copyAuditRow(key: string): Promise<string> {
  const cell = q(`aud01-cell-${key}-request-value`);
  if (!cell) throw new Error(`missing audit row copy cell: ${key}`);
  const button = cell.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']");
  if (!button) throw new Error(`missing audit row copy button for ${key}`);
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, `audit row ${key} copied`);
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}

/** 失败锚里的 rid 复制：button 在 aud01-error-request-id 内。 */
async function copyAuditRid(): Promise<string> {
  const anchor = q("aud01-error-request-id");
  if (!anchor) throw new Error("missing audit error request-id anchor");
  const button = anchor.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']");
  if (!button) throw new Error("missing audit error rid copy button");
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, "the error rid copied");
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetSourceMatrix();
  api.fetchJSON.mockReset();
  flags.health = null;
  flags.audit = null;
  armNavigatorClipboard();
  window.history.replaceState({}, "", "/system?tab=health");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R237 — 跨 tab 的复制同源与互不污染", () => {
  it("逐行复制文本跨 tab 往返逐字不变，两族复制各写自己的串，离开方向零新增取数", async () => {
    await mount("/system?tab=health");
    await settleHealthReady();
    await expandMatrix();

    const faces0 = probeFaces();
    expect(Object.keys(faces0).sort()).toEqual(["probe-console", "probe-domain", "probe-health", "probe-runtime"]);
    expect(faces0["probe-health"], "health 行的采集时刻取自己那次读的顶层 ISO").toBe("ok|2026-11-19 23:17|");
    const services0 = serviceRows();
    const rows0 = matrixRows();
    expect(Object.keys(services0).sort()).toEqual(["sys3-row-svc-a", "sys3-row-svc-b"]);

    // 派工说的 `?tab=matrix` 在 /system 上不存在：matrix 是 employees 模块的 tabId
    // （shell/routes.ts:149），/system 的 tab 条里没有这一枚。
    expect(tabButton("matrix"), "system 侧没有 matrix tab；sys-row-copy-* 在健康 pane 的 sys3-table 上").toBeNull();
    expect(q("sys3-table"), "逐行复制所在的表就是这一枚").not.toBeNull();

    const readsBeforeFirstCopy = totalReads();
    const firstCopy = await copyHealthRow(0);
    expect(firstCopy, "逐行复制的四个段位由 rowCopy.ts 单点拼出").toBe(ROW_ZERO);
    expect(textOf("sys-row-copy-status"), "成功要有可见回执").toBe("已复制");
    expect(q("sys-row-copy-fallback-text"), "助手点头时不给兜底框").toBeNull();
    expect(totalReads(), "复制一次不花任何请求").toBe(readsBeforeFirstCopy);

    const healthBase = healthReads();
    const auditBase = auditReads();
    expect(healthBase, "首载花的是 health 自己那一批四读").toBe(4);
    expect(auditBase, "事件面还没挂过").toBe(0);

    await click(tabButton("events"), "the events tab");
    await settleEvents();
    expect(auditReads(), "事件面首载花它自己那一笔").toBe(auditBase + 1);
    expect(healthReads(), "离开 health 的方向对 health 四条路径零流量").toBe(healthBase);
    expect(paintedRows()).toEqual([EVENT_ID]);
    expect(probeFaces(), "矩阵存储面一个字都没被事件侧写过").toEqual(faces0);
    // 互斥槽的 DOM 形状：事件面在屏时，健康表与其逐行复制钮根本不存在。
    expect(q("sys3-table"), "health pane 被壳卸掉了（App.tsx:1625 vs :1628 互斥 live 槽）").toBeNull();
    expect(container.querySelector("[data-testid^='sys-row-copy-']"), "逐行复制钮不随事件面在屏").toBeNull();
    expect(container.querySelectorAll("[data-testid^='sys-evt']"), "派工的 sys-evt-copy-* 本代不存在（第 31 条道）").toHaveLength(0);

    // 零成本的基准必须在「这一次切 tab 自己花的读」落定之后再取：切到 events 花了一笔审计读，
    // 拿切窗前的大数当基准会把那一笔算成复制的成本（R230 记过的坑）。
    const readsOnEvents = totalReads();
    const auditCopy = await copyAuditRow(EVENT_ID);
    expect(auditCopy, "事件面唯一的逐行复制控件写的是那一行自己的请求编号").toBe(EVENT_RID);
    expect(screenRid(EVENT_ID), "屏上那格与剪贴板同串（破折号形态不被短码规则折叠）").toBe(auditCopy);
    expect(auditCopy.includes("控制台服务"), "跨面不得互吞：事件复制串里不该有健康表名").toBe(false);
    expect(firstCopy.includes(EVENT_RID), "跨面不得互吞：健康行复制串里不该有事件 rid").toBe(false);
    expect(totalReads(), "复制一次不花任何请求").toBe(readsOnEvents);

    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "back on the health pane");
    expect(serviceRows(), "健康表整行文本跨 tab 往返逐字不变").toEqual(services0);
    expect(matrixRows(), "矩阵整行文本同样不变").toEqual(rows0);
    expect(probeFaces()).toEqual(faces0);
    expect(healthReads(), "回 health 要花整整一批四读：本页没有模块缓存（与 capabilities 的 cachedSkillsState 相反）——这不是污染").toBe(healthBase + 4);
    expect(auditReads(), "离开的方向对事件面零流量").toBe(auditBase + 1);

    const readsBackOnHealth = totalReads();
    const secondCopy = await copyHealthRow(0);
    expect(secondCopy, "往返之后复制文本与第一次逐字相同").toBe(firstCopy);
    expect(secondCopy).toBe(ROW_ZERO);
    expect(textOf("sys-row-copy-status")).toBe("已复制");
    expect(totalReads(), "复制依然零请求").toBe(readsBackOnHealth);
    expect(container.querySelectorAll("[data-testid^='sys-evt']")).toHaveLength(0);
    expect(address(), "地址始终在 system 这一页上").toContain("/system");
  });

  it("假时钟 2031 下逐行复制与矩阵两种复制同时不沾读取时刻，跨 tab 往返仍如此", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    await mount("/system?tab=health");
    await settleHealthReady();
    await expandMatrix();

    const asOf0 = asOfFaces();
    const rows0 = matrixRows();
    const services0 = serviceRows();
    const healthBase = healthReads();

    await click(q("sys-refresh"), "the page refresh button");
    await waitFor(() => !!q("sys-updated-at"), "the read stamp lands");
    const stamp = textOf("sys-updated-at");
    expect(stamp).toContain("（读取时刻，不是数据时刻）");
    expect(stamp, "假时钟要真的落在读取时刻上，否则这条断言是空的").toContain("2031");
    expect(healthReads(), "刷新花的是自己那一批四读").toBe(healthBase + 4);

    const rowCopy = await copyHealthRow(0);
    expect(rowCopy, "逐行复制的第三段是数据时刻，不是刷新时刻").toBe(ROW_ZERO);
    expect(rowCopy).not.toContain("2031");
    expect(rowCopy).not.toContain("刷新完成于");
    expect(rowCopy).not.toContain(stamp);

    const pipe = await copyVia("sys10-copy");
    const tabText = await copyVia("sys-matrix-copy");
    for (const [name, copied] of [
      ["sys10-copy", pipe],
      ["sys-matrix-copy", tabText],
    ] as const) {
      expect(copied, `${name} 的复制文本不该沾上读取时刻`).not.toContain("2031");
      expect(copied, `${name} 里不该出现「刷新完成于」`).not.toContain("刷新完成于");
      expect(copied).not.toContain(stamp);
      expect(copied, `${name} 仍带着这一代的真实采集时刻`).toContain("2026-11-19 23:17");
    }

    const afterStamp = asOfFaces();
    for (const [key, value] of Object.entries(afterStamp)) {
      expect(value, `${key} 的数据时刻不因刷新而改`).toBe(asOf0[key]);
      expect(value, `${key} 不得等于读取时刻`).not.toBe(stamp);
    }
    expect(serviceRows(), "刷新后健康表整行不动（同一代读数）").toEqual(services0);
    expect(matrixRows(), "矩阵整行同样不动").toEqual(rows0);

    // 跨 tab 往返：读取时刻是健康页的组件状态，卸载即不在了；要守的是复制文本本身不沾它。
    await click(tabButton("events"), "the events tab");
    await settleEvents();
    expect(container.querySelectorAll("[data-testid^='sys-evt']"), "事件面没有 sys-evt 家族（第 31 条道）").toHaveLength(0);
    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "back on the health pane");

    const afterTrip = await copyHealthRow(0);
    expect(afterTrip, "往返之后逐行复制仍是同一串，且仍不沾 2031").toBe(rowCopy);
    expect(afterTrip).not.toContain("2031");
    expect(afterTrip).not.toContain("刷新完成于");
    const pipe2 = await copyVia("sys10-copy");
    // 耗时列是每次读取当场量的（0 ms / 2 ms 逐读抖动），所以跨往返比的是折叠后的表体；
    // 采集时刻与口径名、路径、状态这些仍然要逐字不动，由 asOfFaces / rowsBy 那几条守。
    expect(fold(pipe2), "表级复制跨往返在折叠耗时后逐字不变").toBe(fold(pipe));
    expect(pipe2, "第四列仍是量出来的耗时，不是被抹成空").toMatch(/\d+ ms/);
    expect(pipe2).not.toContain("2031");
    expect(asOfFaces(), "每个数据面仍停在第一代").toEqual(asOf0);
    expect(serviceRows()).toEqual(services0);
    expect(matrixRows()).toEqual(rows0);
  });

  it("事件读口 500 时健康表逐行复制照样可点且写自己那行，失败锚的 rid 复制写完整 id，恢复后两面各自同源", async () => {
    flags.audit = FAIL_RID;
    await mount("/system?tab=health");
    await settleHealthReady();
    await expandMatrix();

    const services0 = serviceRows();
    const rows0 = matrixRows();
    const faces0 = probeFaces();
    const firstCopy = await copyHealthRow(0);
    expect(firstCopy).toBe(ROW_ZERO);
    const healthBase = healthReads();
    expect(healthBase, "health 那一批四读先落定了").toBe(4);

    await click(tabButton("events"), "the events tab");
    await waitFor(() => !!q("aud01-error"), "the audit failure anchor lights up");
    expect(q("sys3-table"), "事件面在屏时健康表被卸掉").toBeNull();
    expect(textOf("aud01-error-sentence"), "失败要说人话").not.toBe("");
    expect(textOf("aud01-error-request-id"), "失败锚要带 rid").toContain(FAIL_RID);
    const readsAtFailure = totalReads();

    const ridCopy = await copyAuditRid();
    expect(ridCopy, "复制的是完整请求编号，不是屏上的短码").toBe(FAIL_RID);
    expect(totalReads(), "复制一次不花任何请求").toBe(readsAtFailure);
    expect(container.querySelectorAll("[data-testid^='sys-evt']"), "派工的 sys-evt-* 本代不存在（第 31 条道）").toHaveLength(0);

    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "back on the health pane");
    // 回程花的是健康页自己那批四读（本页无模块缓存），基准必须在回程落定后取。
    const readsAtReturn = totalReads();
    const door = q<HTMLButtonElement>("sys-row-copy-0");
    expect(door, "另一张表的复制门不因这边失败而被关").not.toBeNull();
    expect(door!.disabled, "失败的是事件面，健康表的逐行复制钮不禁用").toBe(false);
    const isolated = await copyHealthRow(0);
    expect(isolated, "健康行复制仍写自己那行，逐字与失败前相同").toBe(firstCopy);
    expect(isolated.includes(FAIL_RID), "健康行复制串里绝不该出现事件面的失败 rid").toBe(false);
    expect(textOf("sys-row-copy-status")).toBe("已复制");
    expect(totalReads(), "这次复制同样零请求").toBe(readsAtReturn);
    expect(serviceRows(), "健康表整行一字未动").toEqual(services0);
    expect(matrixRows(), "矩阵整行一字未动").toEqual(rows0);
    const faces = probeFaces();
    expect(faces, "事件面的失败一个字都没写进矩阵存储").toEqual(faces0);
    for (const [key, face] of Object.entries(faces)) {
      expect(headOf(face, "ok|"), `${key} 仍是成功面`).toBe("ok|");
      expect(face, `${key} 没有被失败面的破折号冒充`).not.toContain("|—|");
    }
    expect(q("sys-refresh-error"), "审计失败不产 health 族的锚").toBeNull();
    expect(q("sys-state-state"), "health 族的锚在其 pane 停放时不存在").toBeNull();
    expect(healthReads(), "回 health 只花自己那批四读，与事件面的失败无关").toBe(healthBase + 4);

    flags.audit = null;
    await click(tabButton("events"), "the events tab back");
    await settleEvents();
    expect(paintedRows(), "恢复后事件表画出自己的行").toEqual([EVENT_ID]);
    expect(q("aud01-error"), "失败锚撤走").toBeNull();
    // 再切一次又花事件面自己那一笔读；基准只能在它落定之后取。
    const readsAfterRecovery = totalReads();
    const recovered = await copyAuditRow(EVENT_ID);
    expect(recovered, "恢复后逐行复制是这一行自己的请求编号").toBe(EVENT_RID);
    expect(screenRid(EVENT_ID), "与屏上那格同源").toBe(recovered);
    expect(recovered.includes(FAIL_RID), "恢复后的复制串不该留着失败的 rid").toBe(false);
    expect(totalReads(), "复制依旧零请求").toBe(readsAfterRecovery);

    await click(tabButton("health"), "the health tab again");
    await waitFor(() => !!q("sys3-table"), "health again");
    expect(serviceRows(), "两面各自同源：健康表整行自始至终一字未动").toEqual(services0);
    expect(matrixRows()).toEqual(rows0);
    expect(probeFaces()).toEqual(faces0);
    expect(container.querySelectorAll("[data-testid^='sys-evt']")).toHaveLength(0);
  });
});
