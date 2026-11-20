// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import { csvTimestamp } from "@/modules/employees/EmployeesModulePage";

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

const twoRows = {
  items: [
    ...rowsBody.items,
    {
      employeeId: "emp_CCCC3333DDDD4444EEEE5555",
      name: "阿朝",
      lifecycleState: "active",
      ownerUserId: "2",
      updatedAt: "2026-11-18T01:30:00.000Z",
      department: "增长组",
      enrichment: null,
    },
  ],
};

describe("R63 inline row preview (emp-row-preview-*)", () => {
  it("expands from the row data alone — zero extra requests, honest fields, Esc refocuses", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(twoRows));
    await render("/employees");
    const callsBefore = fetchJSON.mock.calls.length;
    const toggle = q("emp-row-preview-toggle-emp_217A91BA995044DFBB3E2E940B") as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      toggle.click();
    });
    expect(fetchJSON.mock.calls.length).toBe(callsBefore); // 禁额外请求
    const preview = q("emp-row-preview-emp_217A91BA995044DFBB3E2E940B");
    expect(preview).toBeTruthy();
    expect(preview.textContent).toContain("小鲤");
    expect(preview.textContent).toContain("员工 · 217A91BA");
    expect(preview.textContent).toContain("待核实"); // weird_state → 待核实，title 带原值
    expect(preview.textContent).toContain("内容编辑");
    expect(preview.textContent).toContain("2026-11-17 13:52"); // BJT 到分
    expect(preview.textContent).toContain("请求编号：该字段未返回");
    expect(preview.textContent).not.toContain("emp_217A91BA995044DFBB3E2E940B "); // 屏上文本不铺裸全 id
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    // Esc 收起且焦点回原钮（键盘场景：焦点本就在钮上）
    toggle.focus();
    await act(async () => {
      toggle.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(q("emp-row-preview-emp_217A91BA995044DFBB3E2E940B")).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("at most one row is open; the URL never moves; a missing title states 该字段未返回", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(twoRows));
    const searchBefore = document.body.getAttribute("data-last-search");
    await render("/employees");
    const t1 = q("emp-row-preview-toggle-emp_217A91BA995044DFBB3E2E940B") as HTMLButtonElement;
    const t2 = q("emp-row-preview-toggle-emp_CCCC3333DDDD4444EEEE5555") as HTMLButtonElement;
    await act(async () => {
      t1.click();
    });
    expect(q("emp-row-preview-emp_217A91BA995044DFBB3E2E940B")).toBeTruthy();
    await act(async () => {
      t2.click();
    });
    expect(q("emp-row-preview-emp_217A91BA995044DFBB3E2E940B")).toBeNull(); // 同时仅一行
    const p2 = q("emp-row-preview-emp_CCCC3333DDDD4444EEEE5555");
    expect(p2).toBeTruthy();
    expect(p2.textContent).toContain("该字段未返回"); // 阿朝无 title
    expect(p2.getAttribute("title") ?? document.body.textContent).toBeTruthy();
    expect(document.body.getAttribute("data-last-search")).toBe(searchBefore ?? ""); // URL 零改动
    expect(document.body.getAttribute("data-last-search")).toBe("");
  });
});

