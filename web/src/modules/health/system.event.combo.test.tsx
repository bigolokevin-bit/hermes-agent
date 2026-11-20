// @vitest-environment jsdom
/**
 * R228 — /system 事件表时间窗 × tab 组合护栏（纯测试，零产品码改动）。
 *
 * 派工单点名的三值等式里，两腿本代不存在（第 21 条道复核）：
 * `git grep -n "sys-evt\|sysEventCopyText\|evt-copy\|evt-more\|evt-count" -- web/src` 的命中
 * 全是既有用例里记录缺失的注释与我自己的缺失断言——
 * system.window.isolation.test.tsx:6 / :7 / :231 / :299，system.cross.isolation.test.tsx:6 / :7 / :12，
 * system.empty.test.tsx:13，system.event.export.test.tsx:5 / :6 / :46 / :260，
 * system.event.rows.test.tsx:6 / :7 / :207，system.time.test.tsx:8，
 * system.matrix.export.test.tsx:6，system.state.isolation.test.tsx:18，system.filters.test.tsx:14。
 * health 模块没有事件表，`sys-evt-count` / `sys-evt-copy-<i>` 无产品对应物；本文件只断言它们
 * 「不存在」，绝不编造。事件面的真身是 modules/audit/AuditEventsModulePage（页级锚 agent-v2-page-audit），
 * 文件按派工单落在 modules/health 下，跨模块挂载沿用 R135 / R221 / R224-first 的习语，audit 与 shell 只读不改。
 *
 * ① 只回证据不重写：R135 system.filters.test.tsx ① 已钉「?tab=events&window=24h 深链回填按下窗、
 * 请求边界逐字等于 windowBounds(key, NOW)、地址一字不改、页级锚在」，③b 已钉非法 window 静默折成
 * DEFAULT_WINDOW 且不改写 URL；R225 system.event.rows.test.tsx ① 已钉复合地址上 aud01-status /
 * aud2-page / aud2-total 与表体同数、无 cursor 的首读。一个 7d 到达是这两半的第三次实例，
 * 再加用例就是重复覆盖。
 *
 * ② 的真缺口：没人做过 events → health → events 的往返。R224-first 只钉了 health→events
 * （health 四条路径零流量、矩阵面冻结）与 events→health（离开后审计零流量、回来重读一整批）。
 * 口径更正（与产品一致，与派工单字面相反）：事件面没有模块级缓存（useAuditData 是每实例 state），
 * 而 shell 的 health / events 是互斥 live 槽（App.tsx:1625 vs :1628），所以「回到 events」必然
 * 重新挂载并多发它自己那一笔审计读；行集与页码之所以不变，靠的是 shell preserve memo 把 cursor=
 * 原样带过 tab 切换（R161 ① :243 钉过冷地址带 cursor 只读那一页一次），不是靠状态被保住。
 * 「切 tab 本身零新增请求」对离去方向成立、对返回方向不成立。
 *
 * ③ 的另一半口径更正：读源矩阵不吃 ?window=（全仓产品读者只有 audit / duty / runs），所以非法
 * 窗口令它对矩阵是惰性的——矩阵保持满配、不落空态。派工单的「矩阵落入可读空态」与产品相反。
 * 真正没人钉的是：非法窗口下事件表按折叠后的默认窗提问、并把默认窗的真实答案如实报出
 * （空答复给一句可读句子，不冒充裸 0），且同一次会话里切回矩阵时地址不被任何一侧改写。
 * 实测的形状：切回矩阵后地址只剩 /system?window=__nope__ —— 被抹掉的只有 tab= 本身，因为
 * health 是 system 模块的默认 pane、它的 tab 条链接按 routes.ts 的规范哈希不带 tab=；那个非法
 * window token 一路活到底，正好是「两侧都不串写对方参数」的可观察证据。
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

import { DEFAULT_WINDOW, windowBounds } from "@/modules/audit/window";
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

/** 事件表两页：第 2 页与第 1 页共享 MID 一行，尾行只在第 2 页——换代与去重都可观察。 */
function rowOf(eventId: string, at: string, requestId: string | null): Record<string, unknown> {
  return {
    eventId,
    event_type: "approval_approved",
    occurredAt: at,
    outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    ...(requestId ? { requestId } : {}),
  };
}
const FRESH = "evt_aaaa1111bbbb2222";
const MID = "evt_bbbb2222cccc3333";
const TAIL = "evt_cccc3333dddd4444";
const PAGE1 = { items: [rowOf(FRESH, "2026-11-20T05:30:00Z", "req-combo-1"), rowOf(MID, "2026-11-19T05:00:00Z", "req-combo-2")], nextCursor: "cur_rows2" };
const PAGE2 = { items: [rowOf(MID, "2026-11-19T05:00:00Z", "req-combo-2"), rowOf(TAIL, "2026-11-18T04:00:00Z", null)], nextCursor: null };
const EMPTY = { items: [], nextCursor: null };

