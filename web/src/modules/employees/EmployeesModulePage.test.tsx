// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

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
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  fetchJSON.mockReset();
});

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);

async function render(entry: string) {
  // MemoryRouter ignores initialEntries updates on an existing tree — a
  // re-render must start from a fresh root (R39 rid case).
  await act(async () => {
    root?.unmount();
  });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <EmployeesModulePage />
        <LocProbe />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

function flushTimers() {
  // The search box debounces at 300ms; real timers + one act tick are enough
  // because vi uses fake timers in these tests.
  vi.advanceTimersByTime(320);
}

const rowsBody = {
  items: [
    {
      employeeId: "emp_217A91BA995044DFBB3E2E940B",
      name: "小鲤",
      title: "内容编辑",
      lifecycleState: "weird_state",
      ownerUserId: "1",
      updatedAt: "2026-11-17T05:52:48.030Z",
      department: null,
      enrichment: { knowledgeCount: 1, effectiveBudget: { monthlyCostUsd: 10 } },
    },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EmployeesModulePage list depth", () => {
  it("reopens a shared ?q=&lifecycle= URL with exactly one real query", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(rowsBody));
    await render("/employees?q=%E5%B0%8F%E9%B2%A4&lifecycle=active");
    expect(fetchJSON).toHaveBeenCalledTimes(1);
    const url = String(fetchJSON.mock.calls[0][0]);
    expect(url).toContain("keyword=%E5%B0%8F%E9%B2%A4");
    expect(url).toContain("lifecycleState=active");
    expect(lastSearch()).toContain("q=%E5%B0%8F%E9%B2%A4");
    expect(q("emp-l-search")).toBeTruthy();
    expect(q("emp-l-filter-lifecycle")).toBeTruthy();
    expect(q("emp-l-list")).toBeTruthy();
    expect(q("emp-l-row-emp_217A91BA995044DFBB3E2E940B")).toBeTruthy();
  });

  it("renders the row family: real link, masked code, 待核实 status, — department, BJT minute", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(rowsBody));
    await render("/employees");
    const link = q("emp-l-name-link-emp_217A91BA995044DFBB3E2E940B") as HTMLAnchorElement;
    expect(link?.getAttribute("href")).toBe("/employees/emp_217A91BA995044DFBB3E2E940B");
    expect(link.textContent).toContain("小鲤");
    expect(link.textContent).toContain("员工 · 217A91BA");
    expect(link.textContent).not.toContain("emp_217A91BA995044DFBB3E2E940B");
    // Unknown lifecycle states never get invented words.
    expect(link.textContent).toContain("待核实");
    const dept = document.querySelector('[data-label="部门"]');
    expect(dept?.textContent).toBe("—");
    expect(dept?.getAttribute("title")).toContain("上游响应没有带部门信息");
    expect(document.querySelector('[data-label="最近活跃"]')?.textContent).toBe("2026-11-17 13:52");
  });

  it("typing a search writes the URL and re-queries with keyword", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(rowsBody));
    await render("/employees");
    const input = q("employees-search") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "QA2");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      flushTimers();
    });
    await act(async () => {});
    expect(lastSearch()).toContain("q=QA2");
    const urls = fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("keyword=QA2"))).toBe(true);
  });

  it("the lifecycle select queries and stays in the URL across refresh", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(rowsBody));
    await render("/employees");
    const select = q("employees-lifecycle") as HTMLSelectElement;
    await act(async () => {
      select.value = "paused";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {});
    expect(lastSearch()).toContain("lifecycle=paused");
    const urls = fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("lifecycleState=paused"))).toBe(true);
    // A fresh mount of the same URL (refresh) starts from it again.
    await render("/employees?lifecycle=paused");
    expect((q("employees-lifecycle") as HTMLSelectElement).value).toBe("paused");
  });

  it("forced ?state=error&rid= shows that request id, copyable, with retry (R39)", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve({ items: [] }));
    await render("/employees?state=error&rid=fs-77");
    const card = q("employees-error");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("fs-77");
    expect(q("req-copy")).toBeTruthy();
    expect(document.body.textContent).toContain("重试");
    // rid is read from the same params snapshot as state: changing it re-renders.
    await render("/employees?state=error&rid=fs-88");
    expect(q("employees-error")?.textContent).toContain("fs-88");
  });

  it("R53: emp-list-* scope note, same-source count, and empty exit are on screen", async () => {
    const urls: string[] = [];
    const twoRows = {
      items: [
        ...rowsBody.items,
        { employeeId: "emp_2B2C2D2E4F506172", name: "阿朝", title: "增长", lifecycleState: "active", updatedAt: "2026-11-18T05:52:48.030Z", department: "增长组" },
      ],
    };
    fetchJSON.mockImplementation((url: string) => {
      urls.push(url);
      if (String(url).includes("keyword=nomatch")) return Promise.resolve({ items: [] });
      return Promise.resolve(twoRows);
    });
    await render("/employees");
    const note = q("emp-list-scope-note");
    expect(note?.textContent).toContain("服务端真参数");
    expect(note?.getAttribute("title")).toContain("q/query/name");
    expect(q("emp-list-count")?.textContent).toBe("2");
    // typing a non-matching keyword re-queries exactly once more (server mode,
    // no extra local request).
    const input = q("employees-search") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    urls.length = 0;
    await act(async () => {
      setter?.call(input, "nomatch");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      flushTimers();
    });
    await act(async () => {});
    const calls = urls.filter((u) => String(u).includes("/api/employees"));
    expect(calls).toHaveLength(1);
    expect(String(calls[0])).toContain("keyword=nomatch");
    expect(q("emp-list-empty-text")?.textContent).toBe("没有匹配的员工");
    expect(document.querySelector('[data-emp-list-empty="true"]')).toBeTruthy();
    const clear = q("employees-clear") as HTMLButtonElement;
    await act(async () => {
      clear.click();
    });
    await act(async () => {});
    expect((q("employees-search") as HTMLInputElement).value).toBe("");
  });

  it("R40: rid is read live when the router snapshot lost it, and the copy round-trips", async () => {
    // Mirror the shell override: the window URL carries the rid, but the
    // route entry the module mounts with has only the state. The module must
    // still read the id live (never invent one).
    window.history.replaceState(null, "", "/employees?state=error&rid=live-42");
    fetchJSON.mockImplementation(() => Promise.resolve(rowsBody));
    let copied: string | null = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (t: string) => { copied = t; return Promise.resolve(); } },
    });
    await render("/employees?state=error");
    expect(q("employees-error")).toBeTruthy();
    expect(q("employees-error")?.textContent).toContain("live-42");
    const copy = q("req-copy") as HTMLButtonElement;
    expect(copy).toBeTruthy();
    await act(async () => {
      copy.click();
    });
    expect(copied).toBe("live-42");
    expect(q("req-copy-state")?.textContent).toContain("已复制");
    // The retry control sits on the same card as the id.
    expect(q("employees-error")?.querySelector('[data-testid="employees-error-retry"]')).toBeTruthy();
    expect(fetchJSON.mock.calls.filter((c) => String(c[0]).includes("api/employees")).length).toBe(0);
  });

  it("403 and 404 answer with the same body and never echo a path", async () => {
    const mk = (status: number) => () =>
      Promise.reject(new ApiError("nope", { status, body: "{}", url: "/agent-api/api/employees" }));
    fetchJSON.mockImplementation(mk(403));
    await render("/employees");
    const deniedText = q("employees-denied")?.textContent ?? "";
    expect(deniedText).toContain("员工列表暂不可见");
    fetchJSON.mockImplementation(mk(404));
    await render("/employees");
    expect(q("employees-denied")?.textContent).toBe(deniedText);
    expect(document.body.textContent).not.toContain("agent-api");
  });

  it("a 500 stays human with a copyable request id and a retry", async () => {
    fetchJSON.mockImplementation(() =>
      Promise.reject(
        new ApiError("boom", { status: 500, body: "{}", url: "/agent-api/api/employees", requestId: "req-empl-9" }),
      ),
    );
    await render("/employees");
    expect(q("employees-error")).toBeTruthy();
    expect(document.body.textContent).toContain("员工列表没能加载出来");
    expect(q("emp-copy-rid") || document.body.textContent?.includes("req-empl-9")).toBe(true);
  });
});

