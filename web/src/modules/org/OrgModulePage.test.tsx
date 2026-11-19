// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

// @nous-research/ui ships .webp assets vitest cannot load; stub the four
// primitives, spreading rest props so data-testid survives (T20 lesson).
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
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
import { ApiError } from "@/lib/api-error";
import OrgModulePage from "@/modules/org/OrgModulePage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function mockApi(handler: (url: string) => Promise<unknown>) {
  vi.mocked(fetchJSON).mockImplementation(((url: string) => handler(url)) as never);
}

const forbidden = (url: string) => Promise.reject(new ApiError("forbidden", { status: 403, body: "", url }));
const missing = (url: string) => Promise.reject(new ApiError("not found", { status: 404, body: "", url }));
const boom502 = (url: string) =>
  Promise.reject(new ApiError("服务暂时不可用。", { status: 502, body: "", url, requestId: "req-31" }));

async function renderPage() {
  await act(async () => {
    root.render(<OrgModulePage />);
  });
  for (let i = 0; i < 4; i += 1) await act(async () => {});
}

const FLAT = {
  items: [
    { dept_id: 1, dept_name: "南隅堂", parent_id: 0, user_count: 12 },
    { dept_id: 2, dept_name: "文书阁", parent_id: 1, user_count: 5 },
    { dept_id: 3, dept_name: "临时部门", parent_id: 0 },
  ],
};

describe("OrgModulePage — 组织与部门 (T21)", () => {
  it("loading: skeleton, no engineering text", async () => {
    mockApi(() => new Promise(() => {}));
    await renderPage();
    expect(container.querySelector('[data-testid="org4-loading"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/undefined|dept_id|NaN/);
  });

  it("flat rows build a tree: child nests under parent, headcounts shown", async () => {
    mockApi((url) => (url.includes("/dept/list") ? Promise.resolve(FLAT) : missing(url)));
    await renderPage();
    const list = container.querySelector('[data-testid="org4-list"]');
    expect(list?.textContent).toContain("南隅堂");
    expect(list?.textContent).toContain("文书阁");
    expect(list?.textContent).toContain("共 12 人");
    expect(list?.textContent).toContain("共 5 人");
    // 人数缺失只说待核实，绝不假 0
    expect(list?.textContent).toContain("人数待核实");
    expect(list?.textContent).not.toContain("共 0 人");
    expect(list?.textContent).not.toMatch(/dept_id|parent_id/);
    // raw ids stay in title only
    const nodes = list?.querySelectorAll('[data-testid="org4-node"]');
    expect(nodes?.[0]?.getAttribute("title")).toBe("记录号 1");
    // child is indented deeper than its parent
    const parent = nodes?.[0] as HTMLElement;
    const child = nodes?.[1] as HTMLElement;
    expect(parseInt(child.style.paddingLeft, 10)).toBeGreaterThan(parseInt(parent.style.paddingLeft, 10));
  });

  it("nested children[] payloads flatten into the same tree", async () => {
    mockApi((url) =>
      url.includes("/dept/list")
        ? missing(url)
        : Promise.resolve({
            data: [{ dept_id: 7, name: "总堂", user_count: 8, children: [{ dept_id: 8, name: "分堂", user_count: 3 }] }],
          }),
    );
    await renderPage();
    const nodes = container.querySelectorAll('[data-testid="org4-node"]');
    expect(nodes).toHaveLength(2);
    expect(container.textContent).toContain("总堂");
    expect(container.textContent).toContain("分堂");
    expect(nodes[1]!.textContent).toContain("共 3 人");
  });

  it("collapse and expand a branch", async () => {
    mockApi((url) => (url.includes("/dept/list") ? Promise.resolve(FLAT) : missing(url)));
    await renderPage();
    const toggleBtn = container.querySelector('[data-testid="org4-node"] button[aria-expanded]');
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

  it("empty roster names the reason", async () => {
    mockApi(() => Promise.resolve({ items: [] }));
    await renderPage();
    const empty = container.querySelector('[data-testid="org4-empty"]');
    expect(empty?.textContent).toContain("后台还没有建立任何部门");
  });

  it("no endpoint answers → honest GAP-02 state with the 申请入口", async () => {
    mockApi((url) => missing(url));
    await renderPage();
    const denied = container.querySelector('[data-testid="org4-denied"]');
    expect(denied?.textContent).toContain("待核实");
    expect(denied?.textContent).toContain("上游部门数据接口尚未接入");
    expect(denied?.textContent).toContain("重试");
    expect(denied?.querySelector('[data-testid="org4-apply"]')?.textContent).toContain("申请接入");
    expect(container.querySelector('[data-testid="org4-list"]')).toBeNull();
  });

  it("403 → permission sentence, not a fake tree", async () => {
    mockApi((url) => forbidden(url));
    await renderPage();
    const denied = container.querySelector('[data-testid="org4-denied"]');
    expect(denied?.textContent).toContain("你没有查看这块数据的权限");
    expect(denied?.querySelector('[data-testid="org4-apply"]')).toBeNull();
  });

  it("5xx carries the plain sentence, request id, and a retry", async () => {
    mockApi((url) => boom502(url));
    await renderPage();
    const err = container.querySelector('[data-testid="org4-error"]');
    expect(err?.textContent).toContain("请求编号：req-31");
    expect(err?.textContent).toContain("重试");
    expect(err?.textContent).not.toMatch(/HTTP 502|ApiError/);
  });

  it("missing department name renders 待核实, never blank", async () => {
    mockApi((url) =>
      url.includes("/dept/list") ? Promise.resolve({ items: [{ dept_id: 9, parent_id: 0 }] }) : missing(url),
    );
    await renderPage();
    const node = container.querySelector('[data-testid="org4-node"]');
    expect(node?.textContent).toContain("待核实");
  });
});