describe("R64 employees list copy as text (emp-list-copy)", () => {
  const twoRows = {
    items: [
      ...rowsBody.items,
      { employeeId: "emp_2B2C2D2E4F506172", name: "阿朝", title: "增长", lifecycleState: "active", updatedAt: "2026-11-18T05:52:48.030Z", department: "增长组" },
    ],
  };

  const stubClipboard = (impl?: (t: string) => Promise<void>) => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: impl
          ? impl
          : async (t: string) => {
              written.push(t);
            },
      },
    });
    return written;
  };

  it("copies the on-screen rows verbatim without any extra request", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(twoRows));
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    const callsBefore = fetchJSON.mock.calls.length;
    const written = stubClipboard();
    const btn = q("emp-list-copy") as HTMLButtonElement | null;
    expect(btn, "copy button on screen").toBeTruthy();
    expect(btn!.disabled, "ready list enables copy").toBe(false);
    expect(btn!.title).toContain("当前已加载 2 人");
    await act(async () => {
      btn!.click();
    });
    await act(async () => {});
    expect(fetchJSON.mock.calls.length, "copy never fetches").toBe(callsBefore);
    expect(written.length).toBe(1);
    const lines = written[0].split("\n");
    expect(lines[0]).toBe("name,employee_no,lifecycle,last_active");
    expect(lines).toHaveLength(3); // 表头 + 屏上 2 人
    expect(lines[1]).toContain("小鲤");
    expect(lines[1]).toContain("员工 · 217A91BA");
    expect(lines[1]).toContain("待核实"); // weird_state → 人话 default
    expect(lines[1]).toContain("2026-11-17 13:52"); // BJT 到分
    expect(lines[2]).toContain("阿朝");
    expect(lines[2]).toContain("在岗");
    expect(written[0]).not.toContain("emp_"); // 禁裸工号全量
    expect(q("emp-list-copy-status")?.textContent).toContain("已复制 2 行");
    expect(q("emp-list-copy-fallback")).toBeNull();
  });

  it("escapes a comma-bearing name and keeps it verbatim on both paths", async () => {
    fetchJSON.mockImplementation(() =>
      Promise.resolve({
        items: [{ ...rowsBody.items[0], name: "小鲤, 带头" }],
      }),
    );
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    const written = stubClipboard();
    const btn = q("emp-list-copy") as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    await act(async () => {});
    expect(written[0]).toContain('"小鲤, 带头"'); // RFC4180 转义
    // 屏上姓名列与复制行同源
    const nameCell = document.querySelector('[data-testid="emp-l-row-emp_217A91BA995044DFBB3E2E940B"]');
    expect(nameCell?.textContent).toContain("小鲤, 带头");
  });

  it("falls back to a read-only textarea when the clipboard refuses", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(twoRows));
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    stubClipboard(async () => {
      throw new Error("denied");
    });
    const btn = q("emp-list-copy") as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    await act(async () => {});
    expect(q("emp-list-copy-status")?.textContent).toContain("手动复制");
    const area = q("emp-list-copy-fallback") as HTMLTextAreaElement | null;
    expect(area, "fallback textarea").toBeTruthy();
    expect(area!.readOnly).toBe(true);
    expect(area!.value.split("\n")).toHaveLength(3);
    expect(area!.value).toContain("员工 · 217A91BA");
  });

  it("disables with a stated reason when nothing is loaded", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve({ items: [] }));
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    const btn = q("emp-list-copy") as HTMLButtonElement | null;
    expect(btn, "button still rendered in empty state").toBeTruthy();
    expect(btn!.disabled).toBe(true);
    expect(btn!.title).toContain("当前已加载 0 人");
  });
});

describe("R58 pagination and honest total (emp-list-page-*)", () => {
  const page1 = {
    items: [
      ...rowsBody.items,
      { employeeId: "emp_2B2C2D2E4F506172", name: "阿朝", title: "增长", lifecycleState: "active", updatedAt: "2026-11-18T05:52:48.030Z", department: "增长组" },
    ],
    nextCursor: "c-page-2",
  };
  const page2 = {
    items: [
      { employeeId: "emp_3C3D3E3F40414243", name: "新工", title: "数据", lifecycleState: "active", updatedAt: "2026-11-19T01:00:00Z", department: null },
      // 服务端窗口重叠时重复返回阿朝：前端必须去重，禁重复行。
      { employeeId: "emp_2B2C2D2E4F506172", name: "阿朝", title: "增长", lifecycleState: "active", updatedAt: "2026-11-18T05:52:48.030Z", department: "增长组" },
    ],
  };

  const stubPages = (urls: string[]) => {
    fetchJSON.mockImplementation((url: string) => {
      urls.push(String(url));
      return Promise.resolve(String(url).includes("cursor=") ? page2 : page1);
    });
  };

  it("states the missing total honestly and pages with the real cursor, deduping appended rows", async () => {
    const urls: string[] = [];
    stubPages(urls);
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    const count = q("emp-list-page-count");
    expect(count?.textContent).toContain("总数不可用 · 已显示 2 人");
    expect(count?.getAttribute("title")).toContain("无 total 键");
    const more = q("emp-list-page-more") as HTMLButtonElement | null;
    expect(more, "more button").toBeTruthy();
    expect(more!.disabled, "cursor present enables more").toBe(false);
    expect(q("emp-list-page-end")).toBeNull();
    await act(async () => {
      more!.click();
    });
    await act(async () => {});
    const paged = urls.filter((u) => u.includes("cursor=c-page-2"));
    expect(paged, "exactly one cursor query").toHaveLength(1);
    expect(document.querySelectorAll('[data-testid^="emp-l-row-"]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-testid="emp-l-row-emp_2B2C2D2E4F506172"]')).toHaveLength(1);
    expect((q("emp-list-page-more") as HTMLButtonElement).disabled, "last page disables more").toBe(true);
    expect(q("emp-list-page-end")?.textContent).toContain("已到末页");
    expect(q("emp-list-page-count")?.textContent).toContain("已显示 3 人");
  });

  it("switching lifecycle resets the cursor and replaces (never appends) rows, keeping the URL", async () => {
    const urls: string[] = [];
    stubPages(urls);
    await render("/employees?sort=name&dir=desc");
    await act(async () => {
      flushTimers();
    });
    // 先翻到第二页（游标已消费）
    const more = q("emp-list-page-more") as HTMLButtonElement;
    await act(async () => {
      more.click();
    });
    await act(async () => {});
    urls.length = 0;
    const select = q("employees-lifecycle") as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(select, "active");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      flushTimers();
    });
    await act(async () => {});
    const fresh = urls.filter((u) => u.includes("/api/employees"));
    expect(fresh.length, "filter change refetches once").toBe(1);
    expect(fresh[0]).not.toContain("cursor=");
    expect(fresh[0]).toContain("lifecycleState=active");
    expect(document.querySelectorAll('[data-testid^="emp-l-row-"]')).toHaveLength(2);
    expect(lastSearch()).toContain("lifecycle=active");
    expect(lastSearch()).toContain("sort=name");
    expect(lastSearch()).toContain("dir=desc");
  });

  it("a failed load keeps the copyable rid under the page-error alias with retry", async () => {
    fetchJSON.mockImplementation(() =>
      Promise.reject(
        new ApiError("boom", { status: 502, body: "{}", url: "/agent-api/api/employees", requestId: "req-r58-502" }),
      ),
    );
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    await act(async () => {});
    expect(document.querySelector('[data-emp-list-page-error="true"]')).toBeTruthy();
    const card = q("employees-error");
    expect(card?.textContent).toContain("请求编号：req-r58-502");
    expect(q("req-copy")).toBeTruthy();
    expect(q("employees-error-retry")).toBeTruthy();
  });

  it("the first page carries no cursor param at all", async () => {
    const urls: string[] = [];
    stubPages(urls);
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    expect(urls.filter((u) => u.includes("cursor="))).toHaveLength(0);
    expect((q("emp-list-copy") as HTMLButtonElement | null)?.disabled, "copy still on screen").toBe(false);
  });
});

