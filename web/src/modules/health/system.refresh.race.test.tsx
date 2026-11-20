// @vitest-environment jsdom
/**
 * R230 — /system 刷新并发与批次隔离（纯测试，零产品码改动）
 *
 * 派工单三例的现查结论（先 git grep 既有用例，已覆盖只回证据与缺口）：
 *
 * ①「连点只发一批」已由 R112 `system.refresh.test.tsx` 例③ 钉住（三击只发一批、
 *    每读口计数 {2,2,2,2}、`sys-busy-note` 一枚、按钮 busy 期 disabled）。但它两批喂的是
 *    同一份 payload，也没有比过屏上内容 ⇒「落屏只保留最后一批」是本代缺口：本文件把 busy
 *    门与一次换代（GEN1 → GEN2，四个读口的 asOf 与 sources 集合全部不同）叠在一起，
 *    断言只发一批且屏上（服务表行集 / 矩阵行文本 / 汇总句 / 存储面 / 两种复制文本）
 *    只有新一代，上一代时间戳零残留。R171 例④ 证的是单击换代的残留，不是 busy 门。
 *
 * ②「刷新失败保旧批、不写读取时刻、错误锚带 rid」已由 R112 例② 在格子级钉住
 *    （`sys-updated-at` 为 null、行计数保留、`sys3-asof` 与三条探针 asof 原值不动、
 *    `sys-refresh-request-id` 带 rid、`sys-refresh-retry` 在）。本文件补两条没人写的腿：
 *    (a) `sys-refresh-copy` 的**点击** —— 产品 `systemRefresh.tsx:69-87` 里它调可 mock 的
 *        `copyTextToClipboard(id)`，全仓只有 `HealthPage.test.tsx:188` 与
 *        `system.cross.isolation.test.tsx:232` 断言过它存在，从未有人点过；
 *        断言剪贴板收到的是完整请求编号、按钮转「已复制」、且这一笔复制零额外请求。
 *    (b) 整行文本级保留（R112 只比了 asof 格子），以及一个更严的「不更新」：
 *        先成功刷一次让 `sys-updated-at` 落一个时刻，再让下一次失败 ——
 *        产品语义是 `start()` 把 updatedAt 置空、`finish(failure)` 不写新值，
 *        所以屏上既不是旧时刻也不是新时刻，而是没有时刻。
 *
 * ③「事件表与矩阵各自独立刷新」是本代的真空面：`aud01-refresh`（产品
 *    `AuditEventsModulePage.tsx:1583`）在全仓只被审计道自己点过
 *    （`AuditEventsModulePage.test.tsx:4716 / :4721 / :4762`，单面挂载），
 *    health 道从没有人点它、更没有在它期间计量矩阵存储面与 health 的四条读口。
 *    本文件两面同挂（R224-first / R228 / R229 的跨面习语：`ConsoleModulePage module="system"`
 *    的 live 槽 + 挂在壳外的 `StoreProbe` 常驻证人），两条腿各证一边：
 *    Leg A 只刷事件表 ⇒ health 四条路径零新增、矩阵存储面逐字不动；回去后屏上矩阵
 *    行文本与两种复制文本与出发前一致（耗时逐读抖动，折叠后比）。
 *    Leg B 只刷 health ⇒ 审计面在自己那一边只花它挂载时的那一笔读，行集与读数条不变。
 *    如实记录：「只刷一边」只能顺序观测——`App.tsx` 的 health 与 events 是互斥 live 槽，
 *    而且两面都没有模块缓存（离开一边零流量，回来时花自己的一整批），
 *    这与 capabilities 的 `cachedSkillsState` / `cachedTools` 相反。
 *
 * 既有用例引用（不重写）：R112 例① 读取时刻 ≠ 任一格；R112 例②③④；R145 例③ busy 零污染；
 * R148 例②③④（矩阵单行失败面、可复制完整 rid、换代）；R151 例③（被取代的响应不能提交）；
 * R159 例①②③（矩阵五种格逐字同源、失败行只复制「失败」、复制文本不含刷新时刻）；
 * R171 例④（换代零残留）；R224-first 例①②③；R228 例②③；R229 例①②③。
 *
 * `sys-evt-*` 家族本代不存在（第 23 条道：全仓 27 处命中全是既有用例的缺席注释或我的缺席断言，
 * health 模块没有事件表），所以三例都不写它，只在需要的地方断言它不存在。
 * 本文件不新增任何 testid；`sys3-*` / `sys4-detail-*` / `sys5-*` / `sys6-*` / `sys7-export-*` /
 * `sys8-*` / `sys10-*` / `sys13-*` / `sys15-*` / `sys-refresh*` / `sys-row-copy-*` / `hlt5-*` /
 * `aud01-*` / `aud2-*` / `agent-v2-page-audit` 全部只读。
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

const HEALTH_URL = "/agent-api/api/health";
const HEALTH_PATHS = [HEALTH_URL, "/agent-api/api/__health-probe__", "/agent-api/api/hermes-summary", "/agent-api/api/skills"];
const IDS = ["console", "domain", "health", "runtime"] as const;

/** 新一代：四个读口的顶层时刻全部挪动，服务清单多一行 —— 残留检测因此非空洞。 */
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
const GEN2 = {
  health: {
    ok: true,
    asOf: "2026-11-20T00:05:00Z",
    sources: [
      { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
      { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 },
      { id: "svc-c", name: "审批服务", status: "ok", version: "1.0.0", latencyMs: 9 },
    ],
  },
  console: { status: "healthy", asOf: "2026-11-20T03:10:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-20T04:20:00Z" },
  domain: { items: [], asOf: "2026-11-20T05:25:00Z" },
};
/** 上一代的四个北京时间戳，任一不得在新一代落屏后仍出现在任何时间面或复制文本里。 */
const GEN1_STAMPS = ["2026-11-19 23:17", "2026-11-19 09:30", "2026-11-19 10:45", "2026-11-19 12:15"];
const GEN2_STAMPS = ["2026-11-20 08:05", "2026-11-20 11:10", "2026-11-20 12:20", "2026-11-20 13:25"];

const EVENTS = {
  items: [
    {
      eventId: "evt_aaaa1111bbbb2222",
      event_type: "approval_approved",
      occurredAt: "2026-11-20T05:30:00Z",
      outcome: "succeeded",
      actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
      resource: { type: "approval", id: "ap_1122334455667788" },
      requestId: "req-20261120-aaaa",
    },
  ],
  nextCursor: null,
};

const RID = "req-race-500";

/** 旗标按引用读：mount 只装一次实现，翻旗不需要重装（R229 习语）。 */
const flags: { health: string | null } = { health: null };
let generation: "one" | "two" = "one";
let hold = false;
const held: Array<() => void> = [];

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
  if (key === "audit") return url.includes("audit-detail") ? { audit: {} } : EVENTS;
  if (key === "health" && flags.health) {
    throw new ApiError("health upstream exploded", { status: 500, body: "{}", url, requestId: flags.health });
  }
  const body = generation === "two" ? GEN2[key] : GEN1[key];
  if (hold) {
    return new Promise<unknown>((resolve) => {
      held.push(() => resolve(body));
    });
  }
  return body;
}

