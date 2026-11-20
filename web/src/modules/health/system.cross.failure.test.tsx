// @vitest-environment jsdom
/**
 * R229 — /system 两表刷新失败互不污染（纯测试，零产品码改动）。
 *
 * 先查既有用例（派工单纪律：查 R210 / R224 / R228，已覆盖只回证据）：
 * - `sys-evt` 族本代不存在（第 22 条道确认）：`git grep` 命中 23 处，全部是既有注脚或我自己
 *   的「不存在」断言（window.isolation:6/7/231/299、cross.isolation:6/7/12、matrix.export:6、
 *   state.isolation:18、time:8、empty:13、filters:14、event.combo:6/12/304/347、
 *   event.rows:6/7/207、event.export:5/6/46/260），零产品码。health 模块没有事件表，
 *   `sys-evt-count` 无对应物 ⇒ 派工单 ② 的这一腿只能断言它「不存在」，绝不编造。
 * - shell 的 live 槽互斥（App.tsx 的 health 槽 vs events 槽）：一面活跃时另一面被卸载。
 *   所以 ② 的「事件表行数不变」在 health 失败期间没有屏上对应物——诚实改写为「health 单读源
 *   失败之后切到事件表，事件面照常用它自己那一笔读把行画出来、不亮任何审计错误锚」，
 *   这才是产品里可测的「互不污染」。
 * - ① 的锚隔离半面已由 R224（system.window.isolation.test.tsx 例 2）钉死：审计读 500 只亮
 *   `aud01-error`、矩阵存储面逐字不动、health 四读口零流量、重试后回绿。本文件不重写它，
 *   只补两条没人证过的：(a) 审计错误锚里那枚 rid 复制钮被真的点下去、写进剪贴板的是完整 rid
 *   且零额外请求（审计车道只钉了按钮存在：audit.paging R161 例 4、audit.error R213；
 *   全仓 grep 证明无人点过它）；(b) 矩阵行与采集时刻在屏上的逐字恒等（R224 只断言了存储面
 *   probe 节点，没断言过可见的 sys6 行文本与 asof 格）。
 * - 同批双失败与双恢复在 health 域内已由 R210（system.cross.isolation.test.tsx :199-229 各自
 *   rid、:274-285 同批回绿）钉死，但那不是跨面：两枚锚一枚是 sys 族、一枚是 aud 族，且
 *   `sys-updated-at` 只在刷新时刻更新这条腿从没和审计失败放进同一个会话里。R228 的往返两面
 *   都是绿的，没有失败态。⇒ ③ 是真缺口。
 * - 矩阵单读源失败的行面本身（该行 failed + `sys6-rid-<id>` 的 title 装完整 rid、兄弟行不动、
 *   摘要句）由 R148 例 2 / 例 3 与 R151 例 1 钉死；本文件按现状复述其形状，把力气花在跨面。
 *
 * 冻结族只读不破：sys3 / sys4-detail / sys5 / sys6 / sys7-export / sys8 / sys10 / sys13 /
 * sys15 / sys-refresh / sys-state / sys-row-copy / sys-copy-scope / hlt5 / ver5 / aud01 /
 * audF-state / aud2 / agent-v2-page-audit 各族（含其 testid）。本文件不新增任何 testid。
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

import { ApiError } from "@/lib/api-error";
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { ConsoleModulePage } from "@/shell/console";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix, useSourceMatrix } from "./sourceReads";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

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

const HEALTH_URL = "/agent-api/api/health";
const HEALTH_PATHS = [HEALTH_URL, "/agent-api/api/__health-probe__", "/agent-api/api/hermes-summary", "/agent-api/api/skills"];
const IDS = ["console", "domain", "health", "runtime"] as const;

const GEN1 = {
  health: { ok: true, asOf: "2026-11-19T15:17:09Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 },
  ] },
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
const EVENTS = {
  items: [{
    eventId: "evt_aaaa1111bbbb2222",
    event_type: "approval_approved",
    occurredAt: "2026-11-20T05:30:00Z",
    outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: "req-20261120-aaaa",
  }],
  nextCursor: null,
};

/** 两个失败开关：闭包按引用读它，所以挂载之后翻旗不需要重新 arm（挂载会盖掉先装的闭包）。 */
const flags: { health: string | null; audit: string | null } = { health: null, audit: null };

