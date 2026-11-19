// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchMock = vi.fn();
vi.mock("@/modules/models/fetchJson", () => ({
  fetchJsonStrict: (url: string) => fetchMock(url),
}));

import KnowledgeModulePage from "./KnowledgeModulePage";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.search}</div>;
}

function JumpProbe() {
  const navigate = useNavigate();
  return (
    <button data-testid="jump-retrieval" onClick={() => navigate("/knowledge?tab=retrieval")}>
      jump
    </button>
  );
}

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
        <LocationProbe />
        <JumpProbe />
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

  it("maps all four shell tab values to the matching knw4 panel", async () => {
    fetchMock.mockResolvedValue({ items: [] });
    const cases = [
      ["/knowledge?tab=spaces", "spaces", "/agent-api/api/knowledge/spaces"],
      ["/knowledge?tab=ingest", "ingest", "/agent-api/api/documents?limit=50"],
      ["/knowledge?tab=sources", "ingest", "/agent-api/api/documents?limit=50"],
      ["/knowledge?tab=retrieval", "retrieval", "/agent-api/api/audit?action=kb.read&limit=50"],
      ["/knowledge?tab=citations", "evidence", "/agent-api/api/sessions?limit=20"],
      ["/knowledge?tab=evidence", "evidence", "/agent-api/api/sessions?limit=20"],
    ] as const;
    for (const [path, panel, url] of cases) {
      await render(path);
      for (const key of ["spaces", "ingest", "retrieval", "evidence"]) {
        expect(container.querySelector(`[data-testid="knw4-tab-${key}"]`)).toBeTruthy();
      }
      const selected = container.querySelector('[role="tab"][aria-selected="true"]');
      expect(selected?.getAttribute("data-testid")).toBe(`knw4-tab-${panel}`);
      expect(container.querySelector('[data-testid="knw4-panel"]')?.getAttribute("data-tab")).toBe(panel);
      expect(container.querySelector(`[data-testid="knw4-panel-${panel}"]`)).toBeTruthy();
      expect(fetchMock).toHaveBeenLastCalledWith(url);
    }
  });

  it("switches panels when only the URL changes, without a stale tab state", async () => {
    fetchMock.mockResolvedValue({ items: [] });
    await render("/knowledge?tab=sources");
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-testid")).toBe(
      "knw4-tab-ingest",
    );
    await click("jump-retrieval");
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-testid")).toBe(
      "knw4-tab-retrieval",
    );
    expect(container.querySelector('[data-testid="knw4-panel"]')?.getAttribute("data-tab")).toBe("retrieval");
    expect(fetchMock).toHaveBeenLastCalledWith("/agent-api/api/audit?action=kb.read&limit=50");
  });

  it("keeps the selected panel in the URL and restores it on re-render", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("knowledge/spaces")
        ? Promise.resolve({ items: [{ spaceId: "s1", name: "空间一" }] })
        : Promise.resolve({ items: [{ documentId: "d1", title: "文档一" }] }),
    );
    await render("/knowledge?tab=spaces");
    await click("knw4-tab-ingest");
    const loc = container.querySelector('[data-testid="loc"]')?.textContent ?? "";
    expect(loc).toContain("panel=ingest");
    expect(loc).toContain("tab=spaces");
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-testid")).toBe(
      "knw4-tab-ingest",
    );
    await render(`/knowledge${loc}`);
    expect(container.querySelector('[data-testid="knw4-panel"]')?.getAttribute("data-tab")).toBe("ingest");
    expect(fetchMock).toHaveBeenLastCalledWith("/agent-api/api/documents?limit=50");
  });

  it("renders real session citations with an open link and an honest unreachable reason", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/sessions")) {
        return Promise.resolve({
          items: [{ sessionId: "cs_123456789", employeeId: "u_123456789", messageCount: 2 }],
        });
      }
      if (url.includes("/console-sessions/cs_123456789")) {
        return Promise.resolve({
          messages: [
            { role: "user", createdAt: "2026-11-19T05:59:00Z", content: "问" },
            {
              role: "assistant",
              createdAt: "2026-11-19T06:00:00Z",
              citations: [
                { id: "cit_1", type: "citation", title: "季度报告", href: "/runs/run_1" },
                { id: "cit_2", title: "没有原文位置" },
              ],
            },
          ],
        });
      }
      return Promise.reject(apiError(404, "这个数据接口还没有接入。"));
    });
    await render("/knowledge?tab=evidence");
    expect(fetchMock).toHaveBeenCalledWith("/agent-api/api/sessions?limit=20");
    expect(container.querySelectorAll('[data-testid="knw4-citation-row"]')).toHaveLength(2);
    const text = container.textContent ?? "";
    expect(text).toContain("季度报告");
    expect(text).toContain("员工 · 23456789");
    expect(text).toContain("2026-11-19 14:00");
    expect(container.querySelector('[data-testid="knw4-citation-open"]')?.getAttribute("href")).toBe(
      "/runs/run_1",
    );
    expect(text).toContain("原文不可达");
    expect(text).toContain("上游没有给出原文位置");
    expect(text).not.toContain("u_123456789");
    expect(text).not.toContain("示例");
  });

  it("renders real retrieval audit rows with human decisions and no raw fields", async () => {
    fetchMock.mockResolvedValue({
      events: [
        {
          event_id: "ev_123456789",
          occurred_at: "2026-11-19T06:10:00Z",
          actor: { type: "employee", id: "emp_ABCDEF123456789" },
          decision: "allow",
          outcome: "success",
          resource: { type: "kb_query", id: "kbq_123456789" },
          run_id: "run_123456789",
        },
      ],
    });
    await render("/knowledge?tab=retrieval");
    expect(fetchMock).toHaveBeenCalledWith("/agent-api/api/audit?action=kb.read&limit=50");
    expect(container.querySelectorAll('[data-testid="knw4-retrieval-row"]')).toHaveLength(1);
    const text = container.textContent ?? "";
    expect(text).toContain("员工 · 23456789");
    expect(text).toContain("允许");
    expect(text).toContain("成功");
    expect(text).toContain("知识查询");
    expect(text).toContain("2026-11-19 14:10");
    expect(container.querySelector('[data-testid="knw4-retrieval-open"]')?.getAttribute("href")).toBe(
      "/runs/run_123456789",
    );
    expect(text).not.toContain("kbq_123456789");
    expect(text).not.toContain("ev_123456789");
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