describe("R62 column sorting (emp-list-sort-*)", () => {
  const sortBody = {
    items: [
      { employeeId: "emp_CCCC3333DDDD4444", name: null, lifecycleState: "active", updatedAt: "2026-11-17T01:00:00Z" },
      { employeeId: "emp_AAAA1111BBBB2222", name: "小鲤", lifecycleState: "active", updatedAt: "2026-11-18T01:00:00Z" },
      { employeeId: "emp_BBBB2222CCCC3333", name: "阿朝", lifecycleState: "paused", updatedAt: "2026-11-16T01:00:00Z" },
    ],
  };

  const rowOrder = () =>
    Array.from(document.querySelectorAll('[data-testid^="emp-l-row-emp_"]')).map((el) =>
      String(el.getAttribute("data-testid")).replace("emp-l-row-", ""),
    );

  it("four sortable headers are real buttons; sorting is local, missing values sort last", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(sortBody));
    await render("/employees");
    const callsBefore = fetchJSON.mock.calls.length;
    for (const key of ["name", "code", "state", "time"]) {
      const el = q(`emp-list-sort-${key}`);
      expect(el?.tagName).toBe("BUTTON");
      expect(el?.getAttribute("type")).toBe("button");
      expect(el?.closest('[role="columnheader"]')?.getAttribute("aria-sort")).toBe("none");
    }
    // 口径注脚在表下，写明仅当前已加载行。
    const note = q("emp-list-sort-scope-note");
    expect(note?.textContent).toContain("排序仅在当前已加载 3 条内生效");
    expect(String(note?.getAttribute("title"))).toContain("200");

    const nameBtn = q("emp-list-sort-name") as HTMLButtonElement;
    await act(async () => {
      nameBtn.click();
    });
    await act(async () => {});
    expect(fetchJSON.mock.calls.length).toBe(callsBefore); // 本地排序：零新请求
    expect(lastSearch()).toContain("sort=name");
    expect(lastSearch()).toContain("dir=asc");
    expect(nameBtn.closest('[role="columnheader"]')?.getAttribute("aria-sort")).toBe("ascending");
    // zh 升序：阿朝 < 小鲤；缺姓名的行永远排末，不当作 0 排前。
    expect(rowOrder()).toEqual(["emp_BBBB2222CCCC3333", "emp_AAAA1111BBBB2222", "emp_CCCC3333DDDD4444"]);
  });

  it("third click on the same column clears the sort back to the server order", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(sortBody));
    await render("/employees?sort=time&dir=asc");
    const timeBtn = q("emp-list-sort-time") as HTMLButtonElement;
    expect(timeBtn.closest('[role="columnheader"]')?.getAttribute("aria-sort")).toBe("ascending");
    // 粘 URL 直达：time asc = 16 < 17 < 18。
    expect(rowOrder()).toEqual(["emp_BBBB2222CCCC3333", "emp_CCCC3333DDDD4444", "emp_AAAA1111BBBB2222"]);
    await act(async () => {
      timeBtn.click(); // asc → desc
    });
    await act(async () => {});
    expect(lastSearch()).toContain("dir=desc");
    expect(rowOrder()[0]).toBe("emp_AAAA1111BBBB2222");
    await act(async () => {
      timeBtn.click(); // desc → 清除
    });
    await act(async () => {});
    expect(lastSearch()).not.toContain("sort=");
    expect(timeBtn.closest('[role="columnheader"]')?.getAttribute("aria-sort")).toBe("none");
    // 回服务端原序（fixture 顺序）。
    expect(rowOrder()).toEqual(["emp_CCCC3333DDDD4444", "emp_AAAA1111BBBB2222", "emp_BBBB2222CCCC3333"]);
  });

  it("sort rides alongside ?q=&lifecycle= without dropping either, and never refetches", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(sortBody));
    await render("/employees?q=%E5%B0%8F%E9%B2%A4&lifecycle=active&sort=name&dir=desc");
    expect(fetchJSON).toHaveBeenCalledTimes(1); // 排序不触发新请求
    const url = String(fetchJSON.mock.calls[0][0]);
    expect(url).toContain("keyword=%E5%B0%8F%E9%B2%A4");
    expect(url).toContain("lifecycleState=active");
    expect(lastSearch()).toContain("q=%E5%B0%8F%E9%B2%A4");
    expect(rowOrder()).toEqual(["emp_AAAA1111BBBB2222", "emp_BBBB2222CCCC3333", "emp_CCCC3333DDDD4444"]);
    // 换排另一列：q/lifecycle 原样保留（组合共存）。
    const stateBtn = q("emp-list-sort-state") as HTMLButtonElement;
    await act(async () => {
      stateBtn.click();
    });
    await act(async () => {});
    expect(lastSearch()).toContain("q=%E5%B0%8F%E9%B2%A4");
    expect(lastSearch()).toContain("lifecycle=active");
    expect(lastSearch()).toContain("sort=state");
    expect(fetchJSON).toHaveBeenCalledTimes(1); // 依旧零新请求
    // paused > active（原始值升序），缺值行（无 lifecycleState 的行没有）不参与。
    expect(rowOrder()).toEqual(["emp_CCCC3333DDDD4444", "emp_AAAA1111BBBB2222", "emp_BBBB2222CCCC3333"]);
  });
});