function arm(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => switchable(String(url ?? "undefined")));
}

function releaseAll(): void {
  while (held.length > 0) held.shift()?.();
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

/** 只订阅矩阵存储的常驻证人；probe- 前缀不与任何冻结族撞名，挂在壳外所以跨 tab 存活。 */
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
/** 耗时逐读抖动，折叠后再比整行文本。 */
function fold(text: string): string {
  return text.replace(/\d+ ms/g, "<n> ms");
}
function matrixRows(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>("[data-testid^='sys6-row-']")]) {
    const testid = node.getAttribute("data-testid")!;
    out[testid] = fold((node.textContent ?? "").trim());
  }
  return out;
}
function serviceRows(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of [...container.querySelectorAll<HTMLElement>("[data-testid^='sys3-row-']")]) {
    const testid = node.getAttribute("data-testid")!;
    out[testid] = fold((node.textContent ?? "").trim());
  }
  return out;
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

async function waitFor(cond: () => boolean, label: string): Promise<void> {
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

/** 矩阵两种复制用的是裸 navigator.clipboard（不是 copyTextToClipboard 助手）。 */
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

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetSourceMatrix();
  api.fetchJSON.mockReset();
  flags.health = null;
  generation = "one";
  hold = false;
  held.length = 0;
  armNavigatorClipboard();
  window.history.replaceState({}, "", "/system?tab=health");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  releaseAll();
  vi.useRealTimers();
});

