// @vitest-environment jsdom
/**
 * R212 — /system 空态与清时间窗护栏（纯测试，零产品码改动）。
 *
 * 派工单先 `git grep` 现查纪律的执行结果：
 * - 「事件表」半边（②的事件导出、④的清时间窗复原）已由 aud 道在本代钉死：
 *   `audit/audit.empty.test.tsx`（R181）:169 «says what came back empty, keeps the
 *   page's anchors, and shows no bare count»、:197 «turns both export buttons off with
 *   the reason, and a click asks for nothing»、:221 «清空区间 goes back to the default
 *   window, restores the rows, and drops the deep link»；
 *   `audit/audit.empty.export.test.tsx`（R206）:186/:202 «never a Blob»/:221 «exit asks
 *   once more, read-out counts the rows»/:241。本文件不重写它们。
 * - `sys-evt-copy-*` 与 health 事件表本代不存在（第 12 条道确认）：全仓 grep 只命中
 *   五处记录缺席的注释——`system.cross.isolation.test.tsx:6-12`、`system.filters.test.tsx:14`、
 *   `system.matrix.export.test.tsx:6`、`system.state.isolation.test.tsx:18`、`system.time.test.tsx:8`。
 *   health 也不读 `?window=`（唯一读者是 `modules/audit/AuditEventsModulePage`），
 *   所以 ④ 的「矩阵清时间窗」不可测，如实记录、不发明面。
 * - health 侧既有的空/错锚 pin（只引用不重复）：`SystemHealthSurface.test.tsx` :398-402
 *   （错误面板 + rid 值 + 复制钮存在，从未点击）、:420（denied 带 rid-copy）、:430-432
 *   （空面板 + 「不补服务行」）；R159 ④c :358（全 500 失败三钮 disabled）；R204 ④ :353
 *   （无匹配 q 下导出 disabled + 强点不建 Blob）；R151 :269（恢复后 sys-state-error 撤走）。
 *
 * 本文件补的真实缺口（全在 health 写域内）：
 * ① 空清单页级面：可读句、无表体无行复制、不给绿色结论（sys3-summary 整条撤走）、
 *    无 undefined/NaN 泄漏、页级锚（hlt5-page / 矩阵四行）仍在；
 * ② 全读口未接入：矩阵三钮 disabled + 同一原因句，强点导出 createObjectURL 未被调用、
 *    强点复制 navigator 未被调用、零新增请求；
 * ③ 错误锚与空锚互斥（错误时无空态句，空态时无 rid 节点），且错误 rid 复制逐字全 id。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => api.fetchJSON(...args) }));

const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const { outlined, ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean };
    void outlined;
    return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import { HealthPage } from "./HealthPage";
import { resetSourceMatrix } from "./sourceReads";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HEALTH_EMPTY = { ok: true, asOf: "2026-11-19T15:17:09Z", sources: [] };
const PROBES = {
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
} as const;

type Key = "health" | "console" | "runtime" | "domain";
function keyOf(url: string): Key {
  if (url.includes("/api/health")) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}
function unwired(url: string): ApiError {
  return new ApiError("not wired", { status: 404, body: "{}", url, requestId: "req-unwired-404" });
}

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}
function all(prefix: string): Element[] {
  return [...container.querySelectorAll(`[data-testid^='${prefix}']`)];
}
function textOf(testid: string): string | null {
  return q(testid)?.textContent?.trim() ?? null;
}
function readsByKey(): Record<Key, number> {
  const out: Record<Key, number> = { health: 0, console: 0, runtime: 0, domain: 0 };
  for (const call of api.fetchJSON.mock.calls) {
    const arg = call[0];
    if (arg === undefined) continue; // Vitest teardown invokes the mock without args.
    out[keyOf(String(arg))] += 1;
  }
  return out;
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  // Iteration-bounded on purpose: a Date.now() deadline would spin under a frozen
  // clock (the R135 lesson). 600 ticks × 5 ms of real setTimeout ≈ 3 s budget.
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {});
}

interface Download {
  content: () => string;
  fileName: () => string;
  urlSpy: ReturnType<typeof vi.fn>;
  restore: () => void;
}
function captureDownload(): Download {
  let recorded = "";
  let name = "";
  const OriginalBlob = window.Blob;
  const urlSpy = vi.fn(() => "blob:sys7");
  const revokeSpy = vi.fn();
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  class RecordingBlob extends OriginalBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      recorded = String(parts[0]);
    }
  }
  Object.defineProperty(window, "Blob", { value: RecordingBlob, configurable: true, writable: true });
  Object.defineProperty(URL, "createObjectURL", { value: urlSpy, configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeSpy, configurable: true, writable: true });
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    name = this.download;
  });
  return {
    content: () => recorded,
    fileName: () => name,
    urlSpy,
    restore: () => {
      clickSpy.mockRestore();
      Object.defineProperty(URL, "createObjectURL", { value: originalCreate, configurable: true, writable: true });
      Object.defineProperty(URL, "revokeObjectURL", { value: originalRevoke, configurable: true, writable: true });
      Object.defineProperty(window, "Blob", { value: OriginalBlob, configurable: true, writable: true });
    },
  };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetchJSON.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetSourceMatrix();
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

describe("R212 — /system 空态、未接入与错误锚互斥", () => {
  it("① an empty health list is a readable sentence, not a table and not a green verdict", async () => {
    // health route answers the empty list; probes keep their own stamps.
    api.fetchJSON.mockImplementation(async (url: unknown) => {
      const key = keyOf(String(url));
      return key === "health" ? HEALTH_EMPTY : PROBES[key];
    });
    await render();
    await waitFor(() => !!q("sys3-empty"), "the empty panel lands");

    expect(q("sys-state-state")?.getAttribute("data-state")).toBe("empty");
    expect(q("sys-state-empty")).not.toBeNull();
    expect(textOf("sys-state-empty-text")).toContain("不补服务行");
    // No table, no rows, and therefore no per-row copy column at all.
    expect(all("sys3-row-")).toHaveLength(0);
    expect(q("sys3-table")).toBeNull();
    expect(container.querySelectorAll("button[data-testid^='sys-row-copy-']")).toHaveLength(0);
    // The ready-only summary strip is withdrawn entirely — an empty list earns
    // no 「来源 N 项」 and no overall badge (「也不给绿色结论」).
    expect(q("sys3-summary")).toBeNull();
    expect(q("sys3-overall")).toBeNull();
    expect(q("sys3-sources")).toBeNull();
    // No leak words on the page.
    const page = container.textContent ?? "";
    expect(page).not.toMatch(/undefined|NaN|\[object/);
    // Page-level anchors stay alive: the probe face and the matrix (whose health
    // row is honestly ok — an empty list is still a successful read).
    expect(q("hlt5-page")).not.toBeNull();
    expect(all("sys6-row-")).toHaveLength(4);
    expect(q("sys6-row-health")?.getAttribute("data-status")).toBe("ok");
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 4 · 失败 0 · 读口未接入 0");
    // No refresh has run, so no read stamp exists yet.
    expect(q("sys-updated-at")).toBeNull();
    expect(api.fetchJSON.mock.calls.filter((c) => c[0] !== undefined)).toHaveLength(4);
  });

  it("② with every read path unwired, the matrix blocks all three controls and force-clicks build nothing", async () => {
    api.fetchJSON.mockImplementation(async (url: unknown) => {
      throw unwired(String(url));
    });
    await render();
    await waitFor(() => all("sys6-row-").length === 4, "the matrix settles");

    // The surface itself lands on the denied/gap panel — no retry, an apply link.
    expect(q("sys3-gap")).not.toBeNull();
    expect(q("sys-state-denied")).not.toBeNull();
    expect(q("sys3-apply")?.getAttribute("href")).toBe("#/approvals");
    expect(all("sys3-row-")).toHaveLength(0);
    expect(container.querySelectorAll("button[data-testid^='sys-row-copy-']")).toHaveLength(0);
    // Matrix: four unwired rows, honest summary, one blocked sentence behind all
    // three controls.
    for (const id of ["health", "console", "runtime", "domain"]) {
      expect(q(`sys6-row-${id}`)?.getAttribute("data-status")).toBe("unwired");
      expect(textOf(`sys15-trunc-status-${id}`)).toBe("读口未接入");
    }
    expect(textOf("sys6-summary")).toBe("4 个读口 · 成功 0 · 失败 0 · 读口未接入 4");
    const exportButton = q<HTMLButtonElement>("sys7-export")!;
    const pipeButton = q<HTMLButtonElement>("sys10-copy")!;
    const tabButton = q<HTMLButtonElement>("sys-matrix-copy")!;
    expect(exportButton.disabled).toBe(true);
    expect(pipeButton.disabled).toBe(true);
    expect(tabButton.disabled).toBe(true);
    expect(exportButton.title).toContain("没有可导出");
    expect(pipeButton.title).toContain("当前没有可导出/复制的可用读口行：读口未接入或读取失败");
    expect(tabButton.title).toContain("当前没有可导出/复制的可用读口行：读口未接入或读取失败");
    expect(textOf("sys7-export-count")).toBe("—");
    expect(container.textContent).not.toMatch(/undefined|null|NaN|\[object/);

    const clipWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipWrite } });
    const download = captureDownload();
    const before = api.fetchJSON.mock.calls.length;
    try {
      await act(async () => {
        exportButton.click();
        pipeButton.click();
        tabButton.click();
        await Promise.resolve();
      });
      expect(download.urlSpy).not.toHaveBeenCalled();
      expect(download.content()).toBe("");
      expect(download.fileName()).toBe("");
      expect(clipWrite).not.toHaveBeenCalled();
      expect(textOf("sys10-copy-status")).toBe("");
      expect(textOf("sys-matrix-copy-status")).toBe("");
      expect(q("sys10-fallback")).toBeNull();
      expect(q("sys-matrix-copy-fallback")).toBeNull();
      expect(api.fetchJSON.mock.calls.length).toBe(before);
    } finally {
      download.restore();
    }
  });

  it("③ error and empty never share the screen, and the error rid copies verbatim", async () => {
    let failed = false;
    api.fetchJSON.mockImplementation(async (url: unknown) => {
      const key = keyOf(String(url));
      if (key === "health" && failed) {
        throw new ApiError("upstream exploded", {
          status: 500,
          body: "{}",
          url: "/agent-api/api/health",
          requestId: "req-empty-500",
        });
      }
      return key === "health" ? HEALTH_EMPTY : PROBES[key];
    });

    // Phase A — first load fails on the health list: the error panel, no empty sentence.
    failed = true;
    await render();
    await waitFor(() => !!q("sys3-error"), "the error panel lands");
    expect(q("sys-state-error")).not.toBeNull();
    // The surface mounts RequestId with legacyRidTestId="sys3-request-id", so the
    // value span carries the legacy testid while the wrapper stays sys-state-rid.
    expect(textOf("sys3-request-id")).toContain("req-empty-500");
    expect(q("sys-state-rid")?.getAttribute("title")).toBe("req-empty-500");
    // Mutual exclusion, error side: the empty anchor and its sentence are absent.
    expect(q("sys-state-empty")).toBeNull();
    const surface = q("sys3-error")?.textContent ?? "";
    expect(surface).not.toContain("健康接口返回了空清单");
    expect(surface).not.toContain("不补服务行");

    const before = api.fetchJSON.mock.calls.length;
    const ridCopy = q<HTMLButtonElement>("sys-state-rid-copy");
    expect(ridCopy).not.toBeNull();
    await act(async () => {
      ridCopy!.click();
      await Promise.resolve();
    });
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith("req-empty-500");
    expect(textOf("sys-state-rid-copy")).toBe("已复制");
    expect(api.fetchJSON.mock.calls.length).toBe(before);

    // Phase B — retry into an empty answer: the empty panel, and structurally no rid.
    failed = false;
    const countsBefore = readsByKey();
    await act(async () => {
      q<HTMLButtonElement>("sys3-retry")!.click();
      await Promise.resolve();
    });
    await waitFor(() => !!q("sys-state-empty"), "the empty panel replaces the error");
    expect(q("sys-state-error")).toBeNull();
    expect(all("sys-state-rid")).toHaveLength(0);
    expect(q("sys3-request-id")).toBeNull();
    expect(q("sys3-empty")?.textContent).not.toContain("请求编号");
    expect(textOf("sys-state-empty-text")).toContain("不补服务行");
    const countsAfter = readsByKey();
    expect(countsAfter.health).toBe(countsBefore.health + 1);
    expect(countsAfter.console).toBe(countsBefore.console);
    expect(countsAfter.runtime).toBe(countsBefore.runtime);
    expect(countsAfter.domain).toBe(countsBefore.domain);
  });
});