type SourceKey = "audit" | "health" | "console" | "runtime" | "domain";
function keyOf(url: string): SourceKey {
  if (url.startsWith("/agent-api/api/audit")) return "audit";
  if (url === HEALTH_URL) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}

/** 事件面之外只有四个读口键；`keyOf` 的联合里还带着 "audit"，直接拿它索引 GEN1 会被 tsc 判 TS7053。 */
type HealthKey = "console" | "domain" | "health" | "runtime";
function healthKeyOf(url: string): HealthKey {
  const key = keyOf(url);
  return key === "audit" ? "health" : key;
}

type Handler = (url: string) => unknown;
const pagedHandler: Handler = (url) => {
  if (keyOf(url) === "audit") return url.includes("audit-detail") ? { audit: {} } : paramOf(url, "cursor") === "cur_rows2" ? PAGE2 : PAGE1;
  return GEN1[healthKeyOf(url)] ?? {};
};
const emptyWindowHandler: Handler = (url) => {
  if (keyOf(url) === "audit") return url.includes("audit-detail") ? { audit: {} } : EMPTY;
  return GEN1[healthKeyOf(url)] ?? {};
};

/** arm 只换实现不清调用历史，所以跨动作计量读数靠它。 */
function arm(handler: Handler): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => handler(String(url ?? "undefined")));
}

function allUrls(): string[] {
  return api.fetchJSON.mock.calls.map((call) => String(call[0] ?? "undefined")).filter((url) => url !== "undefined");
}
function healthReads(): string[] {
  return allUrls().filter((url) => HEALTH_PATHS.includes(url));
}
function auditReads(): string[] {
  return allUrls().filter((url) => url.startsWith("/agent-api/api/audit?"));
}
function paramOf(url: string, key: string): string | null {
  const query = url.slice(url.indexOf("?") + 1);
  return new URLSearchParams(query).get(key);
}
function cursorsOf(url: string): string[] {
  const query = url.slice(url.indexOf("?") + 1);
  return new URLSearchParams(query).getAll("cursor");
}
function boundsOf(url: string): { from: string | null; to: string | null } {
  return { from: paramOf(url, "from"), to: paramOf(url, "to") };
}

/** 只订阅矩阵存储的常驻证人；testid 前缀 probe- 不与任何冻结族撞名。 */
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
  return <span data-testid="combo-location">{`${loc.pathname}${loc.search}`}</span>;
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

function paintedRows(): string[] {
  return [...container.querySelectorAll("[data-testid^='aud01-row-']")].map((node) => node.getAttribute("data-testid")!.replace("aud01-row-", ""));
}
function textOf(testid: string): string {
  return container.querySelector(`[data-testid='${testid}']`)?.textContent?.trim() ?? "";
}
function address(): string {
  return textOf("combo-location");
}