const RID_AUDIT = "req-xfail-audit";
const RID_HEALTH = "req-xfail-health";
const RID_HEALTH_BOTH = "req-xfail-both-h";
const RID_AUDIT_BOTH = "req-xfail-both-a";

type SourceKey = "audit" | "health" | "console" | "runtime" | "domain";

function keyOf(url: string): SourceKey {
  if (url.startsWith("/agent-api/api/audit")) return "audit";
  if (url === HEALTH_URL) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}

type Handler = (url: string) => unknown;
const switchable: Handler = (url) => {
  const key = keyOf(url);
  if (key === "audit") {
    if (url.includes("audit-detail")) return { audit: {} };
    const rid = flags.audit;
    if (rid) throw new ApiError("audit upstream exploded", { status: 500, body: "{}", url, requestId: rid });
    return EVENTS;
  }
  const healthRid = key === "health" ? flags.health : null;
  if (healthRid) throw new ApiError("health upstream exploded", { status: 500, body: "{}", url, requestId: healthRid });
  return GEN1[key] ?? {};
};

function arm(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => switchable(String(url ?? "undefined")));
}

function healthReads(): string[] {
  return api.fetchJSON.mock.calls
    .map((call) => String(call[0] ?? "undefined"))
    .filter((url) => url !== "undefined" && HEALTH_PATHS.includes(url));
}
function auditReads(): string[] {
  return api.fetchJSON.mock.calls
    .map((call) => String(call[0] ?? "undefined"))
    .filter((url) => url.startsWith("/agent-api/api/audit?"));
}
function totalReads(): number {
  return api.fetchJSON.mock.calls.filter((call) => call[0] !== undefined).length;
}

/** 只订阅矩阵存储的常驻证人；testid 前缀 probe- 不与任何冻结族撞名。耗时逐读抖动，折叠。 */
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

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}

function textOf(testid: string): string {
  return q(testid)?.textContent?.trim() ?? "";
}

/** 屏上的矩阵行整行文本；耗时列逐读抖动，折叠成占位。 */
function matrixRows(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>("[data-testid^='sys6-row-']")]) {
    const testid = node.getAttribute("data-testid")!;
    out[testid] = (node.textContent ?? "").replace(/\d+ ms/g, "<n> ms").trim();
  }
  return out;
}

function rowStatuses(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>("[data-testid^='sys6-row-']")]) {
    out[node.getAttribute("data-testid")!.replace("sys6-row-", "")] = node.getAttribute("data-status") ?? "";
  }
  return out;
}

/** 矩阵的采集时刻两枚面：外层 td 与内层 span。 */
function asOfFaces(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of IDS) {
    out[`sys6-asof-${id}`] = textOf(`sys6-asof-${id}`);
    out[`sys8-asof-${id}`] = textOf(`sys8-asof-${id}`);
  }
  return out;
}

