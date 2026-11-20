// @vitest-environment jsdom
// R151 — /system 读源失败重试的幂等护栏（纯测试，零产品改动）。
//
// 现查（先 git grep）后的缺口地图 —— 既有覆盖只引用不重复：
//  · SystemHealthSurface.test.tsx :110-121 已点过 `sys3-retry` 并等到表格出现，
//    但它单独挂载 surface、没有三条探针，所以「只重发这一个读口」从未被计量；
//    :395-408 已钉 error 面板的可读句 + `sys-state-rid` + 复制按钮存在性 +
//    `sys3-refresh` 在非 ready 态 disabled；:410-425 已钉 denied 无重试。
//  · R112 system.refresh.test.tsx :179 与 R145 system.state.isolation.test.tsx
//    :223 已钉「刷新按钮连点只发一批」——那是协调器 `sys-refresh` 的 busy 门禁。
//  · R145 :130 只钉了探针行 8 位短码文本；R148 :232 钉的是矩阵 CopyRid 的点击。
//  · HealthPage.test.tsx :133 点的是 `hlt5-retry`（全批重来），不是单源重试。
// 本文件只补四件事：
//  ① 探针行自己的请求编号可真复制（写全文而非短码），且这次点击不动任何兄弟行；
//  ② `sys3-retry` 恰好 +1 次它自己的读口，三条探针计数为 0，错误行与 rid 一起清空；
//  ③ 重试按钮本身没有 `disabled`  busy 旗（如实记录）：挡住第二次点击的是
//    面板在途时被收起（`setState({ k: "loading" })`）；并被后续读取代的过期
//    响应不得提交——效果清理守卫才是「只提交一批」的真机制；
//  ④ 重试仍失败时不追加第二条错误、不累积 rid、不写 `sys-updated-at`。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => api.fetchJSON(...args) }));

vi.mock("@/lib/api-error", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    requestId?: string;
    constructor(message: string, init: { status: number; body?: string; url?: string; requestId?: string }) {
      super(message);
      this.name = "ApiError";
      this.status = init.status;
      this.requestId = init.requestId;
    }
  },
}));
import { ApiError } from "@/lib/api-error";

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => <span {...props}>{children}</span>,
  Button: ({ children, outlined, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    void outlined;
    return <button {...props}>{children}</button>;
  },
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { HealthPage } from "./HealthPage";
import { resetSourceMatrix } from "./sourceReads";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let clipWrite: ReturnType<typeof vi.fn>;

type Key = "health" | "console" | "runtime" | "domain";
type Reads = Partial<Record<Key, () => Promise<unknown>>>;

const HEALTH_ASOF = "2026-11-19T15:17:09Z"; // → 23:17
const CONSOLE_ASOF = "2026-11-19T01:30:00Z"; // → 09:30
const RUNTIME_ASOF = "2026-11-19T02:45:00Z"; // → 10:45
const DOMAIN_ASOF = "2026-11-19T04:15:00Z"; // → 12:15
const STALE_ASOF = "2026-11-19T09:00:00Z"; // → 17:00, a different generation on purpose

const HEALTH_BODY = {
  ok: true,
  asOf: HEALTH_ASOF,
  sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1" },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1" },
  ],
};
/** A visibly different list: three rows and its own 采集时刻. */
const STALE_BODY = {
  ok: true,
  asOf: STALE_ASOF,
  sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1" },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1" },
    { id: "svc-c", name: "运行时引擎", status: "ok", version: "1.0.0" },
  ],
};

function keyOf(url: string): Key {
  if (url.includes("/api/health")) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}

function okProbe(asOf: string): () => Promise<unknown> {
  return async () => ({ status: "healthy", asOf });
}
const PROBES_OK: Reads = {
  console: okProbe(CONSOLE_ASOF),
  runtime: okProbe(RUNTIME_ASOF),
  domain: async () => ({ items: [], asOf: DOMAIN_ASOF }),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Iteration-bounded: a wall-clock deadline via Date.now() would never fire if
 * a test froze Date (R135's recorded trap). */
async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}

function textOf(testid: string): string {
  return q(testid)?.textContent ?? "";
}

function readsByKey(): Record<Key, number> {
  const out: Record<Key, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
  for (const call of api.fetchJSON.mock.calls) {
    const raw = call[0];
    if (raw === undefined || raw === null) continue;
    out[keyOf(String(raw))] += 1;
  }
  return out;
}

/** Whole-row snapshot with the measured 耗时 folded (R145's recorded trap). */
function rowSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sel of ["[data-testid^='sys6-row-']", "[data-testid^='hlt5-row-']", "[data-testid^='sys3-row-']"]) {
    for (const row of Array.from(container.querySelectorAll(sel))) {
      const id = row.getAttribute("data-testid") ?? "?";
      out[id] = (row.textContent ?? "").replace(/\d+ ms/g, "<n> ms").trim();
    }
  }
  return out;
}

function matrixRowCount(): number {
  return container.querySelectorAll("[data-testid^='sys6-row-']").length;
}

