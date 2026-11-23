// @vitest-environment jsdom
// R214: employees empty-state and clear guards for /employees — tests only,
// no product file is touched. Coverage adjudication (already-guarded parts,
// evidence only, never rewritten here):
//   - ② empty export/copy disabled + title + click fetches nothing + no blob
//     = employees.export.test.tsx "a disabled button never triggers a request
//     or a blob" (R144) + EmployeesModulePage.test.tsx R69 "three controls
//     disabled with stated causes";
//   - error vs empty anchor exclusivity + copyable rid = employees.error.test.tsx
//     (R178 ①) and R69 "error state: plain reason + copyable rid + retry";
//   - pagination family stays mounted on empty + unknown ?status= untouched =
//     employees.filters.test.tsx (R115 ④).
// New in this suite: ① one-scene empty matrix (card + filtered wording + clear
// exit + count is  — never a fake 0), ③ clicking the empty card's clear exit
// refetches exactly once without the stale keyword/cursor and the count
// matches the restored rows, ④ after an error retry the screen is back to
// rows (no empty card) with 行数 == emp-list-count.
// Honest wording note: the empty card's hint says 「真实空集」 and the count
// title may carry 「读口如实返回 0 人」 — that zero is an explanation, not a
// fake counter, so the no-fake-0 lock targets emp-list-count itself.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The ui barrel pulls in .webp assets that node cannot load; stub the four
// primitives the page uses (deep-path imports would change product code).
vi.mock("@nous-research/ui", () => ({
  Badge: (props: Record<string, unknown>) => <span {...drop(props, ["className"])} />,
  Button: (props: Record<string, unknown>) => <button {...drop(props, ["outlined", "size", "prefix"])} />,
  Card: (props: Record<string, unknown>) => <div {...drop(props, ["className"])} />,
  CardContent: (props: Record<string, unknown>) => <div {...drop(props, ["className"])} />,
}));

function drop(props: Record<string, unknown>, strip: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!strip.includes(k)) out[k] = v;
  }
  return out;
}

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import { ApiError } from "@/lib/api-error";
import { EmployeesModulePage } from "./EmployeesModulePage";

let container: HTMLDivElement;
let root: Root | null = null;
const lastSearch = () => document.body.getAttribute("data-last-search") ?? "";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function LocProbe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-last-search", loc.search);
  }, [loc.search]);
  return null;
}

beforeEach(() => {
  document.body.removeAttribute("data-last-search");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  fetchJSON.mockReset();
  vi.useRealTimers();
});

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="employees-row-"]')).map((el) =>
    (el.getAttribute("data-testid") ?? "").replace("employees-row-", ""),
  );

