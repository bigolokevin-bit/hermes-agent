// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

// @nous-research/ui ships .webp assets vitest cannot load; stub primitives.
vi.mock("@nous-research/ui", () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import { ApiError, SESSION_REQUIRED_GUIDANCE } from "@/lib/api-error";
import OrgModulePage from "@/modules/org/OrgModulePage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

function mockApi(handler: (url: string) => Promise<unknown>) {
  vi.mocked(fetchJSON).mockImplementation(((url: string) => handler(url)) as never);
}

const forbidden = (url: string) =>
  Promise.reject(new ApiError("forbidden", { status: 403, body: "", url }));
const missing = (url: string) =>
  Promise.reject(new ApiError("not found", { status: 404, body: "", url }));
const boom502 = (url: string) =>
  Promise.reject(new ApiError("服务暂时不可用。", { status: 502, body: "", url, requestId: "req-31" }));
const login401 = (url: string) =>
  Promise.reject(new ApiError("login", { status: 401, body: "", url, requestId: "req-login" }));

async function renderPage() {
  await act(async () => {
    root.render(<OrgModulePage />);
  });
  for (let i = 0; i < 4; i += 1) await act(async () => {});
}

const FLAT = {
  items: [
    {
      dept_id: 1,
      dept_name: "南隅堂",
      parent_id: 0,
      user_count: 12,
      owner_name: "陈可",
      owner_id: "emp_12345678",
      updated_at: "2026-11-19T05:30:00Z",
    },
    { dept_id: 2, dept_name: "文书阁", parent_id: 1, user_count: 5 },
    { dept_id: 3, dept_name: "临时部门", parent_id: 0 },
  ],
};

describe("OrgModulePage — 组织与部门 (org5)", () => {
  it("loading: skeleton, no engineering text", async () => {
    mockApi(() => new Promise(() => {}));
    await renderPage();
    expect(container.querySelector('[data-testid="org5-loading"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/undefined|dept_id|NaN/);
  });

  it("flat rows build a tree with parent, headcount, owner and Beijing time", async () => {
    mockApi((url) => (url.includes("/v1/departments") ? Promise.resolve(FLAT) : missing(url)));
    await renderPage();
    expect(vi.mocked(fetchJSON).mock.calls[0]?.[0]).toBe("/agent-api/api/v1/departments");
    const list = container.querySelector('[data-testid="org5-list"]');
    expect(list?.textContent).toContain("南隅堂");
    expect(list?.textContent).toContain("文书阁");
    expect(list?.textContent).toContain("12 人");
    expect(list?.textContent).toContain("5 人");
    // child shows the parent department name, not a raw id
    expect(list?.textContent).toContain("南隅堂");
    // owner reads name + 8-char short code; no bare emp_
    expect(list?.textContent).toContain("陈可 · 12345678");
    expect(list?.textContent).not.toContain("emp_12345678");
    // Beijing time to minute
    expect(list?.textContent).toContain("2026-11-19 13:30");
    expect(list?.textContent).not.toContain("2026-11-19T05:30");
    // missing values are — plus reason, never a fake 0
    expect(list?.textContent).toContain("上游未返回人数");
    expect(list?.textContent).not.toContain("0 人");
    expect(list?.textContent).not.toMatch(/dept_id|parent_id/);
    // raw ids stay in title only
    const nodes = list?.querySelectorAll('[data-testid="org5-node"]');
    expect(nodes?.[0]?.getAttribute("title")).toBe("记录号 1");
    const parentName = (nodes?.[0] as HTMLElement).querySelector('[data-testid="org5-parent"]');
    expect(parentName?.textContent).toContain("顶级部门");
  });

  it("nested children[] payloads flatten into the same tree", async () => {
    mockApi((url) =>
      url.includes("/dept/list")
        ? missing(url)
        : Promise.resolve({
            data: [
              {
                dept_id: 7,
                name: "总堂",
                user_count: 8,
                children: [{ dept_id: 8, name: "分堂", user_count: 3 }],
              },
            ],
          }),
    );
    await renderPage();
    const nodes = container.querySelectorAll('[data-testid="org5-node"]');
    expect(nodes).toHaveLength(2);
    expect(container.textContent).toContain("总堂");
    expect(container.textContent).toContain("分堂");
    expect(nodes[1]!.textContent).toContain("3 人");
    expect(nodes[1]!.textContent).toContain("总堂");
  });

  it("first level is expanded by default; collapse and expand a branch", async () => {
    mockApi((url) => (url.includes("/dept/list") ? Promise.resolve(FLAT) : missing(url)));
    await renderPage();
    expect(container.textContent).toContain("文书阁");
    const toggleBtn = container.querySelector('[data-testid="org5-node"] button[aria-expanded]');
    expect(toggleBtn?.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      (toggleBtn as HTMLButtonElement).click();
    });
    expect(container.textContent).not.toContain("文书阁");
    expect(container.querySelector('[aria-expanded="false"]')).toBeTruthy();
    await act(async () => {
      (container.querySelector('[aria-expanded="false"]') as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("文书阁");
  });

  it("empty roster names the reason and never says 0 departments", async () => {
    mockApi(() => Promise.resolve({ items: [] }));
    await renderPage();
    const empty = container.querySelector('[data-testid="org5-empty"]');
    expect(empty?.textContent).toContain("后台还没有建立任何部门");
    expect(empty?.textContent).toContain("不显示 0 个部门");
  });

  it("no endpoint answers → honest 未接入, GAP-02 only in title, real application link", async () => {
    mockApi((url) => missing(url));
    await renderPage();
    const denied = container.querySelector('[data-testid="org5-denied"]');
    expect(denied?.textContent).toContain("未接入");
    expect(denied?.textContent).toContain("上游部门接口还没有接入");
    expect(denied?.getAttribute("title")).toBe("GAP-02");
    expect(container.textContent).not.toContain("GAP-");
    const apply = denied?.querySelector('[data-testid="org5-apply"]');
    expect(apply?.textContent).toContain("开通申请");
    expect(apply?.getAttribute("href")).toBe("#/approvals");
    expect(container.querySelector('[data-testid="org5-list"]')).toBeNull();
  });

  it("403 and 404 share the same honest 未接入 body", async () => {
    mockApi((url) => forbidden(url));
    await renderPage();
    const denied = container.querySelector('[data-testid="org5-denied"]');
    expect(denied?.textContent).toContain("上游部门接口还没有接入本控制台");
    const body403 = denied?.textContent;
    mockApi((url) => missing(url));
    await renderPage();
    const body404 = container.querySelector('[data-testid="org5-denied"]')?.textContent;
    expect(body404).toBe(body403);
    expect(denied?.textContent).toContain("开通申请");
    expect(denied?.getAttribute("title")).toBe("GAP-02");
    expect(container.querySelector('[data-testid="org5-list"]')).toBeNull();
  });

  it("401 → login sentence with copyable request id and retry", async () => {
    mockApi((url) => login401(url));
    await renderPage();
    const err = container.querySelector('[data-testid="org5-error"]');
    expect(err?.textContent).toContain(SESSION_REQUIRED_GUIDANCE);
    expect(err?.textContent).toContain("req-login");
    expect(err?.querySelector('[data-testid="org5-copy-req"]')).toBeTruthy();
    expect(err?.textContent).toContain("重试");
  });

  it("5xx carries the plain sentence, request id and retry, never HTTP codes", async () => {
    mockApi((url) => boom502(url));
    await renderPage();
    const err = container.querySelector('[data-testid="org5-error"]');
    expect(err?.textContent).toContain("请求编号：req-31");
    expect(err?.textContent).toContain("重试");
    expect(err?.textContent).not.toMatch(/HTTP|502|ApiError/);
  });

  it("missing department name renders 待核实, never blank", async () => {
    mockApi((url) =>
      url.includes("/dept/list")
        ? Promise.resolve({ items: [{ dept_id: 9, parent_id: 0 }] })
        : missing(url),
    );
    await renderPage();
    const node = container.querySelector('[data-testid="org5-node"]');
    expect(node?.textContent).toContain("待核实");
    expect(node?.textContent).toContain("上游未提供部门名");
  });

  it("forced error renders without sample data and performs no fetch", async () => {
    window.history.replaceState({}, "", "/?state=error");
    await renderPage();
    expect(container.querySelector('[data-testid="org5-error"]')).toBeTruthy();
    expect(container.textContent).not.toContain("示例部门");
    expect(fetchJSON).not.toHaveBeenCalled();
  });

  it("state=ready is not a fixture preview: it reads the live service", async () => {
    window.history.replaceState({}, "", "/?state=ready");
    mockApi((url) => (url.includes("/dept/list") ? Promise.resolve(FLAT) : missing(url)));
    await renderPage();
    expect(container.querySelector('[data-testid="org5-list"]')).toBeTruthy();
    expect(container.textContent).toContain("南隅堂");
    expect(fetchJSON).toHaveBeenCalled();
  });

  it("leak guard: no endpoint paths, raw fields, GAP ids, HTTP codes or raw employee ids", async () => {
    mockApi((url) => (url.includes("/dept/list") ? Promise.resolve(FLAT) : missing(url)));
    await renderPage();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\/api\//);
    expect(text).not.toMatch(/dept_id|parent_id|owner_id|updated_at/);
    expect(text).not.toMatch(/GAP-/);
    expect(text).not.toMatch(/HTTP|emp_|human:/);
    expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
  });
});
