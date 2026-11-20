// @vitest-environment jsdom
/**
 * R236 — /system 事件表空态与「清筛选回默认」三值同源（纯测试，零产品码改动）。
 *
 * 派工单点名的两条 sys-evt 腿本代不存在（第 29 条道复核）：
 * `git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` 共 36 处命中，
 * 全部是既有用例里记录缺失的注释与我自己的缺失断言（system.window.isolation / system.event.export /
 * system.event.combo / system.cross.failure / system.refresh.race / system.event.rows /
 * system.cross.isolation / system.time / system.state.isolation / system.matrix.export /
 * system.filters / system.empty / 以及本轮刚落盘的 system.event.copy.paging），
 * health 产品码命中为 0。所以「sys-evt-count 显 0」与「sys-evt-copy-i 三值」没有产品对应物：
 * 本文件只断言它们不存在，并把这两腿如实改钉在真实面上——
 * 唯一显 0 的读数是导出条 aud5-export-count（「将导出 0 条」），状态行 aud01-status 在空集时
 * 是一句无数字的句子；逐行可复制控件是 aud01-cell-key-request-value（无 rid 的行给
 * aud01-cell-key-request-value-absent，文本「该字段未返回」，不给死按钮）。
 * 这个「谁该显 0」的现场裁决已由 R206 :186 / R181 :216 / R214 例④ 按现状锁死，本文件复述并锁住。
 *
 * 已覆盖只回证据、不重写（派工单的「先 git grep 查重」纪律）：
 * R221 system.event.export.test.tsx :365 已钉「空答复关掉导出门、带原因、强点零请求零 Blob」；
 * R228 system.event.combo.test.tsx :310 已钉非法 ?window= 折成默认窗、恰一问、空答复是句子不是裸 0、
 * URL 不改写、页级锚在、矩阵不吃这个参数；R135 system.filters.test.tsx :244 已钉非法 window 静默折叠
 * 不改写地址；R206 audit.empty.export.test.tsx :186 / :202 / :221 / :241 与 R181 audit.empty.test.tsx
 * :197 / :216 / :221 / :246 已钉审计道自己的空态、两门关死、never a Blob、清空出口回到默认窗恰一问、
 * 读数重新数得出行；R214 audit.filter.counts.test.tsx :316 已钉「档位赢、叠上的 custom 对被静默忽略」、
 * :345 已钉叠筛空集不建文件；R225 system.event.rows.test.tsx :198 / :261 已钉切窗换代与逐行控件重映射。
 *
 * 本文件的新腿（无人组合过的）：把上述半边的地址换成 ?tab=events 复合地址，并且让矩阵存储面
 * （probe- 证人）在同一会话里常驻作证——审计侧的空态与清空都必须一分不写地放过它。
 * R181 / R206 / R214 都把 AuditEventsModulePage 单独挂在裸 /audit 上，从来没有这个证人。
 *
 * 另一条与派工单字面相反的口径：读源矩阵不吃 ?window=（全仓产品读者只有 audit 的
 * AuditEventsModulePage.tsx:774 与 :1521、audit/scrollMemory.ts:43、runs/RunsModulePage.tsx 的
 * 955 / 976 / 990 / 1695，以及 duty），health 一侧一个 window 读者都没有；而且 events tab 活跃时
 * 矩阵的 DOM pane 根本不挂载（App.tsx 的 health: 与 events: 是互斥 live 槽）。所以「两表同落可读空态」
 * 对矩阵是双重不成立的：它既不因非法窗口变空，也不在事件侧活跃时存在于屏上。本文件以矩阵存储面
 * 冻结为证，如实记录这一点。
 *
 * 冻结族只读，本文件不新增任何产品 testid；probe- 前缀与 empty-location 是本文件私有的测试内
 * 证人节点，不与任何冻结族撞名。
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

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let restoreDownload: (() => void) | null = null;

const HEALTH_URL = "/agent-api/api/health";
const HEALTH_PATHS = [HEALTH_URL, "/agent-api/api/__health-probe__", "/agent-api/api/hermes-summary", "/agent-api/api/skills"];

/** 一次读源的采集时刻各不相同，矩阵面才分得出是谁被写过。 */
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
} as const;

/** 账本对这一段半小时答以空集，快捷窗答以两行（R181 夹具的原样区间）。 */
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-05T02:30:00Z";
const NOW = new Date("2026-11-20T06:00:00.000Z");