async function waitFor(check: () => boolean, label: string) {
  const t0 = Date.now();
  while (!check()) {
    if (Date.now() - t0 > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

async function render(entry: string) {
  // MemoryRouter ignores initialEntries updates on an existing tree — a
  // remount (the refresh equivalent) must start from a fresh root.
  await act(async () => {
    root?.unmount();
  });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[entry]}>
        <EmployeesModulePage />
        <LocProbe />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

function flushTimers() {
  // The search box debounces at 300ms; fake timers are active.
  vi.advanceTimersByTime(320);
}

const ROW_A = {
  employeeId: "emp_217A91BA995044DFBB3E2E940B",
  name: "小鲤",
  title: "内容编辑",
  lifecycleState: "active",
  ownerUserId: "1",
  updatedAt: "2026-11-17T05:52:48.030Z",
  department: null,
  enrichment: { knowledgeCount: 1 },
};
const ROW_B = {
  employeeId: "emp_2B2C2D2E4F506172",
  name: "阿朝",
  title: "增长组负责人",
  lifecycleState: "active",
  ownerUserId: "1",
  updatedAt: "2026-11-18T05:52:48.030Z",
  department: "增长组",
  enrichment: { knowledgeCount: 2 },
};

const FULL = { items: [ROW_A, ROW_B] };
const EMPTY = { items: [] };

// 「无此内容zz」 as a keyword filter returns nothing upstream.
const NO_HIT_Q = "/employees?q=%E6%97%A0%E6%AD%A4%E5%86%85%E5%AE%B9zz";
const KEYWORD_ENC = "keyword=%E6%97%A0%E6%AD%A4%E5%86%85%E5%AE%B9zz";

type UrlLog = { all: string[]; employees: () => string[] };
function watchUrls(): UrlLog {
  const all: string[] = [];
  return {
    all,
    employees: () => all.filter((u) => u.includes("/api/employees")),
  };
}

describe("R214 employees empty state and clear guards", () => {
  it("① a filtered empty answer shows one honest matrix: card + clear exit, count is —, never a fake 0", async () => {
    const urls = watchUrls();
    fetchJSON.mockImplementation((url: string) => {
      urls.all.push(String(url));
      return Promise.resolve(String(url).includes("keyword=") ? EMPTY : FULL);
    });
    await render(NO_HIT_Q);
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    // Exactly one query, carrying the keyword; the cursor is never invented.
    const calls = urls.employees();
    expect(calls, "one real query").toHaveLength(1);
    expect(calls[0]).toContain(KEYWORD_ENC);
    expect(calls[0]).not.toContain("cursor=");
    // The empty card with the filtered wording and its clear exit.
    expect(q("employees-empty"), "empty card").toBeTruthy();
    expect(q("emp-list-empty-text")?.textContent).toContain("没有匹配的员工");
    expect(q("emp-list-state-clear"), "filtered empty offers the clear exit").toBeTruthy();
    // No fake zero: the count position holds  —, not 0.
    expect(q("emp-list-count")?.textContent).toBe("—");
    // The pagination family is not unmounted under the empty card.
    expect(q("emp-list-page")).toBeTruthy();
    expect(q("emp-list-page-count")).toBeTruthy();
    expect(q("emp-list-page-more")).toBeTruthy();
    expect((q("emp-list-page-more") as HTMLButtonElement).disabled).toBe(true);
    // Nothing leaks placeholders or raw states onto the screen.
    const screen = document.body.textContent ?? "";
    expect(screen).not.toMatch(/undefined|null/);
    expect(screen).not.toContain("NaN");
  });

  it("③ clicking the empty card clear refetches exactly once without the stale keyword or cursor, count matches rows", async () => {
    const urls = watchUrls();
    fetchJSON.mockImplementation((url: string) => {
      urls.all.push(String(url));
      return Promise.resolve(String(url).includes("keyword=") ? EMPTY : FULL);
    });
    await render(NO_HIT_Q);
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    expect(rowIds(), "starts empty").toHaveLength(0);
    const clear = q("emp-list-state-clear") as HTMLButtonElement;
    urls.all.length = 0;
    await act(async () => {
      clear.click();
    });
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    const fresh = urls.employees();
    expect(fresh, "clearing refetches exactly once").toHaveLength(1);
    expect(fresh[0], "the stale keyword is gone from the request").not.toContain("keyword=");
    expect(fresh[0], "no stale cursor rides along").not.toContain("cursor=");
    await waitFor(() => rowIds().length === 2, "rows return after clearing");
    // Count and rows are the same source.
    expect(q("emp-list-count")?.textContent).toBe(String(rowIds().length));
    expect(lastSearch(), "the URL drops the search term").not.toContain("q=%E6%97%A0%E6%AD%A4%E5%86%85%E5%AE%B9zz");
    expect(q("employees-empty"), "the empty card is gone").toBeNull();
  });

  it("④ after an error retry the screen is rows again — no empty card, and 行数 == emp-list-count", async () => {
    const urls = watchUrls();
    let failOnce = true;
    fetchJSON.mockImplementation((url: string) => {
      urls.all.push(String(url));
      if (failOnce) {
        failOnce = false;
        return Promise.reject(
          new ApiError("boom", {
            status: 500,
            body: JSON.stringify({ message: "上游炸了" }),
            url: String(url),
            requestId: "req-r214-500",
          }),
        );
      }
      return Promise.resolve(FULL);
    });
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    // Error state only — the empty card and its wording stay away (R178/R69
    // own the exclusivity matrix; this guards the recovery leg).
    expect(q("employees-error"), "error card").toBeTruthy();
    expect(q("emp-list-state-rid")?.textContent).toContain("req-r214-500");
    expect(q("employees-empty")).toBeNull();
    expect(q("emp-list-state-empty-text")).toBeNull();
    const before = urls.employees().length;
    const retry = q("employees-error-retry") as HTMLButtonElement;
    expect(retry, "the error card carries a retry").toBeTruthy();
    await act(async () => {
      retry.click();
    });
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    expect(urls.employees().length, "retry refetches exactly once").toBe(before + 1);
    await waitFor(() => rowIds().length === 2, "rows return after the retry");
    expect(q("employees-error"), "the error card is gone").toBeNull();
    expect(q("emp-list-state-rid"), "the rid anchor is gone").toBeNull();
    expect(q("employees-empty"), "no empty card after recovery").toBeNull();
    // Rows on screen and the count agree again.
    expect(q("emp-list-count")?.textContent).toBe(String(rowIds().length));
  });
});
