// @vitest-environment jsdom
// R148 — 读源矩阵与页面锚的一致性护栏（纯测试，零产品改动）。
//
// 现查（先 git grep）后的缺口地图 —— 既有覆盖只引用不重复：
//  · SourceMatrix.test.tsx :120/:136 已钉矩阵各行的采集时刻文本，:140 已钉
//    `sys8-asof-health === sys3-checked`，:129-133 已钉失败行的「失败」态、
//    原文只进 title、`sys6-rid-runtime` 8 位短码与复制按钮的存在；
//  · R112 system.refresh.test.tsx 已钉 sys-updated-at 与每个时刻格「不相等」；
//  · R145 system.state.isolation.test.tsx 已钉兄弟行整行逐字不变与恢复回原值。
// 本文件只补四件事：
//  ① 矩阵行采集时刻与「页面自己的锚」逐字相等（探针 ↔ hlt5-asof-*，
//     健康清单 ↔ sys3-asof 汇总条）——此前只有 sys8↔sys3-checked 一条跨面等式；
//  ② 单表失败时 `sys6-summary` 的计数句与行数（成功/失败/未接入恒显示，0 也显示）；
//  ③ 失败行的可见可读句 + rid 全文在 title + 复制真的写剪贴板（此前只钉存在性），
//     以及「不得冒充」：采集时刻格必须是带原因的「—」，不得出现伪造日期或 0；
//  ④ 恢复后回绿且时刻「换代到新值」（R145 只证了恢复回原值），兄弟逐字不动。
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

const HEALTH_ASOF = "2026-11-19T15:17:09Z"; // → 23:17
const CONSOLE_ASOF = "2026-11-19T01:30:00Z"; // → 09:30
const RUNTIME_ASOF = "2026-11-19T02:45:00Z"; // → 10:45
const DOMAIN_ASOF = "2026-11-19T04:15:00Z"; // → 12:15
const RECOVERY_ASOF = "2026-11-19T05:05:00Z"; // → 13:05, a NEW generation

const HEALTH_BODY = {
  ok: true,
  asOf: HEALTH_ASOF,
  sources: [
    { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1" },
    { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1" },
  ],
};

function okPayload(asOf: string) {
  return { status: "healthy", asOf };
}

function keyOf(url: string): "health" | "console" | "runtime" | "domain" {
  if (url.includes("/api/health")) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}

/** Iteration-bounded on purpose: test ① freezes `Date`, and a wall-clock
 * deadline read via Date.now() would never fire (R135's recorded trap). */
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

/** Whole-row snapshot with the measured 耗时 folded: that column jitters by
 * 1 ms per read (R145's recorded trap) and is not what these guards compare. */
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

async function renderPage() {
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {});
}

/** Arms the spy with a per-key resolver map and mounts the page to ready. */
async function mount(reads: Partial<Record<"health" | "console" | "runtime" | "domain", () => Promise<unknown>>>) {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: unknown) => {
    const key = keyOf(String(url));
    const read = reads[key];
    if (!read) throw new ApiError(`no fixture for ${key}`, { status: 500, body: "{}", url: String(url) });
    return read();
  });
  await renderPage();
  await waitFor(() => !!q("sys3-table"), "health table mounted");
  // The matrix starts collapsed; expand it so its rows are on screen.
  await act(async () => {
    q<HTMLButtonElement>("sys6-toggle")?.click();
  });
  await waitFor(() => container.querySelectorAll("[data-testid^='sys6-row-']").length === 4, "matrix expanded");
}

const ALL_GREEN = {
  health: async () => HEALTH_BODY,
  console: async () => okPayload(CONSOLE_ASOF),
  runtime: async () => okPayload(RUNTIME_ASOF),
  domain: async () => ({ items: [], asOf: DOMAIN_ASOF }),
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  resetSourceMatrix();
  window.history.replaceState({}, "", "/system?tab=health");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  vi.useRealTimers();
});