function paintedRows(): string[] {
  return [...container.querySelectorAll<HTMLElement>("[data-testid^='aud01-row-']")].map((node) =>
    node.getAttribute("data-testid")!.replace("aud01-row-", ""),
  );
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function tabButton(tabId: string): HTMLButtonElement | HTMLAnchorElement | null {
  return container.querySelector(`[role="tab"][data-tab="${tabId}"]`);
}

async function click(node: Element | null, label: string): Promise<void> {
  if (!node) throw new Error(`missing clickable node: ${label}`);
  await act(async () => {
    (node as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** 点审计错误锚里的 rid 复制钮，返回真正写进剪贴板的那串。 */
async function copyAuditRid(): Promise<string> {
  const anchor = q("aud01-error-request-id");
  if (!anchor) throw new Error("missing node [data-testid='aud01-error-request-id']");
  const button = anchor.querySelector<HTMLButtonElement>("button[aria-label='复制请求编号']");
  if (!button) throw new Error("missing the rid copy button inside the audit error anchor");
  clipboard.copyTextToClipboard.mockClear();
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, "the rid copy landed in the clipboard");
  return String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? "");
}

async function clickAuditRetry(): Promise<void> {
  const retry = [...container.querySelectorAll<HTMLButtonElement>("[data-testid='aud01-error'] button")].find(
    (node) => node.textContent?.includes("重试"),
  );
  await click(retry ?? null, "审计失败锚里的重试");
}

function mount(entry = "/system?tab=health"): void {
  arm();
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <StoreProbe />
        <ConsoleModulePage
          module="system"
          live={{ health: <HealthPage />, events: <AuditEventsModulePage />, defaults: <div />, version: <div /> }}
        />
      </MemoryRouter>,
    );
  });
}

async function settleHealthReady(): Promise<void> {
  await waitFor(() => !!q("sys3-table"), "health surface ready");
  await waitFor(() => Object.values(probeFaces()).every((face) => face.startsWith("ok|")), "matrix store settled green");
}

async function settleHealthFailed(): Promise<void> {
  await waitFor(() => !!q("sys3-error"), "health list read landed in its error panel");
  await waitFor(
    () => Object.values(probeFaces()).every((face) => face.startsWith("ok|") || face.startsWith("failed|")),
    "matrix store settled with the failure",
  );
}

async function settleEvents(): Promise<void> {
  await waitFor(
    () => !!q("aud01-error") || paintedRows().length > 0,
    "audit surface settled (rows or its own failure anchor)",
  );
}