describe("R66 employees list CSV export (emp-list-export)", () => {
  const twoRowsCsv = {
    items: [
      { ...rowsBody.items[0], name: "小鲤, 带头" },
      { employeeId: "emp_2B2C2D2E4F506172", name: "阿朝", title: "增长", lifecycleState: "weird_state", updatedAt: null, department: "增长组" },
    ],
  };

  const stubObjectUrl = () => {
    let captured: Blob | null = null;
    const saved = URL.createObjectURL;
    const savedRevoke = URL.revokeObjectURL;
    URL.createObjectURL = ((b: Blob) => {
      captured = b;
      return "blob:mock";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    return {
      async text() {
        return captured ? captured.text() : "";
      },
      async head() {
        if (!captured) return new Uint8Array();
        return new Uint8Array(await captured.slice(0, 3).arrayBuffer());
      },
      restore() {
        URL.createObjectURL = saved;
        URL.revokeObjectURL = savedRevoke;
      },
    };
  };

  it("names the file with the Beijing export minute, day-crossing included", () => {
    expect(csvTimestamp(new Date("2026-11-20T02:00:00Z"))).toBe("employees-20261120-1000.csv");
    expect(csvTimestamp(new Date("2026-11-20T16:05:00Z"))).toBe("employees-20261121-0005.csv");
  });

  it("exports the on-screen rows verbatim with zero extra requests", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve(twoRowsCsv));
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    const callsBefore = fetchJSON.mock.calls.length;
    const btn = q("emp-list-export") as HTMLButtonElement | null;
    expect(btn, "export button on screen").toBeTruthy();
    expect(btn!.disabled).toBe(false);
    expect(btn!.title).toContain("导出当前已加载 2 人，不是全量");
    expect(q("emp-list-export-count")?.textContent).toContain("共 2 行");
    const stub = stubObjectUrl();
    await act(async () => {
      btn!.click();
    });
    const raw = await stub.text();
    stub.restore();
    expect(fetchJSON.mock.calls.length, "export never fetches").toBe(callsBefore);
    const lines = raw.replace(/^\uFEFF/, "").split("\r\n").filter((l) => l !== "");
    expect(lines).toHaveLength(3); // 表头 + 屏上 2 人
    expect(lines[0]).toBe("name,employee_no,lifecycle,last_active");
    expect(lines[1]).toContain('"小鲤, 带头"'); // RFC4180 逗号转义
    expect(lines[1]).toContain("员工 · 217A91BA");
    expect(lines[2].endsWith(",")).toBe(true); // last_active 缺=空字段（非「—」非 0）
    expect(lines[2]).toContain("待核实"); // weird_state 人话
    // Blob.text() 按规范剥离前导 BOM，字节级验证 Excel 兼容头
    expect(Array.from(await stub.head())).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("disables with a stated reason when nothing is loaded", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve({ items: [] }));
    await render("/employees");
    await act(async () => {
      flushTimers();
    });
    const btn = q("emp-list-export") as HTMLButtonElement | null;
    expect(btn, "button still rendered in empty state").toBeTruthy();
    expect(btn!.disabled).toBe(true);
    expect(btn!.title).toContain("当前已加载 0 人");
  });
});