describe("R148 — 读源矩阵与页面锚", () => {
  it("① every matrix 采集时刻 equals the page's own anchor, and none equals the refresh stamp", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    await mount(ALL_GREEN);

    // Cross-face equality: matrix row ↔ the anchor the page itself renders.
    expect(textOf("sys6-asof-health")).toBe("2026-11-19 23:17");
    expect(textOf("sys6-asof-health")).toBe(textOf("sys3-asof"));
    for (const id of ["console", "runtime", "domain"]) {
      expect(textOf(`sys6-asof-${id}`)).toBe(textOf(`hlt5-asof-${id}`));
    }
    expect(textOf("sys6-asof-console")).toBe("2026-11-19 09:30");
    expect(textOf("sys6-asof-runtime")).toBe("2026-11-19 10:45");
    expect(textOf("sys6-asof-domain")).toBe("2026-11-19 12:15");

    // A refresh writes a read stamp, never a data stamp.
    await act(async () => {
      q<HTMLButtonElement>("sys-refresh")?.click();
    });
    await waitFor(() => !!q("sys-updated-at"), "read stamp appeared");
    const stamp = textOf("sys-updated-at");
    expect(stamp).toContain("（读取时刻，不是数据时刻）");
    expect(stamp).toContain("2031-03-01 08:00");
    for (const id of ["health", "console", "runtime", "domain"]) {
      expect(stamp).not.toContain(textOf(`sys6-asof-${id}`));
    }
    // And the anchors themselves did not move while the stamp landed.
    expect(textOf("sys6-asof-health")).toBe(textOf("sys3-asof"));
    for (const id of ["console", "runtime", "domain"]) {
      expect(textOf(`sys6-asof-${id}`)).toBe(textOf(`hlt5-asof-${id}`));
    }
  });

  it("② one failed read turns only its own row, and the summary sentence counts honestly", async () => {
    await mount({
      ...ALL_GREEN,
      runtime: async () => {
        throw new ApiError("upstream exploded", { status: 500, body: "{}", url: "/agent-api/api/hermes-summary", requestId: "req-isolate-500" });
      },
    });

    expect(container.querySelectorAll("[data-testid^='sys6-row-']")).toHaveLength(4);
    expect(q("sys6-row-runtime")?.getAttribute("data-status")).toBe("failed");
    for (const id of ["health", "console", "domain"]) {
      expect(q(`sys6-row-${id}`)?.getAttribute("data-status")).toBe("ok");
    }
    // Zeros are always spelled out — a 0 here is a real count, not a placeholder.
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 3 · 失败 1 · 读口未接入 0");
    // The failure withdraws only its own stamp; siblings keep theirs verbatim.
    expect(textOf("sys6-asof-runtime")).toBe("—");
    expect(textOf("hlt5-asof-runtime")).toBe("—");
    expect(textOf("sys6-asof-health")).toBe("2026-11-19 23:17");
    expect(textOf("sys6-asof-console")).toBe("2026-11-19 09:30");
    expect(textOf("sys6-asof-domain")).toBe("2026-11-19 12:15");
    // No sibling row swallowed the rid or the upstream text.
    for (const id of ["health", "console", "domain"]) {
      const row = q(`sys6-row-${id}`);
      expect(row?.textContent ?? "").not.toContain("req-isolate-500");
      expect(row?.textContent ?? "").not.toContain("upstream exploded");
    }
    expect(q("sys6-rid-health")).toBeNull();
    expect(q("sys6-rid-console")).toBeNull();
    expect(q("sys6-rid-domain")).toBeNull();
  });

  it("③ the failed row reads a sentence a person can act on, with a copyable full rid — and no fabricated value", async () => {
    await mount({
      ...ALL_GREEN,
      runtime: async () => {
        throw new ApiError("upstream exploded", { status: 500, body: "{}", url: "/agent-api/api/hermes-summary", requestId: "req-isolate-500" });
      },
    });
    const readsBefore = api.fetchJSON.mock.calls.length;

    // Visible readable sentence (not just a status word), raw text only in titles.
    expect(textOf("sys15-trunc-reason-runtime")).toBe("本次读取失败；请稍后重试或联系管理员。");
    expect(textOf("sys6-status-runtime")).toContain("失败");
    expect(textOf("sys6-status-runtime")).not.toContain("upstream exploded");
    expect(q("sys6-status-runtime")?.getAttribute("title") ?? "").toContain("upstream exploded");

    // Rid: 8-char short on screen, full value in the title, copy writes the FULL id.
    const rid = q("sys6-rid-runtime")!;
    expect(rid.getAttribute("title")).toBe("req-isolate-500");
    expect(rid.textContent ?? "").toContain("req-isol");
    const copyBtn = q<HTMLButtonElement>("sys6-rid-runtime-copy")!;
    expect(copyBtn.getAttribute("aria-label")).toBe("复制完整请求编号");
    await act(async () => {
      copyBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("req-isolate-500");
    expect(copyBtn.textContent).toBe("已复制");

    // 「不得冒充」: the stamp is an honest 「—」 carrying its reason, never a date or 0.
    const asofCell = q("sys6-asof-runtime")!;
    expect(asofCell.textContent?.trim()).toBe("—");
    const asofTitle = asofCell.getAttribute("title") ?? "";
    expect(asofTitle).toContain("请求失败，没有可读取的采集时刻。");
    expect(asofTitle).toContain("判据：只取 payload 顶层 ISO");
    expect(asofCell.textContent ?? "").not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // The duration cell is the real measurement, not a fabricated 0 for unknown.
    expect(textOf("sys6-duration-runtime")).toMatch(/^\d+ ms$/);

    // Copying and hovering cost nothing: no new reads.
    expect(api.fetchJSON.mock.calls.length).toBe(readsBefore);
  });

  it("④ recovery turns the row green with a NEW data stamp, siblings untouched", async () => {
    await mount({
      ...ALL_GREEN,
      runtime: async () => {
        throw new ApiError("upstream exploded", { status: 500, body: "{}", url: "/agent-api/api/hermes-summary", requestId: "req-isolate-500" });
      },
    });
    const failedRows = rowSnapshot();
    const siblingStamps = {
      health: textOf("sys6-asof-health"),
      console: textOf("sys6-asof-console"),
      domain: textOf("sys6-asof-domain"),
    };
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 3 · 失败 1 · 读口未接入 0");

    // The read口 recovers with a payload stamped AFTER the failed attempt.
    api.fetchJSON.mockImplementation(async (url: unknown) => {
      const key = keyOf(String(url));
      if (key === "runtime") return okPayload(RECOVERY_ASOF);
      if (key === "health") return HEALTH_BODY;
      if (key === "console") return okPayload(CONSOLE_ASOF);
      return { items: [], asOf: DOMAIN_ASOF };
    });
    await act(async () => {
      q<HTMLButtonElement>("sys-refresh")?.click();
    });
    await waitFor(() => q("sys6-row-runtime")?.getAttribute("data-status") === "ok", "runtime row recovered");

    // 回绿 + 时刻换代：a new value, equal to the page's own anchor.
    expect(textOf("sys6-asof-runtime")).toBe("2026-11-19 13:05");
    expect(textOf("sys6-asof-runtime")).toBe(textOf("hlt5-asof-runtime"));
    expect(textOf("sys6-asof-runtime")).not.toBe("—");
    expect(q("sys6-rid-runtime")).toBeNull();
    expect(textOf("sys15-trunc-reason-runtime")).toBe("");
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");

    // Siblings: stamps byte-identical and every other row verbatim unchanged.
    expect(siblingStamps.health).toBe("2026-11-19 23:17");
    expect(textOf("sys6-asof-health")).toBe(siblingStamps.health);
    expect(textOf("sys6-asof-console")).toBe(siblingStamps.console);
    expect(textOf("sys6-asof-domain")).toBe(siblingStamps.domain);
    const after = rowSnapshot();
    for (const id of ["sys6-row-health", "sys6-row-console", "sys6-row-domain", "sys6-row-runtime"]) {
      expect(Object.keys(after)).toContain(id);
    }
    for (const id of ["sys6-row-health", "sys6-row-console", "sys6-row-domain"]) {
      expect(after[id]).toBe(failedRows[id]);
    }
    // The recovered row differs only where it should: state and stamp.
    expect(after["sys6-row-runtime"]).not.toBe(failedRows["sys6-row-runtime"]);
    expect(after["sys6-row-runtime"]).toContain("2026-11-19 13:05");
    expect(after["sys6-row-runtime"]).not.toContain("req-isolate-500");
    expect(textOf("sys-updated-at")).toContain("刷新完成于");
  });
});
