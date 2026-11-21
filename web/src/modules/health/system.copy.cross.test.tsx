// @vitest-environment jsdom
// R248 — /system：事件侧换窗插在复制往返中间时 health 逐行复制族按构造不感窗，两族复制的反馈形制各自钉死（纯测试，产品码零改动）。
//
// cite-only 记账（既有条道已覆盖处只回指针，本文件不重写）：
// · ① 的 tab 往返本体 = system.copy.crosstab.test.tsx:404（R237 ①：逐字不变、两族互不吞、离开零流量、回程花自己一批）。
// · 换窗本体 = system.event.copy.paging.test.tsx:343（R235 ②：行集换代、控件重建、恰 +1 读、地址落新窗）。
// · 两族互不污染 = system.copy.crosstab.test.tsx:404 + system.event.copy.export.cross.test.tsx:246/:279。
// · 500 隔离腿 = system.cross.failure.test.tsx:304/:359/:395 + system.copy.crosstab.test.tsx:538（② 的失败尾只回一句证据）。
// · 窗算术族 = system.window.isolation.test.tsx:212/:278。
// 净新增（实测）：没有人把「换窗」与「sys-row-copy-*」放进同一次会话——git grep -l -E
// "window=7d|window=24h|window=30d|filter-window" 与 git grep -l "sys-row-copy-" 在 src/modules/health 的交集为零文件
// （2026-11-21 现查）。R237 做了往返但没换窗，R235 换了窗但健康逐行复制族不在场。
// 三条现场裁决（派工口径与产品相反处以产品为准）：
// 1)「两类复制同步换代」与产品相反：health 产品码读 get("window") 命中 0（实测），sys-row-copy 族按构造窗惰性；
//    诚实钉子是 health 逐行复制在换窗全程逐字不变，只有事件族随窗换代。
// 2)「零新增取数」与产品相反：离开 health 确实零流量，回程要花整整一批四读——两面都没有模块缓存；① 的回头腿照实标注。
// 3) sys-evt-copy-<i>/sys-evt-count 不存在（第 36 条道，现查复核）：grep sys-evt 族 75 处命中 / 19 个 health 测试文件 /
//    health 产品码 0；真面逐行复制是 aud01-cell-<key>-request-value 里的 button（aria-label「复制请求编号」）。
// 跨模块挂载披露：本文件按派工落在 modules/health 目录，被测事件面组件是 modules/audit/AuditEventsModulePage；
// @/shell/console 与 @/modules/audit/** 只挂载/只读，不改一字。本文件不新增任何产品 testid；probe- 与 probe-location 是私有证人节点。
// 反馈形制按 states.tsx:497-550 实测：CopyValue 不渲染任何播报节点（无 role=status、无 aria-live），回执写进按钮自己的文字；
// 「事件行复制有 role=status」的前提与产品相反。全 pane 唯一一枚 role=status 是抽屉小部件 aud-detail-copy-status
// （AuditEventsModulePage.tsx:1390 就地挂载，实测在场、与行格无关——派工说它「不在本 pane」也不成立，本文件按产品实测定形）。
// health 族 sys-row-copy-status（SystemHealthSurface.tsx:602）确有 role=status + aria-live=polite，两族形制必须分开钉。
// 本文件永不冻结计时器：「已复制」的 2500 ms 复位是真 window.setTimeout（states.tsx:542），回执要在点击后立刻读。
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
const GEN1 = {
  health: { ok: true, asOf: "2026-11-19T15:17:09Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 }]},
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
// 健康表第一行的复制文本（rowCopy.ts 单点拼出）。
const ROW_ZERO = "控制台服务 · 12 ms · 2026-11-19 23:17 · 正常";
// 窗 fixtures：宽窗（壳默认 7d）两行带 rid 加一行裸行 W3；窄窗（24h）只认 N1。rid 全破折号形态，
// 不被 R31 短码规则折叠：屏上文本 === title === 剪贴板。
const W1 = "evt_wide00000000001";
const W2 = "evt_wide00000000002";
const W3 = "evt_wide00000000003";
const N1 = "evt_narrow000000001";
const RID_W1 = "req-cross-wide-1";
const RID_W2 = "req-cross-wide-2";
const RID_N1 = "req-cross-narrow";
const FAIL_RID = "req-crosscopy-500";
function eventRow(eventId: string, at: string, requestId: string | null): Record<string, unknown> {
  return { eventId, event_type: "approval_approved", occurredAt: at, outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" }, ...(requestId ? { requestId } : {}) };
}
const WIDE_EVENTS = { items: [eventRow(W1, "2026-11-20T05:30:00Z", RID_W1), eventRow(W2, "2026-11-19T05:00:00Z", RID_W2), eventRow(W3, "2026-11-18T04:00:00Z", null)], nextCursor: null };
const NARROW_EVENTS = { items: [eventRow(N1, "2026-11-20T05:30:00Z", RID_N1)], nextCursor: null };
// 旗标按引用读：mount 只装一次实现，翻旗不需要重装（R229 习语）。
const flags: { health: string | null; audit: string | null } = { health: null, audit: null };
type SourceKey = "audit" | "health" | "console" | "runtime" | "domain";
function keyOf(url: string): SourceKey {
  if (url.startsWith("/agent-api/api/audit")) return "audit";
  if (url === HEALTH_URL) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}
// 事件面只带 from/to ISO 对提问（永远没有 window= 参数），假服务按请求自带的窗选行集（R235 习语）。
const paramOf = (url: string, key: string): string | null => new URL(url, "http://console.test").searchParams.get(key);
const cursorsOf = (url: string): string[] => [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
const windowHours = (url: string): number =>
  (Date.parse(paramOf(url, "to") ?? "") - Date.parse(paramOf(url, "from") ?? "")) / 3_600_000;
function switchable(url: string): unknown {
  const key = keyOf(url);
  if (key === "audit") {
    if (url.includes("audit-detail")) return { audit: {} };
    if (flags.audit) throw new ApiError("audit upstream exploded", { status: 500, body: "{}", url, requestId: flags.audit });
    return windowHours(url) <= 25 ? NARROW_EVENTS : WIDE_EVENTS;
  }
  if (key === "health" && flags.health) throw new ApiError("health upstream exploded", { status: 500, body: "{}", url, requestId: flags.health });
  return GEN1[key];
}
const arm = (): void => {
  api.fetchJSON.mockImplementation(async (url: unknown) => switchable(String(url ?? "undefined")));
};
const readsFor = (path: string): number =>
  api.fetchJSON.mock.calls.filter((call) => String(call[0] ?? "undefined") === path).length;
const healthReads = (): number => HEALTH_PATHS.reduce((sum, path) => sum + readsFor(path), 0);
const auditReads = (): number =>
  api.fetchJSON.mock.calls.filter((call) => String(call[0] ?? "undefined").startsWith("/agent-api/api/audit?")).length;
// 零额外请求的计量口径：所有带 url 的调用（teardown 的无参调用不算）。
const totalReads = (): number => api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).length;
const lastAuditRead = (): string =>
  String([...api.fetchJSON.mock.calls].reverse().find((c) => String(c[0] ?? "").startsWith("/agent-api/api/audit?"))?.[0] ?? "");
// 只订阅矩阵存储的常驻证人；挂在壳外，所以跨 tab 存活。耗时逐读抖动，不收。
function StoreProbe() {
  const snap = useSourceMatrix();
  return <ol>{snap.rows.map((row) => (
    <li key={row.id} data-testid={`probe-${row.id}`}>{`${row.status}|${row.asOf ?? "—"}|${row.requestId ?? ""}`}</li>
  ))}</ol>;
}
function probeFaces(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>("[data-testid^='probe-']")]) {
    const id = node.getAttribute("data-testid")!;
    if (id !== "probe-location") out[id] = node.textContent?.trim() ?? ""; // 地址证人不是矩阵面（donor 用 crosstab-location 避撞，这里按名排除）。
  }
  return out;
}
function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="probe-location">{`${loc.pathname}${loc.search}`}</span>;
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
const paintedRows = (): string[] =>
  [...container.querySelectorAll("[data-testid^='aud01-row-']")].map((node) => node.getAttribute("data-testid")!.replace("aud01-row-", ""));
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  // 迭代封顶而非墙钟截止：本文件不冻结 Date，写法与既有 harness 保持一致。
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
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
        <ConsoleModulePage module="system" live={{ health: <HealthPage />, events: <AuditEventsModulePage />, defaults: <div />, version: <div /> }} />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}