const FRESH = "evt_fresh00000001";
const TAIL = "evt_tail000000003";
const RID_FRESH = "req-fresh-0001";

/** 短码形状用破折号，避开 R31 的折叠规则：屏上文本 == title == 剪贴板 == 文件那一格。 */
function rowOf(eventId: string, action: string, requestId: string | null): Record<string, unknown> {
  return {
    eventId,
    action,
    occurredAt: "2026-11-19T01:20:00Z",
    recordedAt: "2026-11-19T01:20:01Z",
    outcome: "succeeded",
    actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    ...(requestId ? { requestId } : {}),
  };
}
const ROWS = [rowOf(FRESH, "task.created", RID_FRESH), rowOf(TAIL, "run.failed", null)];

type SourceKey = "audit" | "health" | "console" | "runtime" | "domain";
function keyOf(url: string): SourceKey {
  if (url.startsWith("/agent-api/api/audit")) return "audit";
  if (url === HEALTH_URL) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}
function cursorsOf(url: string): string[] {
  return new URL(url, "http://console.test").searchParams.getAll("cursor");
}
function boundsOf(url: string): { from: string | null; to: string | null } {
  const sp = new URL(url, "http://console.test").searchParams;
  return { from: sp.get("from"), to: sp.get("to") };
}
/** 上线的永远是 from/to 对，档位从不上线；跨度按毫秒判档。 */
function spanOf(url: string): number {
  const { from, to } = boundsOf(url);
  return new Date(to ?? "").getTime() - new Date(from ?? "").getTime();
}

/** 假服务像真 BFF 一样自己筛：类型筛选与那段空区间都各给空集。 */
function auditAnswer(url: string): unknown {
  if (url.includes("audit-detail")) return { audit: ROWS[0] };
  if (paramOf(url, "action") === "approval.denied") return { items: [], nextCursor: null };
  const from = paramOf(url, "from") ?? "";
  if (from.startsWith("2026-11-05T02:00")) return { items: [], nextCursor: null };
  return { items: ROWS, nextCursor: null };
}
const handler = (url: string): unknown => {
  const key = keyOf(url);
  if (key === "audit") return auditAnswer(url);
  return GEN1[key];
};

/** 只换实现、不清调用史——计量要用首载的历史。 */
function arm(): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => handler(String(url ?? "undefined")));
}

function urls(): string[] {
  return api.fetchJSON.mock.calls.map((call) => String(call[0] ?? "undefined")).filter((url) => url !== "undefined");
}
function listReads(): number {
  return urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
}
function lastListRead(): string {
  const reads = urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url));
  return reads[reads.length - 1] ?? "";
}
function healthReads(): number {
  return urls().filter((url) => HEALTH_PATHS.includes(url)).length;
}

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container ? container.querySelector<T>(`[data-testid='${testid}']`) : null;
}
function all(selector: string): HTMLElement[] {
  return container ? [...container.querySelectorAll<HTMLElement>(selector)] : [];
}
function textOf(testid: string): string {
  return q(testid)?.textContent?.trim() ?? "";
}
/** 读数条里的数字；句子（无数字）如实返回 -1，不去凑一个 0。 */
function shownOf(testid: string): number {
  const match = /(\d+)\s*条/.exec(textOf(testid));
  return match ? Number(match[1]) : -1;
}
function paintedRows(): string[] {
  return all("[data-testid^='aud01-row-']").map((node) => node.getAttribute("data-testid")!.replace("aud01-row-", ""));
}
function valueKeys(): string[] {
  return all("[data-testid^='aud01-cell-'][data-testid$='-request-value']").map((node) =>
    node.getAttribute("data-testid")!.replace("aud01-cell-", "").replace("-request-value", ""),
  );
}
function absentKeys(): string[] {
  return all("[data-testid^='aud01-cell-'][data-testid$='-request-value-absent']").map((node) =>
    node.getAttribute("data-testid")!.replace("aud01-cell-", "").replace("-request-value-absent", ""),
  );
}