async function mount(reads: Reads, settle: () => boolean = () => !!q("sys3-table")) {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const key = keyOf(String(url));
    const read = reads[key];
    if (!read) throw new ApiError(`no fixture for ${key}`, { status: 500, body: "{}", url: String(url) });
    return read();
  });
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {});
  await waitFor(settle, "page settled");
  await act(async () => {
    q<HTMLButtonElement>("sys6-toggle")?.click();
  });
  await waitFor(() => matrixRowCount() === 4, "matrix expanded");
}

async function clickRetry(): Promise<void> {
  const button = q<HTMLButtonElement>("sys3-retry");
  if (!button) throw new Error("sys3-retry is not on screen — the health list is not in its error state");
  await act(async () => {
    button.click();
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  resetSourceMatrix();
  window.history.replaceState({}, "", "/system?tab=health");
  clipWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipWrite } });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  vi.useRealTimers();
});

describe("R151 — /system 单源重试的幂等", () => {
  it("① the probe row's own request id copies the full id and disturbs no sibling row", async () => {
    await mount({
      health: async () => HEALTH_BODY,
      console: PROBES_OK.console!,
      runtime: async () => {
        throw new ApiError("upstream exploded", { status: 500, body: "{}", url: "/agent-api/api/hermes-summary", requestId: "req-retry-500" });
      },
      domain: PROBES_OK.domain!,
    });

    const before = rowSnapshot();
    const summaryBefore = textOf("sys6-summary");
    const row = q("hlt5-row-runtime")!;
    const short = row.querySelector("[data-testid='hlt5-reqid-short']");
    expect(short?.textContent).toContain("req-retr");
    expect(short?.getAttribute("title")).toBe("req-retry-500");
    const copy = row.querySelector<HTMLButtonElement>("button[aria-label='复制完整请求编号']");
    expect(copy).toBeTruthy();

    const callsBefore = api.fetchJSON.mock.calls.length;
    await act(async () => {
      copy!.click();
      await Promise.resolve();
    });
    const calls = clipWrite.mock.calls;
    expect(calls[calls.length - 1]?.[0]).toBe("req-retry-500");
    expect(copy?.textContent).toBe("已复制");
    // A copy is not a read.
    expect(api.fetchJSON.mock.calls.length).toBe(callsBefore);

    const after = rowSnapshot();
    expect(Object.keys(after).filter((id) => after[id] !== before[id])).toEqual(["hlt5-row-runtime"]);
    // The failing row speaks for itself; siblings keep their exact numbers and stamps.
    expect(textOf("hlt5-asof-runtime")).toBe("—");
    expect(textOf("hlt5-asof-console")).toBe("2026-11-19 09:30");
    expect(textOf("hlt5-asof-domain")).toBe("2026-11-19 12:15");
    expect(textOf("sys6-asof-health")).toBe("2026-11-19 23:17");
    expect(textOf("sys6-summary")).toBe(summaryBefore);
    expect(q("sys-updated-at")).toBeNull();
  });

  it("② retrying the list read costs exactly one request to that read and nothing to the probes", async () => {
    let attempts = 0;
    await mount(
      {
        health: async () => {
          attempts += 1;
          if (attempts === 1) throw new ApiError("upstream exploded", { status: 500, body: "{}", url: "/agent-api/api/health", requestId: "req-list-500" });
          return HEALTH_BODY;
        },
        ...PROBES_OK,
      },
      () => !!q("sys3-error"),
    );
    expect(readsByKey()).toEqual({ health: 1, console: 1, runtime: 1, domain: 1 });
    expect(q("sys6-rid-health")).toBeTruthy();
    expect(q("sys6-row-health")?.getAttribute("data-status")).toBe("failed");
    expect(q("sys-updated-at")).toBeNull();

    await clickRetry();
    await waitFor(() => !!q("sys3-table"), "the retried read lands");

    // The single-source promise in `retry()` is measured here, not assumed:
    // exactly +1 on the health list, zero on every probe.
    expect(readsByKey()).toEqual({ health: 2, console: 1, runtime: 1, domain: 1 });
    expect(q("sys-state-error")).toBeNull();
    expect(q("sys6-rid-health")).toBeNull();
    expect(q("sys6-row-health")?.getAttribute("data-status")).toBe("ok");
    expect(textOf("sys6-asof-health")).toBe("2026-11-19 23:17");
    expect(textOf("sys3-asof")).toBe("2026-11-19 23:17");
    // Probe stamps never moved, and the coordinator stamp was never written:
    // a single-source retry does not pretend to be a page refresh.
    expect(textOf("hlt5-asof-console")).toBe("2026-11-19 09:30");
    expect(textOf("hlt5-asof-runtime")).toBe("2026-11-19 10:45");
    expect(textOf("hlt5-asof-domain")).toBe("2026-11-19 12:15");
    expect(q("sys-updated-at")).toBeNull();
    expect(q("sys-refresh-error")).toBeNull();
  });

  it("③ one retry sends one request, and a response superseded mid-flight cannot commit", async () => {
    let attempts = 0;
    const superseded = deferred<unknown>();
    const newest = deferred<unknown>();
    await mount(
      {
        health: async () => {
          attempts += 1;
          if (attempts === 1) throw new ApiError("upstream exploded", { status: 500, body: "{}", url: "/agent-api/api/health", requestId: "req-first-500" });
          return attempts === 2 ? superseded.promise : newest.promise;
        },
        ...PROBES_OK,
      },
      () => !!q("sys3-error"),
    );

    // Honest product fact: the retry button carries no `disabled` busy flag —
    // what stops a second click is that the panel holding it is withdrawn the
    // moment the retry is in flight (`setState({ k: "loading" })` while no data
    // is held yet). The disabled-while-busy contract belongs to `sys-refresh`
    // (R112 :179, R145 :223); this page hides `sys3-refresh` via `hideRefresh`.
    expect(q<HTMLButtonElement>("sys3-retry")?.disabled).toBe(false);
    await clickRetry();
    expect(q("sys3-retry")).toBeNull();
    expect(q("sys3-loading")).toBeTruthy();
    expect(container.querySelectorAll("[data-testid='sys-state-error']")).toHaveLength(0);
    // One click, one request to that read only — the probes stay untouched.
    expect(readsByKey()).toEqual({ health: 2, console: 1, runtime: 1, domain: 1 });

    // While that retry still hangs, a page refresh supersedes it. The effect's
    // cleanup flips `live`, so the older response loses on arrival.
    await act(async () => {
      q<HTMLButtonElement>("sys-refresh")!.click();
    });
    await waitFor(() => readsByKey().health === 3, "the refresh re-asks the list");
    expect(readsByKey()).toEqual({ health: 3, console: 2, runtime: 2, domain: 2 });

    await act(async () => {
      newest.resolve(HEALTH_BODY);
      await Promise.resolve();
    });
    await waitFor(() => !!q("sys3-table"), "the newest read commits");
    const rows = container.querySelectorAll("[data-testid^='sys3-row-']").length;
    const stamp = textOf("sys6-asof-health");
    expect(rows).toBe(2);
    expect(stamp).toBe("2026-11-19 23:17");

    // The superseded request answers late, after the newer one committed. It
    // must not resurrect its own three-row body nor move the data stamp.
    await act(async () => {
      superseded.resolve(STALE_BODY);
      await Promise.resolve();
    });
    await act(async () => {});
    expect(container.querySelectorAll("[data-testid^='sys3-row-']").length).toBe(rows);
    expect(textOf("sys6-asof-health")).toBe(stamp);
    expect(matrixRowCount()).toBe(4);
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");
    expect(q("sys6-rid-health")).toBeNull();
    // The refresh writes its own read stamp, and it is not the data stamp.
    const updatedAt = textOf("sys-updated-at");
    expect(updatedAt).toContain("（读取时刻，不是数据时刻）");
    expect(updatedAt).not.toContain(stamp);
  });

  it("④ a retry that still fails adds no second error row and writes no read stamp", async () => {
    let attempts = 0;
    await mount(
      {
        health: async () => {
          attempts += 1;
          throw new ApiError("upstream exploded", { status: 500, body: "{}", url: "/agent-api/api/health", requestId: attempts === 1 ? "req-first-500" : "req-second-500" });
        },
        ...PROBES_OK,
      },
      () => !!q("sys3-error"),
    );
    const ridBefore = textOf("sys-state-rid");
    expect(ridBefore).toContain("req-first-500");

    await clickRetry();
    await waitFor(() => textOf("sys-state-rid").includes("req-second-500"), "the second failure commits");

    // One panel, one matrix row, one count — failures are replaced, not appended.
    expect(container.querySelectorAll("[data-testid='sys-state-error']")).toHaveLength(1);
    expect(container.querySelectorAll("[data-testid='sys3-error']")).toHaveLength(1);
    expect(matrixRowCount()).toBe(4);
    expect(container.querySelectorAll("[data-testid^='sys3-row-']")).toHaveLength(0);
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 3 · 失败 1 · 读口未接入 0");
    expect(ridBefore).not.toContain("req-second-500");
    expect(textOf("sys-state-rid")).not.toContain("req-first-500");
    expect(q("sys6-rid-health")).toBeTruthy();
    expect(q("sys6-row-health")?.getAttribute("data-status")).toBe("failed");
    // The retry never touches the refresh coordinator's read stamp.
    expect(q("sys-updated-at")).toBeNull();
    expect(q("sys-refresh-error")).toBeNull();
    expect(readsByKey()).toEqual({ health: 2, console: 1, runtime: 1, domain: 1 });
    // Probes kept their data through both failures.
    expect(textOf("hlt5-asof-console")).toBe("2026-11-19 09:30");
    expect(textOf("hlt5-asof-runtime")).toBe("2026-11-19 10:45");
    expect(textOf("hlt5-asof-domain")).toBe("2026-11-19 12:15");
  });
});
