// @vitest-environment jsdom
// R115: filter URL contract guards for /employees — tests only, the product
// behaviour is recorded as it is (including the verdict that `status` is NOT
// a parameter this page consumes: it is neither backfilled, sent, nor
// rewritten away). No product file is touched by this suite.
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

import { EmployeesModulePage } from "./EmployeesModulePage";
import { pickOption, selectValue } from "@/shell/selectHarness";

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
    // Non-null: assigned one line above; `!` is erased at runtime.
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
  enrichment: { knowledgeCount: 1, effectiveBudget: { monthlyCostUsd: 10 } },
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
const ROW_C = {
  employeeId: "emp_3C3D3E3F40414243",
  name: "新工",
  title: "运维",
  lifecycleState: "paused",
  ownerUserId: "2",
  updatedAt: "2026-11-19T05:52:48.030Z",
  department: null,
  enrichment: {},
};

const oneRow = { items: [ROW_A] };
const emptyBody = { items: [] };
const page1 = { items: [ROW_A, ROW_B], nextCursor: "c-page-2" };
const page2 = { items: [ROW_C] };

type UrlLog = { all: string[]; employees: () => string[] };
function watchUrls(): UrlLog {
  const all: string[] = [];
  return {
    all,
    employees: () => all.filter((u) => u.includes("/api/employees")),
  };
}

describe("R115 employees filter URL contract", () => {
  it("backfills both controls from a deep link and the single query carries the exact server params", async () => {
    const urls = watchUrls();
    fetchJSON.mockImplementation((url: string) => {
      urls.all.push(String(url));
      return Promise.resolve(oneRow);
    });
    // `status` is not a parameter this page consumes — it must not leak into
    // the request either (unknown params are neither read nor forwarded).
    await render("/employees?lifecycle=paused&q=%E5%B0%8F%E9%B2%A4&status=__nope__");
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    const input = q("employees-search") as HTMLInputElement;
    expect(selectValue("employees-lifecycle"), "lifecycle deep link backfills the select").toBe("paused");
    expect(input.value, "q deep link backfills the search box").toBe("小鲤");
    const calls = urls.employees();
    expect(calls, "exactly one query on entry").toHaveLength(1);
    expect(calls[0]).toContain("keyword=%E5%B0%8F%E9%B2%A4");
    expect(calls[0]).toContain("lifecycleState=paused");
    expect(calls[0]).not.toContain("status=");
    expect(q("emp-l-row-emp_217A91BA995044DFBB3E2E940B")).toBeTruthy();
  });

  it("switching a filter after paging re-queries once from page one and keeps the other params verbatim", async () => {
    const urls = watchUrls();
    fetchJSON.mockImplementation((url: string) => {
      urls.all.push(String(url));
      return Promise.resolve(String(url).includes("cursor=") ? page2 : page1);
    });
    await render("/employees?q=%E5%B0%8F%E9%B2%A4");
    await act(async () => {
      flushTimers();
    });
    const more = q("emp-list-page-more") as HTMLButtonElement;
    expect(more, "cursor present enables more").toBeTruthy();
    await act(async () => {
      more.click();
    });
    await act(async () => {});
    expect(urls.employees().some((u) => u.includes("cursor=c-page-2")), "the cursor was used").toBe(true);
    expect(document.querySelectorAll('[data-testid^="emp-l-row-"]')).toHaveLength(3);
    urls.all.length = 0;
    await pickOption("employees-lifecycle", "在岗");
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    const fresh = urls.employees();
    expect(fresh, "filter change refetches exactly once").toHaveLength(1);
    expect(fresh[0]).not.toContain("cursor=");
    expect(fresh[0]).toContain("keyword=%E5%B0%8F%E9%B2%A4");
    expect(fresh[0]).toContain("lifecycleState=active");
    // Replaced, never appended: page two's row is gone.
    expect(document.querySelectorAll('[data-testid^="emp-l-row-"]')).toHaveLength(2);
    expect(document.querySelector('[data-testid="emp-l-row-emp_3C3D3E3F40414243"]')).toBeNull();
    expect(lastSearch()).toContain("q=%E5%B0%8F%E9%B2%A4");
    expect(lastSearch()).toContain("lifecycle=active");
  });

  it("remounting the same URL restores the controls, the identical query and the same rows", async () => {
    const urls = watchUrls();
    fetchJSON.mockImplementation((url: string) => {
      urls.all.push(String(url));
      return Promise.resolve(oneRow);
    });
    const entry = "/employees?lifecycle=active&q=abc";
    await render(entry);
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    const firstCalls = urls.employees();
    expect(firstCalls).toHaveLength(1);
    const firstQuery = firstCalls[0];
    const rowsFirst = document.querySelectorAll('[data-testid^="emp-l-row-"]').length;
    const valueFirst = (q("employees-search") as HTMLInputElement).value;
    // A ConsoleSelect button's `.value` is always "", so this pair of reads had
    // become '' === ''. data-value is the choice the control actually holds.
    const selectFirst = selectValue("employees-lifecycle");
    // A fresh root over the same URL is the refresh equivalent.
    await render(entry);
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    const secondCalls = urls.employees();
    expect(secondCalls, "one query per mount, nothing extra").toHaveLength(2);
    expect(secondCalls[1]).toBe(firstQuery);
    expect((q("employees-search") as HTMLInputElement).value).toBe(valueFirst);
    expect(selectValue("employees-lifecycle")).toBe(selectFirst);
    expect(document.querySelectorAll('[data-testid^="emp-l-row-"]')).toHaveLength(rowsFirst);
  });

  it("an unknown ?status= stays in the URL untouched while the page renders the honest empty state", async () => {
    const urls = watchUrls();
    fetchJSON.mockImplementation((url: string) => {
      urls.all.push(String(url));
      return Promise.resolve(emptyBody);
    });
    await render("/employees?status=__nope__");
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    // The page does not consume `status` and must not silently rewrite it.
    expect(lastSearch()).toContain("status=__nope__");
    const calls = urls.employees();
    expect(calls, "no extra requests from the unknown param").toHaveLength(1);
    expect(calls[0]).not.toContain("status=");
    // Readable empty state, not a blank page.
    expect(q("employees-empty")).toBeTruthy();
    expect(q("emp-list-empty-text")?.textContent).toContain("员工");
    // 分页容器仍在；没有游标就没有续取钮，也没有卡底计数句。
    expect(q("emp-list-page")).toBeTruthy();
    expect(q("emp-list-page-more")).toBeNull();
    expect(q("emp-list-page-count")).toBeNull();
  });
});