describe("R229 — 两表失败各自独立：锚、rid 复制、屏上矩阵面与恢复", () => {
  it("an audit read failing gives a readable line with a copyable full rid at zero extra reads, and the matrix rows and stamps stay verbatim", async () => {
    mount();
    await settleHealthReady();
    const faces = probeFaces();
    const rowsBefore = matrixRows();
    const asOfBefore = asOfFaces();
    const summaryBefore = textOf("sys6-summary");
    const healthBefore = healthReads().length;
    expect(Object.keys(faces).sort()).toEqual(["probe-console", "probe-domain", "probe-health", "probe-runtime"]);
    expect(healthReads()).toHaveLength(4);
    expect(auditReads(), "事件表还没挂过").toHaveLength(0);
    expect(Object.keys(rowsBefore), "屏上有四行矩阵才谈得上「逐字不变」").toHaveLength(4);

    flags.audit = RID_AUDIT;
    await click(tabButton("events"), "事件表 tab");
    await waitFor(() => !!q("aud01-error"), "审计失败锚亮起");

    // 可读错误行：一句人话，不是裸状态码也不是空壳。
    const sentence = textOf("aud01-error-sentence");
    expect(sentence.length, "错误行必须有文本").toBeGreaterThan(0);
    expect(sentence).toContain("审计服务在处理时出了错");
    // 可复制 rid：锚里那枚钮点下去，剪贴板拿到的是完整 rid。
    const ridLine = textOf("aud01-error-request-id");
    expect(ridLine).toContain(RID_AUDIT);
    const readsAtFailure = totalReads();
    const copied = await copyAuditRid();
    expect(copied, "复制的是完整请求编号，不是短码").toBe(RID_AUDIT);
    expect(textOf("aud01-error-request-id-value")).toContain("已复制");
    expect(totalReads(), "复制一次不花任何请求").toBe(readsAtFailure);

    // 互不污染：health 的四个读口在审计失败期间零流量，矩阵存储面一字不动。
    expect(healthReads()).toHaveLength(healthBefore);
    expect(probeFaces()).toEqual(faces);
    // 屏上的 health 族锚此刻不存在（live 槽互斥，health 面被卸载）——常驻证人是存储面。
    expect(q("sys-refresh-error")).toBeNull();
    expect(q("sys-state-state")).toBeNull();

    // 恢复审计，再回 health：屏上矩阵行与采集时刻逐字回到失败前，摘要句也不变。
    flags.audit = null;
    await clickAuditRetry();
    await waitFor(() => paintedRows().length > 0, "审计重试后行回来了");
    expect(q("aud01-error")).toBeNull();
    expect(probeFaces(), "审计恢复不动 health 的面").toEqual(faces);

    await click(tabButton("health"), "health tab");
    await waitFor(() => !!q("sys3-table"), "回到 health 重挂");
    expect(matrixRows(), "矩阵各行逐字与失败前相同").toEqual(rowsBefore);
    expect(asOfFaces(), "采集时刻两枚面逐字与失败前相同").toEqual(asOfBefore);
    expect(textOf("sys6-summary")).toBe(summaryBefore);
    expect(probeFaces()).toEqual(faces);
    // 产品真相：health 页没有模块级缓存，回来是重读一整批（与 capabilities 的 tab 缓存相反）。
    expect(healthReads()).toHaveLength(healthBefore + 4);
    expect(auditReads(), "事件表只花了失败一笔加重试一笔").toHaveLength(2);
  });

  it("a single failing health read reddens only its own matrix row with its rid, and the events surface still paints its own rows on its own single read", async () => {
    flags.health = RID_HEALTH;
    mount();
    await settleHealthFailed();
    const facesFailed = probeFaces();
    expect(facesFailed["probe-health"], "失败行的存储面带完整 rid").toBe(`failed|—|${RID_HEALTH}`);
    for (const id of ["console", "runtime", "domain"] as const) {
      expect(facesFailed[`probe-${id}`]).toMatch(/^ok\|\d{4}-\d{2}-\d{2} \d{2}:\d{2}\|$/);
    }
    // 仅该行变红 + rid，兄弟行状态一位不动（行面本身由 R148 例 2/例 3 钉死，这里按现状复述形状）。
    expect(rowStatuses()).toEqual({ console: "ok", domain: "ok", health: "failed", runtime: "ok" });
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 3 · 失败 1 · 读口未接入 0");
    expect(q("sys6-rid-health")?.getAttribute("title"), "完整 rid 只在 title").toBe(RID_HEALTH);
    expect(textOf("sys6-asof-health")).toBe("—");
    expect(q("sys3-error")).toBeTruthy();
    expect(textOf("sys3-request-id")).toContain(RID_HEALTH);
    expect(q("sys-updated-at"), "失败不写刷新时刻").toBeNull();
    expect(q("aud01-error"), "事件面还没挂过").toBeNull();
    const healthAtFail = healthReads().length;
    expect(healthReads()).toHaveLength(4);

    // 跨面那一腿（派工单 ② 的真实可测形态）：事件面自己挂上、自己读、照常画行。
    await click(tabButton("events"), "事件表 tab");
    await settleEvents();
    expect(q("aud01-error"), "health 的失败不点亮审计锚").toBeNull();
    expect(paintedRows().length, "事件表行数来自它自己那一笔读").toBeGreaterThan(0);
    expect(textOf("aud01-status")).toContain("已显示 1 条");
    expect(auditReads()).toHaveLength(1);
    expect(healthReads(), "health 的失败没多花一笔，也没被审计面重读").toHaveLength(healthAtFail);
    expect(probeFaces(), "审计面一个字都没写进矩阵存储").toEqual(facesFailed);
    expect(
      container.querySelectorAll("[data-testid^='sys-evt']"),
      "派工单的 sys-evt-count 本代不存在（第 22 条道）",
    ).toHaveLength(0);
  });

  it("both surfaces failing in one session keep two independent anchors with two independently copyable rids, and each recovers on its own while the read stamp stays the only clock that moves", async () => {
    vi.useFakeTimers({ now: new Date("2030-06-01T00:00:00Z"), toFake: ["Date"] });
    flags.health = RID_HEALTH_BOTH;
    flags.audit = RID_AUDIT_BOTH;
    mount();
    await settleHealthFailed();
    const facesHealthFail = probeFaces();
    expect(facesHealthFail["probe-health"]).toBe(`failed|—|${RID_HEALTH_BOTH}`);
    expect(q("sys3-error")).toBeTruthy();
    expect(textOf("sys3-request-id")).toContain(RID_HEALTH_BOTH);
    expect(q("sys-updated-at")).toBeNull();
    const healthReadsAtFail = healthReads().length;

    await click(tabButton("events"), "事件表 tab");
    await waitFor(() => !!q("aud01-error"), "审计失败锚亮起");
    // 两枚锚各自独立：审计锚只带自己的 rid，不吞 health 的。
    expect(textOf("aud01-error-sentence")).toContain("审计服务在处理时出了错");
    expect(textOf("aud01-error-request-id")).toContain(RID_AUDIT_BOTH);
    // 负向只圈审计锚：容器里 health 的 rid 是矩阵存储探针（probe- 面）的合法证词，不在排除范围。
    expect(q("aud01-error")?.textContent ?? "", "审计锚里不出现 health 的 rid").not.toContain(RID_HEALTH_BOTH);
    // 各自可复制：审计这枚的复制钮写完整 rid 且零额外请求。
    const readsBeforeCopy = totalReads();
    expect(await copyAuditRid()).toBe(RID_AUDIT_BOTH);
    expect(totalReads(), "复制不花请求").toBe(readsBeforeCopy);
    // health 那枚 rid 的常驻证人是存储面（屏上面被卸载）；它没被审计失败改写。
    expect(probeFaces()).toEqual(facesHealthFail);
    expect(healthReads()).toHaveLength(healthReadsAtFail);
    expect(q("sys-refresh-error"), "审计失败不产 health 族的锚").toBeNull();

    // 先恢复审计：health 的失败面照旧。
    flags.audit = null;
    await clickAuditRetry();
    await waitFor(() => paintedRows().length > 0, "审计恢复");
    expect(q("aud01-error")).toBeNull();
    expect(probeFaces(), "审计恢复不动 health 的失败面").toEqual(facesHealthFail);

    // 回 health：重挂重读，仍带失败旗标 ⇒ 失败面复现，rid 锚还在。
    await click(tabButton("health"), "health tab");
    await settleHealthFailed();
    expect(textOf("sys3-request-id")).toContain(RID_HEALTH_BOTH);
    expect(rowStatuses()).toEqual({ console: "ok", domain: "ok", health: "failed", runtime: "ok" });

    // 再恢复 health：先撤旗标，单读源重试只多它自己那一笔，行面回绿、rid 撤下。
    flags.health = null;
    const readsAtRetry = totalReads();
    await click(q<HTMLButtonElement>("sys3-retry"), "健康清单的重试");
    await waitFor(() => !!q("sys3-table"), "health 回绿");
    expect(q("sys3-error")).toBeNull();
    expect(q("sys6-rid-health")).toBeNull();
    expect(rowStatuses()).toEqual({ console: "ok", domain: "ok", health: "ok", runtime: "ok" });
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");
    expect(probeFaces()["probe-health"]).toBe("ok|2026-11-19 23:17|");
    expect(totalReads(), "重试只发这一笔").toBe(readsAtRetry + 1);

    // 刷新时刻只在刷新时更新，且不等于任何采集时刻。
    await click(q<HTMLButtonElement>("sys-refresh"), "页级刷新");
    await waitFor(() => !!q("sys-updated-at"), "刷新时刻落地");
    const stamp = textOf("sys-updated-at");
    expect(stamp).toContain("（读取时刻，不是数据时刻）");
    expect(stamp).toContain("2030-06-01 08:00");
    for (const face of Object.values(probeFaces())) {
      const asOf = face.split("|")[1] ?? "";
      expect(stamp, `刷新时刻 ${stamp} 不该含采集时刻 ${asOf}`).not.toContain(asOf);
    }
    expect(q("sys-refresh-error"), "两枚锚此刻都该是撤下的").toBeNull();
  });
});
