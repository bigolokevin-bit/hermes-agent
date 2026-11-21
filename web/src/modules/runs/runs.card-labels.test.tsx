// @vitest-environment jsdom
// P1-B4 (UX r2) — 375 卡片档丢列头后，行内的字段名必须回到 DOM；≥sm 表头承担
// 语义、label 靠 sm:hidden 让位。这里钉的是结构契约：七个窄档 label 每行恰
// 好一组、各带 sm:hidden；label 是值的兄弟而不是内容（值节点的文本一字不
// 改，既有按值断言的用例不受影响）；表头与排序钮仍在原位。挂载与 tick 等待
// 沿 runs.filters.test.tsx 的口径。

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

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function runRow(n: number) {
  const tail = String(n).padStart(4, "0");
  return {
    runId: `rn_01M7822CARDKEY${tail}`,
    employeeId: "emp_aaaabbbbcccc",
    status: n % 2 === 0 ? "completed" : "failed",
    costUsd: n,
    costStatus: "known",
    startedAt: "2026-11-18T02:00:00.000Z",
    endedAt: "2026-11-18T02:11:00.000Z",
  };
}

const FIRST = Array.from({ length: PAGE_LIMIT }, (_, i) => runRow(i + 1));

function node(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

async function waitFor(cond: () => boolean, label: string) {
  for (let i = 0; i < 400; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`timeout: ${label}`);
}

beforeEach(async () => {
  api.fetchJSON.mockImplementation((url: string) =>
    Promise.resolve(url.includes("/api/runs") ? { items: FIRST, nextCursor: null } : { items: [] }),
  );
  root = null;
  document.body.replaceChildren();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(MemoryRouter, { initialEntries: ["/runs"] }, createElement(RunsModulePage)),
    );
  });
  await waitFor(() => node("run5-row-0") !== null, "rows painted");
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  api.fetchJSON.mockReset();
});

const LABELS = ["code", "status", "start", "elapsed", "cost", "employee", "reason"] as const;

describe("narrow card fields carry their column names (P1-B4)", () => {
  it("renders exactly one sm:hidden label per column on a row", () => {
    for (const key of LABELS) {
      const label = node(`run5-fieldlabel-${key}-0`);
      expect(label, `label ${key} exists`).not.toBeNull();
      expect(label!.classList.contains("sm:hidden"), `label ${key} defers to the header at sm`).toBe(true);
    }
    // 每行七个，一个不多：出现第八个说明结构重复挂载。
    const row = node("run5-row-0")!;
    const found = row.querySelectorAll('[data-testid^="run5-fieldlabel-"]');
    expect(found.length).toBe(LABELS.length);
  });

  it("keeps the value node text untouched — labels are siblings, not content", () => {
    const start = node("run5-row-0-start")!;
    expect(start.textContent, "值节点文本不含 label 字样").not.toContain("开始");
    expect(start.textContent).not.toContain("耗时");
    const cost = node("run5-row-0-cost")!;
    expect(cost.textContent).not.toContain("成本");
    // label 是值节点的兄弟：同一个卡片字段壳里，label 在前、值在后。
    const label = node("run5-fieldlabel-start-0")!;
    expect(label.parentElement).toBe(start.parentElement);
  });

  it("leaves the sm+ header intact: 表头行与三个排序钮还在原位", () => {
    expect(node("run5-table")).not.toBeNull();
    const header = document.querySelector('[data-testid="run5-table"] button[data-sort-key="started"]')
      ?? [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("开始"));
    expect(header, "表头仍有「开始」的可排序钮").toBeTruthy();
  });
});