function mount(entry: string, handler: Handler): void {
  arm(handler);
  act(() => {
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
}

async function settleHealth(): Promise<void> {
  await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "health surface ready");
  await waitFor(() => Object.values(probeFaces()).every((face) => face.startsWith("ok|")), "matrix store settled");
}
async function settleEvents(): Promise<void> {
  await waitFor(() => !!container.querySelector("[data-testid^='aud01-row-']") || !!container.querySelector("[data-testid='aud01-empty']"), "audit surface settled");
}

describe("R228 ② — events → health → events 往返：行集与页码靠地址里的 cursor 复原，矩阵面不被事件侧写", () => {
  it("翻页之后切到矩阵再切回来，事件表重挂只多发它自己一笔读，第 2 页行集逐字复原，矩阵存储面一字不动", async () => {
    mount("/system?tab=health", pagedHandler);
    await settleHealth();
    const faces = probeFaces();
    expect(Object.keys(faces).sort()).toEqual(["probe-console", "probe-domain", "probe-health", "probe-runtime"]);
    expect(faces["probe-health"]).toBe("ok|2026-11-19 23:17|");
    const healthBefore = healthReads().length;

    await click(tabButton("events"), "事件表 tab");
    await settleEvents();
    expect(paintedRows(), "首载是第 1 页").toEqual([FRESH, MID]);
    expect(auditReads()).toHaveLength(1);
    expect(cursorsOf(auditReads()[0]!), "第 1 页不带 cursor").toEqual([]);
    expect(textOf("aud2-page")).toContain("第 1 页");
    const healthAtEvents = healthReads().length;

    await click(container.querySelector("[data-testid='aud01-load-more']"), "翻到第 2 页");
    await waitFor(() => paintedRows()[0] === MID, "第 2 页上色");
    expect(paintedRows()).toEqual([MID, TAIL]);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(cursorsOf(auditReads()[auditReads().length - 1]!)).toEqual(["cur_rows2"]);
    expect(address(), "页码写在地址里：cursor= 还在").toContain("cursor=cur_rows2");
    const auditBeforeLeave = auditReads().length;
    const facesOnEvents = probeFaces();
    expect(facesOnEvents, "事件表活跃期间矩阵面还是那四个 ok").toEqual(faces);

    // 离去：health 卸载，事件侧不新增任何 health 流量；矩阵存储面由 health 的四条读独占，事件侧写不了它。
    await click(tabButton("health"), "health tab（离去）");
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "health 重新挂载并读完");
    expect(auditReads(), "离开事件表后它的路径再没有流量").toHaveLength(auditBeforeLeave);
    expect(probeFaces(), "离去方向：矩阵面逐字不动").toEqual(faces);
    const healthAfterReturn = healthReads().length;
    expect(healthAfterReturn, "health 页没有模块缓存，回来重读一整批（R224-first 同口径）").toBeGreaterThan(healthAtEvents);

    // 返回：事件面重新挂载必然再问一次；第 2 页是被地址里的 cursor= 复原的，不是被保住的组件状态。
    await click(tabButton("events"), "事件表 tab（返回）");
    await waitFor(() => paintedRows()[0] === MID && paintedRows().length === 2, "第 2 页靠 cursor 复原");
    expect(paintedRows(), "② 行集逐字是第 2 页那一组，无旧行残留、无重复行").toEqual([MID, TAIL]);
    expect(new Set(paintedRows()).size).toBe(paintedRows().length);
    expect(textOf("aud2-page")).toContain("第 2 页");
    expect(auditReads(), "② 返回只多发它自己的一笔审计读（派工单的「零新增」只对离去方向成立）").toHaveLength(auditBeforeLeave + 1);
    expect(cursorsOf(auditReads()[auditReads().length - 1]!), "那一笔带着同一个 cursor").toEqual(["cur_rows2"]);
    expect(address(), "往返后地址仍带 tab=events 与那个 cursor，一字不改").toContain("cursor=cur_rows2");
    expect(probeFaces(), "② 矩阵 asof 不被事件侧串写：整趟往返还是那四个 ok 与它们的时刻").toEqual(faces);
    expect(healthReads(), "事件表活跃期间 health 四条路径零新增").toHaveLength(healthAfterReturn);
    expect(container.querySelectorAll("[data-testid^='sys-evt']"), "sys-evt 族本代不存在（第 21 条道）").toHaveLength(0);
    expect(healthBefore).toBe(4);
  });
});

