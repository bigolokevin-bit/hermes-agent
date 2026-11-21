// @vitest-environment jsdom
// wave-125 — 375 button tiering on /runs. The page keeps exactly one solid
// primary (页首 刷新); the reload/clear pair is its own labelled group inside
// the filter bar so 375 wrap never interleaves actions with chips, and the
// copy / export / permalink cluster is收纳进 a single 列表操作 group instead of
// loose rows. These are structural contracts: real buttons, real aria groups,
// pinned through the same mount harness as runs.filters.test.tsx.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn(() => Promise.resolve(true)) }));

vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { RunsModulePage } from "./RunsModulePage";
import { PAGE_LIMIT } from "./runs";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function runRow(n: number) {
  const tail = String(n).padStart(4, "0");
  return {
    runId: `rn_01M7822TIER${tail}`,
    employeeId: "emp_aaaabbbbcccc",
    status: "completed",
    costUsd: n,
    costStatus: "known",
    startedAt: "2026-11-18T02:00:00.000Z",
    endedAt: "2026-11-18T02:11:00.000Z",
  };
}

const FIRST = Array.from({ length: PAGE_LIMIT }, (_, i) => runRow(i + 1));

let root: Root | null = null;

async function waitFor(cond: () => boolean, label: string) {
  for (let i = 0; i < 400; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`timeout: ${label}`);
}

async function mount(entry: string) {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(createElement(MemoryRouter, { initialEntries: [entry] }, createElement(RunsModulePage)));
  });
  await waitFor(() => document.querySelector('[data-testid="run5-page"]') !== null, "page mounted");
}

function node(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation((url: string) =>
    Promise.resolve(url.includes("/api/runs") ? { items: FIRST, nextCursor: null } : { items: [] }),
  );
  clip.copyTextToClipboard.mockClear();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("/runs button tiering (wave-125)", () => {
  it("groups 重新读取 and 清除筛选 into a labelled 读取动作 group inside the filter bar", async () => {
    await mount("/runs");
    await waitFor(() => node("run5-refresh") !== null, "list ready");
    const group = node("run5-filter-actions");
    expect(group).not.toBeNull();
    expect(group?.getAttribute("role")).toBe("group");
    expect(group?.getAttribute("aria-label")).toBe("读取动作");
    expect(group?.contains(node("run5-refresh"))).toBe(true);
    expect(group?.contains(node("run-reset-filters"))).toBe(true);
    // the group itself rides inside the filter bar, so chips and actions stay separated
    expect(node("run5-filters")?.contains(group)).toBe(true);
  });

  it("收纳 copy / export / permalink into one 列表操作 group once the list is ready", async () => {
    await mount("/runs?run=rn_01M7822TIER0001");
    await waitFor(() => node("run-list-copy") !== null, "copy bar mounted");
    const bar = node("run5-utility-bar");
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute("role")).toBe("group");
    expect(bar?.getAttribute("aria-label")).toBe("列表操作");
    expect(bar?.contains(node("run-list-copy"))).toBe(true);
    expect(bar?.contains(node("run-list-export"))).toBe(true);
    expect(bar?.contains(node("run-permalink"))).toBe(true);
  });

  it("keeps the page-level 刷新 bar and the grouped 重新读取 as separate, non-nested tiers", async () => {
    await mount("/runs");
    await waitFor(() => node("run-refresh") !== null, "refresh bar mounted");
    // 刷新 stays the single page-level primary in its own bar …
    expect(node("run-refresh-bar")?.contains(node("run-refresh"))).toBe(true);
    // … while 重新读取/清除筛选 live one tier down, inside the filter group.
    expect(node("run5-filter-actions")?.contains(node("run5-refresh"))).toBe(true);
    expect(node("run-refresh-bar")?.contains(node("run5-refresh"))).toBe(false);
  });
});