describe("R230 — 刷新并发、失败保留与两边独立", () => {
  it("busy 期连点只发一批，落屏只保留新一代：上一代时刻在服务表、矩阵行、汇总句、存储面与两种复制文本里零残留", async () => {
    await mount();
    await settleHealthReady();
    await expandMatrix();
    expect(Object.keys(probeFaces()).sort(), "存储面正好四个读口").toEqual(["probe-console", "probe-domain", "probe-health", "probe-runtime"]);
    expect(healthReads(), "首载一整批").toBe(4);
    const afterInit = HEALTH_PATHS.map((path) => readsFor(path));
    expect(textOf("sys6-summary"), "首代汇总是四成功").toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");
    expect(Object.keys(serviceRows()).sort(), "首代服务表两行").toEqual(["sys3-row-svc-a", "sys3-row-svc-b"]);

    // 换代 + 把这一批扣住：三次点击只有第一次能发出，后两次落在 busy 门上。
    generation = "two";
    hold = true;
    const button = q<HTMLButtonElement>("sys-refresh");
    await click(button, "the refresh button");
    expect(q<HTMLButtonElement>("sys-refresh")?.disabled, "busy 期按钮必须是 disabled（不是靠我们少点）").toBe(true);
    await click(q("sys-refresh"), "second click while busy");
    await click(q("sys-refresh"), "third click while busy");
    expect(container.querySelectorAll("[data-testid='sys-busy-note']").length, "busy 提示只有一枚").toBe(1);
    expect(
      HEALTH_PATHS.map((path) => readsFor(path)),
      "三次点击只发出一批：每条路径 +1",
    ).toEqual(afterInit.map((n) => n + 1));

    hold = false;
    releaseAll();
    await waitFor(() => textOf("sys6-summary") === "4 个读口 · 成功 4 · 失败 0 · 读口未接入 0" && Object.keys(serviceRows()).length === 3, "新一代落屏");
    expect(HEALTH_PATHS.map((path) => readsFor(path)), "释放后仍只有一批").toEqual(afterInit.map((n) => n + 1));

    // 只保留最后一批：服务表换代到三行，矩阵四格走进一代。
    expect(Object.keys(serviceRows()).sort(), "服务表跟着新一代多一行").toEqual(["sys3-row-svc-a", "sys3-row-svc-b", "sys3-row-svc-c"]);
    const faces = asOfFaces();
    expect(faces["sys6-asof-health"], "health 格是新一代").toBe(GEN2_STAMPS[0]);
    expect(faces["sys6-asof-console"], "console 格是新一代").toBe(GEN2_STAMPS[1]);
    expect(faces["sys6-asof-runtime"], "runtime 格是新一代").toBe(GEN2_STAMPS[2]);
    expect(faces["sys6-asof-domain"], "domain 格是新一代").toBe(GEN2_STAMPS[3]);
    expect(probeFaces()["probe-health"], "存储面也是新一代").toBe(`ok|${GEN2_STAMPS[0]}|`);

    // 上一代零残留：整页表体、存储面、两种复制文本里都不该再出现任何一个上一代时间戳。
    const tableText = [textOf("sys3-table"), textOf("sys6-table"), Object.values(probeFaces()).join("\n")].join("\n");
    for (const stamp of GEN1_STAMPS) {
      expect(tableText, `上一代时刻 ${stamp} 不该留在表体或存储面`).not.toContain(stamp);
    }
    const pipe = await copyVia("sys10-copy");
    const tab = await copyVia("sys-matrix-copy");
    for (const stamp of GEN1_STAMPS) {
      expect(pipe, `pipe 复制里没有上一代 ${stamp}`).not.toContain(stamp);
      expect(tab, `tab 复制里没有上一代 ${stamp}`).not.toContain(stamp);
    }
    for (const stamp of GEN2_STAMPS) {
      expect(pipe, `pipe 复制带着新一代 ${stamp}`).toContain(stamp);
      expect(tab, `tab 复制带着新一代 ${stamp}`).toContain(stamp);
    }
    const readStamp = textOf("sys-updated-at");
    expect(readStamp, "刷新时刻落屏").toContain("（读取时刻，不是数据时刻）");
    for (const value of Object.values(asOfFaces())) {
      expect(readStamp, "读取时刻不得等于任何数据时刻").not.toContain(value);
    }
    expect(clipWrite.mock.calls.length, "两次复制都写了剪贴板").toBeGreaterThan(0);
    expect(healthReads(), "复制与落屏都没多花读口").toBe(8);
  });

  it("刷新失败时读取时刻被撤回而不是保留旧值，旧批整行与原 asof 全保留，错误锚的 rid 点一下复制的是完整编号且零额外请求", async () => {
    await mount();
    await settleHealthReady();

    // 先成功刷一次，让 sys-updated-at 真的落一个时刻——「不更新」才有对照物。
    await click(q("sys-refresh"), "the refresh button (good batch)");
    await waitFor(() => textOf("sys-updated-at").length > 0, "a read stamp lands");
    const stampBefore = textOf("sys-updated-at");
    expect(stampBefore, "第一次刷新写入读取时刻").toContain("刷新完成于");
    const rowsBefore = matrixRows();
    const servicesBefore = serviceRows();
    const asOfBefore = asOfFaces();
    const summaryBefore = textOf("sys6-summary");
    const readsBefore = totalReads();

    // 下一次刷新失败：health 清单 500，三条探针照常。
    flags.health = RID;
    await click(q("sys-refresh"), "the refresh button (failing batch)");
    await waitFor(() => !!q("sys-refresh-error"), "the refresh error block lands");
    expect(q("sys-updated-at"), "失败不写新时刻，也不把旧时刻留在屏上").toBeNull();
    expect(textOf("sys-refresh-error"), "错误锚自己说话").toContain("请求编号");
    expect(textOf("sys-refresh-request-id"), "页面级错误块带 rid").toContain(RID);
    expect(q("sys-refresh-copy"), "错误块里有复制钮（既有用例只断言过它存在）").not.toBeNull();

    // 基数在这里取：失败的那一批自己也花了四读，复制的零成本要跟它比，不是跟失败前比。
    const readsAtFailure = totalReads();
    expect(readsAtFailure, "失败批次只花一次批次钱（health 清单 + 三条探针）").toBe(readsBefore + 4);

    // 旧批保留：服务表整行文本逐字不动（hasDataRef），矩阵三条探针一字不改。
    expect(serviceRows(), "服务表保留上一批的整行文本").toEqual(servicesBefore);
    const after = matrixRows();
    for (const id of ["console", "domain", "runtime"] as const) {
      expect(after[`sys6-row-${id}`], `${id} 行与失败前逐字相同`).toBe(rowsBefore[`sys6-row-${id}`]);
    }
    for (const id of ["console", "domain", "runtime"] as const) {
      expect(asOfFaces()[`sys6-asof-${id}`], `${id} 的采集时刻原值保留`).toBe(asOfBefore[`sys6-asof-${id}`]);
      expect(asOfFaces()[`sys8-asof-${id}`], `${id} 的内层时刻原值保留`).toBe(asOfBefore[`sys8-asof-${id}`]);
    }
    // 失败那一行诚实不冒充：状态转失败、自己的时刻撤回「—」，汇总句如实计数。
    expect(after["sys6-row-health"], "health 行如实转失败并撤回自己的时刻").not.toBe(rowsBefore["sys6-row-health"]);
    expect(q("sys6-row-health")?.getAttribute("data-status"), "health 行状态是 failed").toBe("failed");
    expect(textOf("sys6-asof-health"), "缺值用「—」，不编时间也不填 0").toBe("—");
    expect(textOf("sys6-summary"), "汇总句如实数出一失败").toBe("4 个读口 · 成功 3 · 失败 1 · 读口未接入 0");
    expect(summaryBefore, "对照：失败前汇总是四成功").toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");

    // 从未被点过的那条腿：点 `sys-refresh-copy`，剪贴板收到完整请求编号，按钮转「已复制」，零额外请求。
    clipboard.copyTextToClipboard.mockClear();
    await click(q("sys-refresh-copy"), "the rid copy button");
    await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, "the copy helper ran");
    expect(String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? ""), "复制的是完整请求编号").toBe(RID);
    expect(textOf("sys-refresh-copy"), "按钮转「已复制」").toBe("已复制");
    expect(q("sys-refresh-request-id")?.textContent, "锚上仍是完整编号，没有被短码替换").toContain(RID);
    expect(totalReads(), "复制一次不花任何请求").toBe(readsAtFailure);
    expect(q("sys-updated-at"), "复制之后依旧没有读取时刻").toBeNull();

    // 恢复：撤旗再点重试，错误锚撤走、时刻重新写入、四格回到原值。
    flags.health = null;
    await click(q("sys-refresh-retry"), "the refresh error retry button");
    await waitFor(() => !!q("sys-refresh-error") === false && textOf("sys-updated-at").length > 0, "recovery lands");
    expect(textOf("sys-updated-at"), "恢复后重新写入读取时刻").toContain("刷新完成于");
    expect(matrixRows(), "恢复后矩阵整行回到失败前").toEqual(rowsBefore);
    expect(asOfFaces(), "恢复后每个采集时刻回到原值").toEqual(asOfBefore);
    expect(q("sys6-rid-health"), "恢复后失败行的 rid 撤走").toBeNull();
  });

  it("只刷事件表时 health 四条路径零新增、矩阵存储面逐字不动；回去后屏上矩阵行与两种复制文本与出发前一致", async () => {
    await mount();
    await settleHealthReady();
    await click(q("sys6-toggle"), "the matrix toggle");
    await waitFor(() => container.querySelectorAll("[data-testid^='sys6-row-']").length === 4, "matrix expanded");
    const faces = probeFaces();
    const rows = matrixRows();
    const asOf = asOfFaces();
    const summary = textOf("sys6-summary");
    const healthBefore = healthReads();
    const pipeBefore = await copyVia("sys10-copy");
    const tabBefore = await copyVia("sys-matrix-copy");

    await click(tabButton("events"), "the events tab");
    await settleEvents();
    expect(paintedRows(), "事件表画它自己的行").toEqual(["evt_aaaa1111bbbb2222"]);
    expect(auditReads(), "事件表首载只花它自己一笔读").toBe(1);
    expect(healthReads(), "挂事件表不动 health 的读口").toBe(healthBefore);

    // 只刷事件表：它自己 +1 笔，health 一侧零流量，矩阵存储面一个字不动。
    await click(q("aud01-refresh"), "the events page refresh");
    await waitFor(() => auditReads() === 2, "the events refresh spends its own read");
    expect(healthReads(), "③ 的核心：只刷事件表，health 四条路径零新增").toBe(healthBefore);
    expect(probeFaces(), "矩阵存储面逐字不动").toEqual(faces);
    expect(container.querySelectorAll("[data-testid^='sys-evt']").length, "sys-evt 家族本代不存在（第 23 条道）").toBe(0);

    // 回去：health 没有模块缓存，所以花自己的一整批——那是它自己的重挂，不是被事件表污染的。
    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table") && textOf("sys6-summary") === summary, "health pane back");
    expect(healthReads(), "回去花的是自己的一整批（无模块缓存）").toBe(healthBefore + 4);
    expect(probeFaces(), "存储面仍是同一代").toEqual(faces);
    expect(matrixRows(), "屏上矩阵整行文本与出发前一致（耗时折叠）").toEqual(rows);
    expect(asOfFaces(), "每个采集时刻与出发前一致").toEqual(asOf);

    const pipeAfter = await copyVia("sys10-copy");
    const tabAfter = await copyVia("sys-matrix-copy");
    expect(fold(pipeAfter), "pipe 复制文本一字不动").toBe(fold(pipeBefore));
    expect(fold(tabAfter), "tab 复制文本一字不动").toBe(fold(tabBefore));
    expect(healthReads(), "两次复制不花任何读口").toBe(healthBefore + 4);
  });

  it("只刷 health 时审计面一分不花；重挂事件表只花它自己那一笔读，行集与读数条与刷之前一致", async () => {
    await mount();
    await settleHealthReady();
    await click(tabButton("events"), "the events tab");
    await settleEvents();
    const paintedBefore = paintedRows();
    const statusBefore = textOf("aud01-status");
    expect(auditReads(), "事件表首载一笔").toBe(1);

    // 回 health 刷它自己的一批：审计面还没被再次挂载，所以一分钱不花。
    await click(tabButton("health"), "the health tab");
    await waitFor(() => !!q("sys3-table"), "health pane back");
    const healthAtRefresh = healthReads();
    await click(q("sys-refresh"), "the health refresh button");
    await waitFor(() => textOf("sys-updated-at").length > 0, "the read stamp lands");
    expect(healthReads(), "health 刷新花自己的一整批").toBe(healthAtRefresh + 4);
    expect(auditReads(), "③ 的另一半：只刷 health，审计面零新增").toBe(1);

    // 重挂事件表：只花它自己那一笔读，行集与读数条与之前一致。
    await click(tabButton("events"), "the events tab again");
    await waitFor(() => paintedRows().length > 0, "audit list repainted");
    expect(paintedRows(), "行集与刷新前一致").toEqual(paintedBefore);
    expect(textOf("aud01-status"), "读数条与刷新前一致").toBe(statusBefore);
    expect(auditReads(), "重挂只多它自己一笔").toBe(2);
    expect(healthReads(), "审计面从不重读 health 的四条路径").toBe(healthAtRefresh + 4);
    expect(container.querySelectorAll("[data-testid^='sys-evt']").length, "sys-evt 家族本代不存在").toBe(0);
  });
});