describe("R228 ③ — 非法 ?window= 对两面的真实后果：事件侧折成默认窗，矩阵侧惰性", () => {
  it("折成默认窗提问、空答复是一句可读句子而不是裸 0，URL 不被改写，页级锚在，矩阵根本不吃这个参数", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-20T06:00:00.000Z"), toFake: ["Date"] });
    const entry = "/system?tab=events&window=__nope__";
    mount(entry, emptyWindowHandler);
    await settleEvents();

    expect(container.querySelectorAll("[data-testid^='aud01-row-']"), "默认窗这次真的没有条目").toHaveLength(0);
    expect(container.querySelector("[data-testid='aud01-empty']"), "空态锚在").not.toBeNull();
    const status = textOf("aud01-status");
    expect(status.length, "空态给的是句子，不是裸数字").toBeGreaterThan(0);
    expect(status, "读数条不冒充「0 条」").not.toContain("0 条");
    expect(container.textContent, "屏上不出现裸 0 计数的空态写法").not.toContain("共 0 条");
    expect(container.querySelector("[data-testid='agent-v2-page-audit']"), "页级锚仍在").not.toBeNull();

    const reads = auditReads();
    expect(reads, "非法窗口不产生第二笔读，也不因为参数非法就不读").toHaveLength(1);
    expect(cursorsOf(reads[0]!), "没有 cursor 外溢").toEqual([]);
    expect(boundsOf(reads[0]!), "③ 提问用的是折叠后默认窗的边界").toEqual(windowBounds(DEFAULT_WINDOW, new Date("2026-11-20T06:00:00.000Z")));
    expect(paramOf(reads[0]!, "window"), "window 不进请求：请求带的是算好的 from/to").toBeNull();
    expect(address(), "③ 非法 token 原样留在地址里，页面不改写 URL").toBe(entry);

    // 切到矩阵：同一个非法窗口对它是惰性的——矩阵照旧满配，不落空态，也不被写「—」。
    await click(tabButton("health"), "health tab");
    await settleHealth();
    // 地址里唯一被抹掉的是 tab= 本身：health 是 system 模块的默认 pane，它的 tab 条链接按
    // routes.ts 的规范哈希不带 tab=；非法 window token 原样活下来，因为事件侧从不写别人的键、
    // 矩阵侧根本不读它。这就是「不串写」的可观察形式。
    expect(address(), "切 tab 只丢掉默认 pane 的 tab=，非法 token 原样保留").toBe("/system?window=__nope__");
    expect(container.querySelectorAll("[data-testid^='sys6-row-']"), "矩阵四行都在，没有因非法窗口少行").toHaveLength(4);
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");
    expect(container.querySelector("[data-testid='sys-search-source-empty']"), "矩阵没有可读空态可落").toBeNull();
    expect(container.querySelector("[data-testid='sys3-empty']"), "服务清单也不是空态").toBeNull();
    for (const face of Object.values(probeFaces())) {
      expect(face, "③ 矩阵行不被非法窗口写成「—」冒充").not.toContain("|—|");
      expect(face.startsWith("ok|")).toBe(true);
    }
    expect(healthReads()).toHaveLength(4);
    expect(container.querySelectorAll("[data-testid^='sys-evt']"), "sys-evt 族本代不存在（第 21 条道）").toHaveLength(0);
  });
});
