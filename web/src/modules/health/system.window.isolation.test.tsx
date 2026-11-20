// @vitest-environment jsdom
/**
 * R224 — /system 读源矩阵与事件表跨面互不污染（纯测试，零产品码改动）。
 *
 * 先查既有用例（派工单纪律）：
 * - `sys-evt-copy-*` / health 事件表本代不存在（第 19 条道确认）：`git grep -n
 *   "sys-evt\|sysEventCopyText\|evt-copy\|evt-more\|evt-count" -- web/src` 命中 12 处，
 *   全部是既有注脚（cross.isolation:6/7/12、empty:13、event.export:5/6/46/260、filters:14、
 *   matrix.export:6、state.isolation:18、time:8），零产品码。health 也没有 `?window=`：
 *   唯一读者是 `modules/audit/AuditEventsModulePage`（R135/R202/R218 已证），所以派工单 ②
 *   的「只切矩阵读源时间窗」没有产品机制——矩阵的时间窗就是事件表的，反过来不成立。
 *   诚实改写：② = 「切事件表的时间窗时，矩阵的存储面一字不动」。
 * - 两处同挂一个 DOM 从来没有过：既有健康用例只挂 `HealthPage`（empty/matrix.export/time/
 *   rowcopy/refresh/retry/state.isolation/cross.isolation），审计面用例只挂
 *   `AuditEventsModulePage`（filters/event.export 与 aud 车道全体）。shell 的 live 槽
 *   （App.tsx `health:` vs `events:`）互斥，同屏永远只见一面——本文件用
 *   `ConsoleModulePage module="system" live={{health, events}}` 复刻 shell 的换槽方式，
 *   用一个只订阅 `useSourceMatrix()` 的探针组件当跨挂载的常驻证人。
 * - 同批双失败/双恢复在 health 域内已由 R210 钉死（:199-229 各自 rid、:274-285 同批回绿）；
 *   刷新时刻 ≠ 任何采集时刻由 R112 ① / R148 ① / R171 ② 钉死。本文件不重写这些，只补三个
 *   没人证过的事实：
 *   (1) 事件表活跃期间，health 的四个读口路径零流量，矩阵存储面（状态/采集时刻/rid）逐字不动；
 *   (2) 事件表换窗（30d←24h）只多发它自己的一条审计读，矩阵面照旧一字不动；
 *   (3) 审计读 500 只亮它自己的 `aud01-error` 锚，不清矩阵、不写「—」、不产 health 族的锚；
 *       恢复后回 health 是新一代数据（探针换代），刷新时刻仍不等于任何采集时刻——而「两处同绿」
 *       的本代真实形态只能是各自 tab 绿（互斥槽），如实按产品断言。
 * - 派工单 ① 的「切回零增」按产品成立的方向断言：离开 health 期间它的读口不再被调用；
 *   回到 health 会重读一整批（health 页没有模块级缓存，这与 capabilities 的 tab 缓存相反）。
 *
 * 冻结族只读不破：sys3、sys4-detail、sys5、sys6、sys7-export、sys8、sys10、sys13、sys15、
 * sys-refresh、sys-state、sys-row-copy、hlt5、aud01、agent-v2-page-audit 各族（含其 testid）。
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
  health: { ok: true, asOf: "2026-11-19T15:17:09Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 },
  ] },
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
const GEN2 = {
  ...GEN1,
  health: { ok: true, asOf: "2026-11-20T00:05:00Z", sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 },
    { id: "svc-c", name: "审批服务", status: "ok", version: "1.0.0", latencyMs: 9 },
  ] },
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

type SourceKey = "audit" | "health" | "console" | "runtime" | "domain";

function keyOf(url: string): SourceKey {
  if (url.startsWith("/agent-api/api/audit")) return "audit";
  if (url === HEALTH_URL) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}

type Handler = (url: string) => unknown;
const baseHandler: Handler = (url) => {
  const key = keyOf(url);
  if (key === "audit") return url.includes("audit-detail") ? { audit: {} } : EVENTS;
  return GEN1[key] ?? {};
};
function arm(handler: Handler = baseHandler): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => handler(String(url ?? "undefined")));
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

function mount(): void {
  arm();
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/system?tab=health"]}>
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

describe("R224 — 事件表活跃期间，矩阵存储面与 health 读口零污染", () => {
  it("switching to the events tab asks nothing of health's four paths and freezes the matrix faces", async () => {
    mount();
    await settleHealth();
    const faces = probeFaces();
    expect(Object.keys(faces).sort()).toEqual(["probe-console", "probe-domain", "probe-health", "probe-runtime"]);
    expect(faces["probe-health"]).toBe("ok|2026-11-19 23:17|");
    expect(faces["probe-console"]).toBe("ok|2026-11-19 09:30|");
    expect(faces["probe-runtime"]).toBe("ok|2026-11-19 10:45|");
    expect(faces["probe-domain"]).toBe("ok|2026-11-19 12:15|");
    expect(healthReads()).toHaveLength(4);
    expect(auditReads(), "事件表还没挂载过").toHaveLength(0);
    expect(container.querySelector("[data-testid='sys-updated-at']"), "没点过刷新就没有读取时刻").toBeNull();

    await click(tabButton("events"), "事件表 tab");
    await waitFor(() => !!container.querySelector("[data-testid^='aud01-row-']"), "audit list painted");
    expect(auditReads()).toHaveLength(1);
    expect(healthReads(), "① 事件表活跃期间 health 四条路径零新增").toHaveLength(4);
    expect(probeFaces(), "① 矩阵面逐字不动").toEqual(faces);
    expect(container.querySelector("[data-testid='sys-updated-at']"), "health 卸载后刷新锚不在屏（互斥槽）").toBeNull();
    expect(container.querySelectorAll("[data-testid^='sys-evt']"), "② 的 `sys-evt-copy-*` 本代不存在（第 19 条道）").toHaveLength(0);

    await click(container.querySelector("[data-testid='aud01-filter-window-30d']"), "换到 30d 窗");
    await waitFor(() => auditReads().length === 2, "换窗只多发它自己的一条审计读");
    expect(healthReads(), "② 换窗不碰 health 的任何路径").toHaveLength(4);
    expect(probeFaces(), "② 矩阵面照旧一字不动（health 没有时间窗，事件表的窗更不是它的）").toEqual(faces);
  });

  it("an audit read failing lights only its own anchor and never clears or dashes the matrix", async () => {
    let failAudit = false;
    mount();
    await settleHealth();
    const faces = probeFaces();
    await click(tabButton("events"), "事件表 tab");
    await waitFor(() => !!container.querySelector("[data-testid^='aud01-row-']"), "audit list painted");

    // mount() re-arms the default handler — a failure handler armed before it is silently
    // replaced, and the window click would then just succeed into a repaint (measured: the
    // read fires, rows stay painted, no aud01-error ever lands). Install it after mount.
    // arm() only replaces the implementation; call history survives, so the read meters
    // still compare against the same counters.
    arm((url) => {
      if (keyOf(url) === "audit" && failAudit) {
        throw new ApiError("audit upstream exploded", { status: 500, body: "{}", url, requestId: "req-iso-audit" });
      }
      return baseHandler(url);
    });
    failAudit = true;
    await click(container.querySelector("[data-testid='aud01-filter-window-30d']"), "换窗触发一次失败的审计读");
    await waitFor(() => !!container.querySelector("[data-testid='aud01-error']"), "审计失败锚亮起");
    expect(container.textContent, "rid 在审计自己的锚里可读").toContain("req-iso-audit");
    expect(probeFaces(), "③ 一处失败不清另一处：矩阵面逐字还是那四个 ok").toEqual(faces);
    expect(container.querySelector("[data-testid='sys-refresh-error']"), "health 族的错误锚不得被审计失败点亮").toBeNull();
    expect(container.querySelector("[data-testid='sys-state-state']")).toBeNull();
    expect(healthReads()).toHaveLength(4);

    failAudit = false;
    const retry = [...container.querySelectorAll<HTMLButtonElement>("[data-testid='aud01-error'] button")].find(
      (button) => button.textContent?.includes("重试"),
    );
    await click(retry ?? null, "审计失败块里的重试");
    await waitFor(() => !!container.querySelector("[data-testid^='aud01-row-']"), "重试后事件行重新上色");
    expect(container.querySelector("[data-testid='aud01-error']")).toBeNull();
    expect(probeFaces(), "恢复全程矩阵面依旧一字不动，也没有半路「—」").toEqual(faces);
    expect(healthReads()).toHaveLength(4);
  });

  it("coming back to health re-reads its own batch into a new generation, and the read stamp equals no data face", async () => {
    mount();
    await settleHealth();
    const faces = probeFaces();
    await click(tabButton("events"), "事件表 tab");
    await waitFor(() => !!container.querySelector("[data-testid^='aud01-row-']"), "audit list painted");
    const auditTotal = auditReads().length;

    // 回 health：产品真相是重读一整批（health 页没有模块级缓存，与 capabilities 的 tab 缓存相反）。
    arm((url) => {
      const key = keyOf(url);
      if (key === "audit") return url.includes("audit-detail") ? { audit: {} } : EVENTS;
      return GEN2[key] ?? {};
    });
    await click(tabButton("health"), "health tab");
    await waitFor(() => !!container.querySelector("[data-testid='sys3-table']"), "health 重新挂载并读完");
    expect(auditReads(), "离开事件表后它的路径再没有流量").toHaveLength(auditTotal);
    expect(probeFaces(), "④ 探针换到新一代（health 行跟着新 asOf 走）").not.toEqual(faces);
    expect(probeFaces()["probe-health"]).toBe("ok|2026-11-20 08:05|");
    expect(probeFaces()["probe-console"]).toBe("ok|2026-11-19 09:30|");
    expect(healthReads()).toHaveLength(8);
    expect(container.querySelectorAll("[data-testid^='sys-evt']")).toHaveLength(0);

    await click(container.querySelector("[data-testid='sys-refresh']"), "页级刷新");
    await waitFor(() => !!container.querySelector("[data-testid='sys-updated-at']"), "读取时刻落下");
    const stamp = container.querySelector("[data-testid='sys-updated-at']")?.textContent ?? "";
    expect(stamp).toContain("（读取时刻，不是数据时刻）");
    for (const face of Object.values(probeFaces())) {
      const asOf = face.split("|")[1];
      expect(stamp, "④ 刷新时刻不等于任何采集时刻面").not.toContain(asOf ?? "—");
    }
  });
});
