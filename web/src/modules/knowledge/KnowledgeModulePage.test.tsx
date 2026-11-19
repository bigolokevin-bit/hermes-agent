// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchMock = vi.fn();
vi.mock("@/modules/models/fetchJson", () => ({
  fetchJsonStrict: (url: string) => fetchMock(url),
}));

import KnowledgeModulePage from "./KnowledgeModulePage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function apiError(status: number, message: string, requestId?: string): ApiError {
  return new ApiError(message, { status, body: "", url: "/agent-api/api/test", requestId });
}

beforeEach(() => {
  fetchMock.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(path = "/knowledge") {
  act(() => root.unmount());
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <KnowledgeModulePage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

async function click(testid: string) {
  const node = container.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(node).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

describe("KnowledgeModulePage", () => {
  it("renders 未接入 with GAP only in the title when spaces are 404", async () => {
    fetchMock.mockRejectedValue(apiError(404, "这个数据接口还没有接入。"));
    await render();
    expect(fetchMock).toHaveBeenCalledWith("/agent-api/api/knowledge/spaces");
    const gap = container.querySelector('[data-testid="knw4-gap"]');
    expect(gap).toBeTruthy();
    expect(gap?.getAttribute("title")).toBe("GAP-03");
    expect(container.textContent).toContain("未接入");
    expect(container.textContent).not.toContain("GAP-03");
    expect(container.querySelector('a[href="/approvals"]')).toBeTruthy();
  });

  it("renders real spaces with type, count, Beijing update time and missing-field reasons", async () => {
    fetchMock.mockResolvedValue({
      items: [
        {
          spaceId: "space_123456789",
          name: "产品知识",
          type: "team",
          docCount: 12,
          updatedAt: "2026-11-19T06:00:00Z",
          status: "active",
        },
        { spaceId: "space_missing", name: null },
      ],
      asOf: "2026-11-19T06:05:00Z",
    });
    await render();
    expect(container.querySelector('[data-testid="knw4-table"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="knw4-row"]')).toHaveLength(2);
    const text = container.textContent ?? "";
    expect(text).toContain("产品知识");
    expect(text).toContain("团队空间");
    expect(text).toContain("12 条");
    expect(text).toContain("2026-11-19 14:00");
    expect(text).toContain("待核实");
    expect(text).toContain("上游未提供名称");
    expect(text).toContain("上游未提供条数或大小");
    expect(text).toContain("上游未提供更新时间");
    expect(text).not.toContain("space_123456789");
    expect(container.querySelector('[data-testid="knw4-row"]')?.getAttribute("title")).toBe(
      "space_123456789",
    );
  });

  it("switches to ingest and reports its own missing endpoint honestly", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("knowledge/spaces")
        ? Promise.resolve({ items: [{ spaceId: "s1", name: "空间一" }] })
        : Promise.reject(apiError(404, "这个数据接口还没有接入。")),
    );
    await render();
    await click("knw4-tab-ingest");
    expect(fetchMock).toHaveBeenLastCalledWith("/agent-api/api/documents?limit=50");
    expect(container.querySelector('[data-testid="knw4-gap"]')).toBeTruthy();
    expect(container.textContent).toContain("未接入");
  });

  it("renders real citations with an open link and an honest unreachable reason", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("run-events")
        ? Promise.resolve({
            items: [
              {
                id: "cit_1",
                kind: "citation",
                title: "季度报告",
                employeeId: "u_123456789",
                employeeName: "陈可",
                at: "2026-11-19T06:00:00Z",
                href: "/runs/run_1",
              },
              { id: "cit_2", title: "没有原文位置" },
            ],
          })
        : Promise.reject(apiError(404, "这个数据接口还没有接入。")),
    );
    await render("/knowledge?tab=evidence");
    expect(fetchMock).toHaveBeenCalledWith("/agent-api/api/run-events?kind=citation&limit=50");
    expect(container.querySelectorAll('[data-testid="knw4-citation-row"]')).toHaveLength(2);
    const text = container.textContent ?? "";
    expect(text).toContain("季度报告");
    expect(text).toContain("陈可");
    expect(text).toContain("2026-11-19 14:00");
    expect(container.querySelector('[data-testid="knw4-citation-open"]')?.getAttribute("href")).toBe(
      "/runs/run_1",
    );
    expect(text).toContain("原文不可达");
    expect(text).toContain("上游没有给出原文位置");
    expect(text).not.toContain("u_123456789");
    expect(text).not.toContain("示例");
  });

  it("keeps a copyable request id and retries a 500 without showing HTTP codes", async () => {
    fetchMock.mockRejectedValueOnce(apiError(500, "数据服务暂时没有响应，请稍后重试。", "req-knw-7"));
    await render();
    const error = container.querySelector('[data-testid="knw4-error"]');
    expect(error).toBeTruthy();
    expect(container.textContent).toContain("请求编号：req-knw-7");
    expect(container.textContent).not.toContain("500");
    expect(container.querySelector('[aria-label="复制请求编号"]')).toBeTruthy();
    fetchMock.mockResolvedValueOnce({ items: [{ spaceId: "s1", name: "空间一", docCount: 0 }] });
    await click("knw4-retry");
    expect(container.querySelector('[data-testid="knw4-table"]')).toBeTruthy();
    expect(container.textContent).toContain("空间一");
  });

  it("shows a true empty state without inventing zero counts", async () => {
    fetchMock.mockResolvedValue({ items: [] });
    await render();
    expect(container.querySelector('[data-testid="knw4-empty"]')).toBeTruthy();
    expect(container.textContent).toContain("当前没有读到知识空间");
    expect(container.textContent).not.toContain("0 个空间");
    expect(container.textContent).not.toContain("共 0");
  });

  it("forced previews never fetch and carry data-fixture", async () => {
    await render("/knowledge?state=error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="knw4-page"]')?.getAttribute("data-fixture")).toBe("1");
    expect(container.querySelector('[data-testid="knw4-error"]')).toBeTruthy();
  });

  it("uses no engineering copy on the whole page", async () => {
    fetchMock.mockRejectedValue(apiError(404, "这个数据接口还没有接入。"));
    await render();
    const text = container.textContent ?? "";
    for (const token of ["/api", "HTTP", "GAP-03", "spaceId", "docCount", "updated_at", "status="]) {
      expect(text).not.toContain(token);
    }
  });
});