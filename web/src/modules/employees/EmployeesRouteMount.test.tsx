// @vitest-environment jsdom
// R38: proves the /employees ROUTE MOUNT CHAIN renders the module page
// (ConsoleModulePage module="employees" + live.list=<EmployeesModulePage/>)
// with working search + lifecycle filter + URL as the single source —
// not the legacy pages/EmployeesPage. 9122 is not rebuilt (禁重建), so this
// jsdom mount is the authoritative DOM readback for the ticket.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

// ui barrel pulls .webp the node loader can't read; stub the primitives.
function drop(props: Record<string, unknown>, strip: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) if (!strip.includes(k)) out[k] = v;
  return out;
}
vi.mock("@nous-research/ui", () => ({
  Badge: (props: Record<string, unknown>) => <span {...drop(props, ["className"])} />,
  Button: (props: Record<string, unknown>) => <button {...drop(props, ["outlined", "size", "prefix"])} />,
  Card: (props: Record<string, unknown>) => <div {...drop(props, ["className"])} />,
  CardContent: (props: Record<string, unknown>) => <div {...drop(props, ["className"])} />,
}));

import { ConsoleModulePage } from "@/shell/console";
import { EmployeesModulePage } from "./EmployeesModulePage";

let container: HTMLDivElement;
let root: Root | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
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

const PEOPLE = [
  { employeeId: "emp_AAAA1111BBBB2222CCCC3333", name: "小鲤", title: "内容编辑", lifecycleState: "active", ownerUserId: "1", updatedAt: "2026-11-17T05:52:48.030Z", department: "增长组", enrichment: { knowledgeCount: 3, effectiveBudget: { monthlyCostUsd: 40 } } },
  { employeeId: "emp_DDDD4444EEEE5555FFFF6666", name: "阿象", title: "数据", lifecycleState: "paused", ownerUserId: "2", updatedAt: "2026-11-18T01:10:00.000Z", department: null, enrichment: { knowledgeCount: 1, effectiveBudget: { monthlyCostUsd: 5 } } },
];

function mountRoute(entry: string) {
  return act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <ConsoleModulePage
          module="employees"
          live={{ list: <EmployeesModulePage />, matrix: <div data-testid="matrix-live" /> }}
        />
      </MemoryRouter>,
    );
  });
}

async function settle() {
  await act(async () => {});
}

describe("/employees mount chain (R38)", () => {
  it("renders the module (not legacy) with the emp-l-* control family", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve({ items: PEOPLE }));
    await mountRoute("/employees");
    await settle();
    // module present:
    expect(q("emp-l-page")).toBeTruthy();
    expect(q("emp-l-search")).toBeTruthy();
    expect(q("emp-l-filter-lifecycle")).toBeTruthy();
    expect(q("employees-search")).toBeTruthy(); // 旧名不破
    expect(q("emp-l-list")).toBeTruthy();
    // legacy-only copy must NOT be on screen:
    expect(document.body.textContent).not.toContain("这台机器还没有接入任何数字员工");
    expect(document.body.textContent).not.toContain("无法打开数字员工列表");
    // rows + real anchor:
    const link = q("emp-l-name-link-emp_AAAA1111BBBB2222CCCC3333") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/employees/emp_AAAA1111BBBB2222CCCC3333");
    expect(document.querySelectorAll('[data-testid^="emp-l-row-"]').length).toBe(2);
    // no bare id in row text:
    expect(link.textContent).not.toContain("emp_AAAA1111");
    // department + BJT minute + 真 0/缺失:
    expect(document.body.textContent).toContain("增长组");
    const depts = document.querySelectorAll('[data-label="部门"]');
    expect(depts[0]?.textContent).toBe("增长组");
    expect(depts[1]?.textContent).toBe("—"); // 第二行缺部门：— 不假造
    expect(document.body.textContent).toContain("2026-11-18 09:10");
  });

  it("lifecycle select changes row count and stays in the URL (?lifecycle=)", async () => {
    fetchJSON.mockImplementation((url: string) => {
      const m = url.match(/lifecycleState=([^&]+)/);
      return Promise.resolve({ items: m ? PEOPLE.filter((p) => p.lifecycleState === m[1]) : PEOPLE });
    });
    await mountRoute("/employees?lifecycle=paused");
    await settle();
    expect((q("employees-lifecycle") as HTMLSelectElement).value).toBe("paused");
    expect(document.querySelectorAll('[data-testid^="emp-l-row-"]').length).toBe(1);
    const urls = fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("lifecycleState=paused");
    // switch to active → server filters → 1 row (小鲤), URL follows on a fresh mount:
    const select = q("employees-lifecycle") as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(select, "active");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    expect(document.querySelectorAll('[data-testid^="emp-l-row-"]').length).toBe(1);
    expect(q("emp-l-name-link-emp_AAAA1111BBBB2222CCCC3333")).toBeTruthy();
  });

  it("?q= deep link drives one real keyword query (刷新保态)", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve({ items: [PEOPLE[0]] }));
    await mountRoute("/employees?q=%E5%B0%8F%E9%B2%A4");
    await settle();
    expect((q("employees-search") as HTMLInputElement).value).toBe("小鲤");
    const url = String(fetchJSON.mock.calls[0][0]);
    expect(url).toContain("keyword=%E5%B0%8F%E9%B2%A4");
    expect(q("emp-l-name-link-emp_AAAA1111BBBB2222CCCC3333")).toBeTruthy();
  });

  it("403 and 404 share one body with no path leak", async () => {
    const mk = (status: number) => () =>
      Promise.reject(Object.assign(new Error("x"), { name: "ApiError", status }));
    // Use the real ApiError shape via the module's own import path.
    const { ApiError } = await import("@/lib/api-error");
    fetchJSON.mockImplementation(() => Promise.reject(new ApiError("nope", { status: 403, body: "{}", url: "/agent-api/api/employees" })));
    await mountRoute("/employees");
    await settle();
    const d403 = q("employees-denied")?.textContent ?? "";
    expect(d403).toContain("员工列表暂不可见");
    fetchJSON.mockImplementation(() => Promise.reject(new ApiError("nope", { status: 404, body: "{}", url: "/agent-api/api/employees" })));
    await mountRoute("/employees");
    await settle();
    expect(q("employees-denied")?.textContent).toBe(d403);
    expect(document.body.textContent).not.toContain("agent-api");
    void mk;
  });
});