/** 只订阅矩阵存储的常驻证人：事件侧的任何写法都瞒不过它。 */
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
  for (const node of all("[data-testid^='probe-']")) {
    out[node.getAttribute("data-testid")!] = node.textContent?.trim() ?? "";
  }
  return out;
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="empty-location">{`${loc.pathname}${loc.search}`}</span>;
}
function address(): string {
  return textOf("empty-location");
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  // 迭代封顶而非墙钟截止：本文件有冻结 Date 的用例，Date.now() 读的截止永远不会触发，
  // 循环会转到 vitest 的 15 秒击杀并污染后面的用例。
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

async function clickTestId(testId: string, label: string): Promise<void> {
  const node = q<HTMLElement>(testId);
  if (!node) throw new Error(`missing clickable node: ${label} (${testId})`);
  await act(async () => {
    node.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let blobContent = "";
let blobName = "";
let blobCalls = 0;
let urlCalls = 0;

function captureDownload(): void {
  const OriginalBlob = window.Blob;
  blobContent = "";
  blobName = "";
  blobCalls = 0;
  urlCalls = 0;
  class RecordingBlob extends OriginalBlob {
    constructor(parts: BlobPart[] | BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      blobCalls += 1;
      blobContent = String(Array.isArray(parts) ? parts[0] : "");
    }
  }
  Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: RecordingBlob });
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => {
    urlCalls += 1;
    return "blob:empty-guard";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    blobName = this.download;
  });
  restoreDownload = () => {
    Object.defineProperty(window, "Blob", { configurable: true, writable: true, value: OriginalBlob });
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    clickSpy.mockRestore();
  };
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
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
async function mount(entry: string): Promise<void> {
  arm();
  await render(entry);
}
async function settleHealth(): Promise<void> {
  await waitFor(() => !!q("sys3-table"), "health surface ready");
  await waitFor(() => Object.values(probeFaces()).every((face) => face.startsWith("ok|")), "matrix store settled");
}
async function settleEvents(): Promise<void> {
  await waitFor(
    () => paintedRows().length > 0 || !!q("aud01-empty") || !!q("aud01-error"),
    "events surface settled",
  );
}

beforeEach(() => {
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetSourceMatrix();
  api.fetchJSON.mockReset();
});

afterEach(() => {
  restoreDownload?.();
  restoreDownload = null;
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R236 — 事件表空态的门与清空出口的三值同源（矩阵面常驻作证）", () => {
  it("自定义区间答以空集：0 只落在导出读数上、两扇门关死且点击零请求零 Blob，清空出口恰多一问", async () => {
    // 先在 health tab 落一次真读，让矩阵面带着四个采集时刻成为常驻证人。
    await mount("/system?tab=health");
    await settleHealth();
    const faces = probeFaces();
    expect(Object.keys(faces).sort(), "矩阵存储有四行证人").toEqual(["probe-console", "probe-domain", "probe-health", "probe-runtime"]);
    expect(faces["probe-health"], "health 行带自己的采集时刻").toBe("ok|2026-11-19 23:17|");
    const healthBase = healthReads();
    expect(healthBase, "首载花掉 health 清单加三条探针").toBe(4);

    const entry = `/system?tab=events&window=custom&from=${FROM}&to=${TO}`;
    await mount(entry);
    await settleEvents();
    const readsAtEmpty = listReads();

    expect(paintedRows(), "空集不画任何行").toEqual([]);
    expect(q("aud01-empty"), "空态锚在").not.toBeNull();
    expect(textOf("audB-empty-exit"), "区间空态给出口句").toContain("这一段里没有记录。");
    expect(textOf("aud01-status").length > 0, "状态行不是空的").toBe(true);
    expect(textOf("aud01-status"), "状态行是句子，不冒充「0 条」").not.toContain("0 条");
    expect(container?.textContent ?? "", "整页不出现「共 0 条」").not.toContain("共 0 条");
    expect(shownOf("aud01-status"), "状态句里根本没有数字").toBe(-1);
    expect(
      textOf("aud5-export-count"),
      "派工的 sys-evt-count 本代不存在（第 29 条道：36 处命中全是注释或我自己的缺席断言，health 产品码 0 命中）；" +
        "这一面上唯一如实显 0 的读数就是导出的那一句，状态行按 R206 :186 / R181 :216 / R214 例④ 的现状是句子",
    ).toContain("将导出 0 条");
    expect(all("[data-testid^='sys-evt']"), "sys-evt 族本代不存在，只断言缺失").toHaveLength(0);
    expect(all("[data-testid^='aud01-cell-']"), "空集里没有行可挂逐行控件（R206 :241 的现状）").toHaveLength(0);

    const exportDoor = q<HTMLButtonElement>("aud01-export");
    const filterDoor = q<HTMLButtonElement>("aud5-export");
    expect(exportDoor, "主导出门在屏").not.toBeNull();
    expect(filterDoor, "筛选快照门在屏").not.toBeNull();
    expect(exportDoor!.disabled, "主导出门 disabled").toBe(true);
    expect(filterDoor!.disabled, "筛选快照门 disabled").toBe(true);
    const titles = [exportDoor!.getAttribute("title") ?? "", filterDoor!.getAttribute("title") ?? ""];
    expect(titles[0].length > 0, "空态的 disabled 必须带可读 title").toBe(true);
    expect(titles[1].length > 0, "两扇门都带可读 title").toBe(true);
    // 现场裁决（实测，与本文件初稿的假设相反）：两扇门不共用一句原因。
    // 主导出说「当前筛选没有可导出的记录」，筛选快照说「当前筛选无事件可导出」——
    // 各自可读、各自关死；派工只要求「disabled + title」，本代的事实是两句而不是一个单点。
    expect(titles[0], "主导出的原因句按现状锁").toBe("当前筛选没有可导出的记录");
    expect(titles[1], "筛选快照的原因句按现状锁，不借用主导出那句").toBe("当前筛选无事件可导出");

    const urlsAtEmpty = urls().length;
    captureDownload();
    await clickTestId("aud01-export", "被关死的主导出门");
    await clickTestId("aud5-export", "被关死的筛选快照门");
    expect(urlCalls, "createObjectURL 一次都没被调用").toBe(0);
    expect(blobCalls, "空集不建任何 Blob").toBe(0);
    expect(blobContent, "没有文件内容").toBe("");
    expect(blobName, "没有文件名").toBe("");
    expect(urls().length, "点两扇关死的门不花任何请求").toBe(urlsAtEmpty);
    expect(listReads(), "列表读仍是空态那一笔").toBe(readsAtEmpty);
    expect(healthReads(), "事件侧的空态不动 health 的四条路径").toBe(healthBase);
    expect(probeFaces(), "事件侧的空态一分都没写进矩阵存储（常驻证人的意义）").toEqual(faces);
    expect(paramOf(address(), "tab"), "复合地址的 tab 一路在").toBe("events");
    expect(paramOf(address(), "window"), "空态期间 window=custom 原样在").toBe("custom");
    expect(paramOf(address(), "from"), "空态期间 from= 原样在").toBe(FROM);

    // 清空出口：产品自己的按钮，不是我们替它写的。
    await clickTestId("audB-empty-clear", "区间空态的清空出口");
    await waitFor(() => paintedRows().length === 2, "两行回来了");
    expect(listReads(), "清空出口恰多一问（基线取在空态那一笔之后）").toBe(readsAtEmpty + 1);
    expect(q("aud01-empty"), "空态锚撤走").toBeNull();
    const last = lastListRead();
    expect(spanOf(last), "退回的那一问按默认窗的 from/to 对，跨度七天").toBe(7 * 24 * 60 * 60 * 1000);
    expect(paramOf(last, "window"), "档位从不上线，上线的是 from/to 对").toBeNull();
    expect(cursorsOf(last), "清空后不带旧 cursor").toEqual([]);
    expect(paramOf(address(), "from"), "地址里的 from= 被出口抹掉").toBeNull();
    expect(paramOf(address(), "to"), "地址里的 to= 被出口抹掉").toBeNull();
    expect(paramOf(address(), "window"), "地址落回默认档，按 R181 :221 的现状").toBe("7d");
    expect(paramOf(address(), "tab"), "复合地址的 tab=events 一字没被动过（R181/R206 用的是裸 /audit）").toBe("events");

    // 三值方程（派工的 sys-evt-count / sys-evt-copy-i 两腿如实改钉在真面上）。
    const rows = paintedRows().length;
    expect(rows, "表体两行").toBe(2);
    expect(shownOf("aud01-status"), "状态读数 == 表体行数").toBe(rows);
    expect(shownOf("aud5-export-count"), "导出读数 == 表体行数（空态时它是 0，此时它是 2）").toBe(rows);
    expect(valueKeys().length + absentKeys().length, "逐行可复制控件（含无 rid 的那枚）== 表体行数").toBe(rows);
    expect(valueKeys(), "带 rid 的那行才有复制钮").toEqual([FRESH]);
    expect(absentKeys(), "无 rid 的那行给缺席标记而不是死按钮").toEqual([TAIL]);
    const bareNode = all("[data-testid$='-request-value-absent']")[0]!;
    expect(bareNode.textContent?.trim(), "缺席行的用词是「该字段未返回」").toBe("该字段未返回");
    expect(bareNode.querySelector("button"), "缺席行不给死按钮").toBeNull();
    expect(healthReads(), "清空出口也只花审计那一笔").toBe(healthBase);
    expect(probeFaces(), "清空出口同样一分不写矩阵存储").toEqual(faces);
    expect(all("[data-testid^='sys-evt']"), "sys-evt 族到结尾仍不存在").toHaveLength(0);
  });

  it("非法 ?window= 叠上 custom 对与类型筛选：折成默认档提问、忽略那一对、地址逐字不改，空答复仍是句子不是裸 0", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await mount("/system?tab=health");
    await settleHealth();
    const faces = probeFaces();
    const healthBase = healthReads();

    const entry = `/system?tab=events&window=__nope__&from=${FROM}&to=${TO}&type=approval.denied`;
    await mount(entry);
    await settleEvents();

    expect(listReads(), "折叠后只问一笔").toBe(1);
    const read = lastListRead();
    expect(boundsOf(read), "档位赢：请求边界是折叠后的默认窗，不是叠上来的那一对").toEqual(windowBounds(DEFAULT_WINDOW, NOW));
    expect(paramOf(read, "window"), "请求里不带 window 键").toBeNull();
    expect(spanOf(read), "跨度是默认档的七天").toBe(7 * 24 * 60 * 60 * 1000);
    expect(paramOf(read, "action"), "类型筛选照旧上线，空集由它造成（R214 例③ 的仲裁在复合地址上复核）").toBe("approval.denied");
    expect(cursorsOf(read), "没有旧 cursor 外溢").toEqual([]);
    expect(address(), "地址逐字不改：非法 token、那一对、类型筛选全都原样留着").toBe(entry);

    expect(paintedRows(), "该条件下没有行").toEqual([]);
    expect(q("aud01-empty"), "空态锚在").not.toBeNull();
    expect(textOf("audD-empty-exit"), "类型空态给出口句").toContain("该条件下无事件");
    expect(textOf("aud01-status").length > 0, "状态行有字").toBe(true);
    expect(textOf("aud01-status"), "空答复是一句可读句子，不显裸 0").not.toContain("0 条");
    expect(shownOf("aud01-status"), "句子无数字").toBe(-1);
    expect(container?.textContent ?? "", "整页不出现「共 0 条」").not.toContain("共 0 条");
    expect(textOf("aud5-export-count"), "唯一的 0 仍在导出读数上").toContain("将导出 0 条");
    expect(q("agent-v2-page-audit"), "页级锚在").not.toBeNull();
    expect(all("[data-testid^='sys-evt']"), "sys-evt 族不存在，只断言缺失").toHaveLength(0);

    const exportDoor = q<HTMLButtonElement>("aud01-export");
    const filterDoor = q<HTMLButtonElement>("aud5-export");
    expect(exportDoor!.disabled, "非法窗口下的空集照样关死主导出门").toBe(true);
    expect(filterDoor!.disabled, "筛选快照门同样关死").toBe(true);
    expect(exportDoor!.getAttribute("title"), "主导出的原因句（与 test 1 同一枚现状）").toBe("当前筛选没有可导出的记录");
    expect(filterDoor!.getAttribute("title"), "筛选快照用自己的原因句，不共用一句").toBe("当前筛选无事件可导出");
    const urlsBefore = urls().length;
    captureDownload();
    await clickTestId("aud01-export", "关死的主导出门");
    await clickTestId("aud5-export", "关死的筛选快照门");
    expect(urlCalls, "createObjectURL 未被调用").toBe(0);
    expect(blobCalls, "不建文件").toBe(0);
    expect(urls().length, "点击零新增请求").toBe(urlsBefore);
    expect(listReads(), "列表读仍是那一笔").toBe(1);

    // 矩阵侧：非法窗口对它双重不成立——它不吃 ?window=，而且事件 tab 活跃时它的 DOM pane 根本没挂载。
    expect(probeFaces(), "矩阵存储面一分不动：health 一侧没有任何 window 读者，事件侧也不写它").toEqual(faces);
    expect(Object.values(faces).every((face) => face.startsWith("ok|") && !face.includes("|—|")), "四面都是采集时刻齐的绿面").toBe(true);
    expect(healthReads(), "事件侧的非法窗口与空集没让 health 多花一笔").toBe(healthBase);
    expect(q("sys3-table"), "事件 tab 活跃时矩阵 pane 不在屏上（App.tsx 的互斥 live 槽）").toBeNull();
  });
});