async function settleHealthReady(): Promise<void> {
  await waitFor(() => !!q("sys3-table"), "health surface ready");
  await waitFor(() => Object.values(probeFaces()).every((face) => face.startsWith("ok|")), "matrix store settled");
}
const settleEvents = async (): Promise<void> => {
  await waitFor(() => paintedRows().length > 0, "audit list painted");
};
const tabButton = (tabId: string): HTMLButtonElement | HTMLAnchorElement | null =>
  container.querySelector<HTMLButtonElement | HTMLAnchorElement>(`[role="tab"][data-tab="${tabId}"]`);
// 展开读源矩阵（默认折叠）并等四行在屏上。
async function expandMatrix(): Promise<void> {
  await click(q("sys6-toggle"), "the matrix toggle");
  await waitFor(() => container.querySelectorAll("[data-testid^='sys6-row-']").length === 4, "matrix expanded");
}
// 健康表逐行复制（走可 mock 的助手）与事件面唯一的逐行复制控件、失败锚 rid 复制。
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
async function copyAuditRow(key: string): Promise<string> {
  const cell = q(`aud01-cell-${key}-request-value`);
  if (!cell) throw new Error(`missing audit row copy cell: ${key}`);
  return copyViaButton(cell.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']"), `audit row ${key}`);
}
async function copyAuditRid(): Promise<string> {
  const anchor = q("aud01-error-request-id");
  if (!anchor) throw new Error("missing audit error request-id anchor");
  return copyViaButton(anchor.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']"), "the error rid");
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
describe("R248 — 事件侧换窗与两族复制：健康逐行复制窗惰性，两族反馈形制相反", () => {
  it("① 事件侧换窗插在往返中间：health 逐行复制一字不改，事件复制跟着窗换代", async () => {
    await mount("/system?tab=health");
    await settleHealthReady();
    await expandMatrix();
    const faces0 = probeFaces();
    // 派工说的 ?tab=matrix 在 /system 上不存在（matrix 是 employees 的 tabId），逐行复制就在健康 pane 的 sys3-table 上。
    expect(tabButton("matrix")).toBeNull();
    const readsBeforeCopy = totalReads();
    const healthCopy0 = await copyHealthRow(0);
    expect(healthCopy0, "逐行复制的四个段位由 rowCopy.ts 单点拼出").toBe(ROW_ZERO);
    expect(totalReads(), "复制一次不花任何请求").toBe(readsBeforeCopy);
    await click(tabButton("events"), "the events tab");
    await settleEvents();
    expect(paintedRows(), "壳首载默认宽窗（DEFAULT_WINDOW=7d）：画的是宽窗三行").toEqual([W1, W2, W3]);
    const wideCopy = await copyAuditRow(W1);
    expect(wideCopy, "事件逐行复制写这一行自己的请求编号").toBe(RID_W1);
    // 基数必须在宽窗首载与这次复制都落定之后再取：零成本基准不能横跨两次导航。
    const healthBase = healthReads();
    const auditBase = auditReads();
    const totalBase = totalReads();
    await click(q("aud01-filter-window-24h"), "切到 24h 窗");
    await waitFor(() => paintedRows().length === 1 && paintedRows()[0] === N1, "narrow-window row set painted");
    expect(totalReads(), "换窗全页只多这一笔读：health 四条路径与其余三面都零流量").toBe(totalBase + 1);
    expect(auditReads(), "切窗只多它自己这一笔读").toBe(auditBase + 1);
    expect(healthReads(), "换窗对 health 四条路径零流量：health 族按构造窗惰性（产品码 get(\"window\") 命中 0）").toBe(healthBase);
    const read = lastAuditRead();
    expect(paramOf(read, "window"), "事件面只发 from/to ISO 对，请求里永远没有 window= 参数").toBeNull();
    expect(cursorsOf(read), "切窗丢掉旧游标").toEqual([]);
    expect(paramOf(address(), "window"), "地址落在新窗").toBe("24h");
    const readsAfterSwitch = totalReads();
    const narrowCopy = await copyAuditRow(N1);
    expect(narrowCopy, "换代后事件复制句是窄窗行自己的 rid").toBe(RID_N1);
    expect(narrowCopy.includes(RID_W1) || narrowCopy.includes(RID_W2), "另一窗的 rid 一个都不许进句").toBe(false);
    expect(totalReads(), "复制不花请求").toBe(readsAfterSwitch);
    expect(probeFaces(), "矩阵存储面一个字都没被事件侧的换窗写过").toEqual(faces0);
    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "back on the health pane");
    expect(healthReads(), "回程花自己一整批——本页没有模块缓存，派工说的『零新增取数』与产品相反").toBe(healthBase + 4);
    const backCopy = await copyHealthRow(0);
    expect(backCopy, "换窗全程逐字不变：这就是窗惰性证明").toBe(healthCopy0);
    expect(textOf("sys-row-copy-status")).toBe("已复制");
    expect(backCopy.includes(RID_W1) || backCopy.includes(RID_W2) || backCopy.includes(RID_N1), "健康行复制句里不许出现任何一个窗的事件 rid").toBe(false);
    expect(backCopy.includes("evt_"), "健康行复制句里不许出现任何 evt_ 事件 id").toBe(false);
    expect(q("sys-evt-copy-0"), "sys-evt-copy-<i> 本代没有对手").toBeNull();
    expect(q("sys-evt-count"), "sys-evt-count 本代没有对手").toBeNull();
    expect(countAll("[data-testid^='sys-evt']"), "第 36 条道：grep sys-evt 族 75 处命中 / 19 个 health 测试文件 / health 产品码 0；真面逐行复制是 aud01-cell-<key>-request-value 里的 button").toBe(0);
  });
  it("② 两族复制的反馈形制不同：health 有 role=status 播报，事件行复制一个播报节点都没有", async () => {
    await mount("/system?tab=health");
    await settleHealthReady();
    const readsOnHealth = totalReads();
    const healthCopy = await copyHealthRow(0);
    expect(healthCopy).toBe(ROW_ZERO);
    const status = q("sys-row-copy-status");
    expect(status, "健康族有专门的播报位").not.toBeNull();
    expect(status!.textContent?.trim(), "成功要有可见回执").toBe("已复制");
    expect(status!.getAttribute("role"), "SystemHealthSurface.tsx:602 的播报位").toBe("status");
    expect(status!.getAttribute("aria-live")).toBe("polite");
    expect(q("sys-row-copy-fallback-text"), "助手点头时不给兜底框").toBeNull();
    expect(totalReads(), "复制不花请求").toBe(readsOnHealth);
    await click(tabButton("events"), "the events tab");
    await settleEvents();
    const readsOnEvents = totalReads();
    const auditCopy = await copyAuditRow(W1);
    expect(auditCopy, "事件行复制写这一行自己的 rid").toBe(RID_W1);
    const copyButton = () => container.querySelector<HTMLButtonElement>(`[data-testid='aud01-cell-${W1}-request-value'] button`);
    await waitFor(() => (copyButton()?.textContent ?? "").trim() === "已复制", "事件族的回执写进按钮自己的文字");
    expect(copyButton()!.textContent?.trim(), "CopyValue 的「已复制」落在 button 文字上，不另设播报").toBe("已复制");
    expect(totalReads(), "复制不花请求").toBe(readsOnEvents);
    // 现场裁决（实测推翻派工前提）：AuditEventsModulePage.tsx:1390 就地挂了 DetailCopy，事件 pane 唯一一枚
    // role=status 就是抽屉的 aud-detail-copy-status——「一个都没有」的诚实形状是行格子树内零播报节点。
    const statusNodes = [...container.querySelectorAll("[role='status']")];
    expect(statusNodes.map((n) => n.getAttribute("data-testid")), "事件 pane 唯一的 role=status 是抽屉的 aud-detail-copy-status；行级复制没有任何播报节点（states.tsx:497-550）").toEqual(["aud-detail-copy-status"]);
    expect(q(`aud01-cell-${W1}-request-value`)!.querySelector("[role='status'], [aria-live]"), "行格子树里没有任何播报节点").toBeNull();
    expect(countAll("[data-testid^='aud01-cell-'][data-testid$='-status']"), "事件格也没有任何 *-status testid 族").toBe(0);
    const bare = q(`aud01-cell-${W3}-request-value-absent`);
    expect(bare, "裸行只给说明节点").not.toBeNull();
    expect(bare!.textContent?.trim(), "裸行的说法").toBe("该字段未返回");
    expect(bare!.getAttribute("title"), "原因写在 title 里").toBe("服务这次没有回传请求编号");
    expect(bare!.querySelector("button"), "裸行不给死按钮").toBeNull();
    // 失败尾一句证据（system.cross.failure.test.tsx:304/:359/:395 与 system.copy.crosstab.test.tsx:538 已拥有这条腿，
    // 不重推）：翻旗在切 tab 之前置上，走 donor 的单 switchable handler 既有机制。
    flags.audit = FAIL_RID;
    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "back on the health pane");
    await click(tabButton("events"), "events again under the failure flag");
    await waitFor(() => !!q("aud01-error"), "the failure anchor lights up");
    const readsAtFailure = totalReads();
    const ridCopy = await copyAuditRid();
    expect(ridCopy, "失败锚的复制写完整 rid（证据只回指针）").toBe(FAIL_RID);
    expect(totalReads(), "失败态的复制也不花请求").toBe(readsAtFailure);
    expect(
      Object.values(probeFaces()).every((face) => headOf(face, "ok|") === "ok|" && !face.includes("|—|")),
      "健康面全程仍是 ok| 前缀：事件侧失败一个字都没写进矩阵存储，|—| 从不出现",
    ).toBe(true);
  });
});
