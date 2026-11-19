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

const SPACES = "/agent-api/api/knowledge/spaces";
const DOCUMENTS = "/agent-api/api/documents?limit=50";
const SEARCH_NO_QUERY = "/agent-api/api/knowledge/search?limit=12";
const SEARCH_STAFF = "/agent-api/api/knowledge/search?q=%E5%91%98%E5%B7%A5&limit=12";
const CITATIONS = "/agent-api/api/knowledge/citations?limit=20";
const RECORDS = "/agent-api/api/audit?action=kb.read&limit=50";
const SESSIONS = "/agent-api/api/sessions?limit=20";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.search}</div>;
}

function JumpProbe() {
  const navigate = useNavigate();
  return (
    <button data-testid="jump-search" onClick={() => navigate("/knowledge?tab=retrieval")}>
      jump
    </button>
  );
}

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fail(status: number, message: string, requestId?: string): Promise<never> {
  return Promise.reject(new ApiError(message, { status, body: "", url: "/agent-api/api/test", requestId }));
}

function byTestid(testid: string): Element | null {
  return container.querySelector(`[data-testid="${testid}"]`);
}

function attr(testid: string, name: string): string | null {
  return byTestid(testid)?.getAttribute(name) ?? null;
}

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
  const node = byTestid(testid) as HTMLElement | null;
  expect(node, testid).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

async function type(testid: string, value: string) {
  const node = byTestid(testid) as HTMLInputElement | null;
  expect(node, testid).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(node, value);
    node?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submitForm(testid: string) {
  const form = byTestid(testid) as HTMLFormElement | null;
  expect(form, testid).toBeTruthy();
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => {});
}

function urlsCalled(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
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

describe("KnowledgeModulePage — real-data surfaces", () => {
  it("draws one 未接入 body for a 404 and a 403 alike, with the GAP only in the title", async () => {
    fetchMock.mockImplementation((url: string) =>
      url === SPACES ? fail(404, "这个数据接口还没有接入。", "rid-notfound") : fail(403, "没有查看这项数据的权限。", "rid-denied"),
    );

    await render();
    const notFound = byTestid("knw5-spaces-unwired");
    expect(notFound).toBeTruthy();
    expect(notFound?.getAttribute("title")).toBe("GAP-03");
    // The request id is the only thing a 403 and a 404 may differ in; the body is one.
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");
    const notFoundText = bodyOf(notFound);
    expect(notFoundText).toContain("未接入");
    expect(container.textContent).toContain("请求编号：rid-notfound");
    expect(container.querySelector('a[href="/approvals"]')).toBeTruthy();

    await click("knw5-tab-ingest");
    const denied = byTestid("knw5-ingest-unwired");
    expect(denied).toBeTruthy();
    expect(bodyOf(denied)).toBe(notFoundText);
    expect(denied?.getAttribute("title")).toBe("GAP-03");
    expect(container.textContent).toContain("请求编号：rid-denied");
    const screenText = container.textContent ?? "";
    expect(screenText).not.toContain("GAP-03");
    expect(screenText).not.toContain("403");
    expect(screenText).not.toContain("404");
  });

  it("renders real spaces with type, scale, Beijing time and a reason for every gap", async () => {
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
    expect(fetchMock).toHaveBeenCalledWith(SPACES);
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(attr("knw5-spaces", "data-len")).toBe("2");
    expect(container.querySelectorAll('[data-testid="knw5-spaces-table-row"]')).toHaveLength(2);
    const text = container.textContent ?? "";
    expect(text).toContain("产品知识");
    expect(text).toContain("团队空间");
    expect(text).toContain("12 条");
    expect(text).toContain("2026-11-19 14:05");
    expect(text).toContain("2026-11-19 14:00");
    expect(text).toContain("待核实");
    expect(text).toContain("上游未提供名称");
    expect(text).toContain("上游未提供条数或大小");
    expect(text).toContain("上游未提供更新时间");
    expect(text).not.toContain("space_123456789");
    expect(attr("knw5-spaces-table-row", "title")).toBe("space_123456789");
  });

  it("keeps a true empty answer empty instead of a zero count", async () => {
    fetchMock.mockResolvedValue({ items: [] });
    await render();
    expect(byTestid("knw5-spaces-empty")).toBeTruthy();
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(attr("knw5-spaces", "data-len")).toBe("0");
    const text = container.textContent ?? "";
    expect(text).toContain("接口已响应，但列表为空");
    expect(text).not.toContain("0 个空间");
    expect(text).not.toContain("共 0");
  });

  it("searches through the knowledge search read and draws its real hits", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SEARCH_NO_QUERY) return Promise.resolve({ results: [] });
      if (url === SEARCH_STAFF) {
        return Promise.resolve({
          asOf: "2026-11-19T07:00:00Z",
          results: [
            {
              citationId: "hit_987654321",
              title: "入职与考勤",
              excerpt: "新员工需要在入职一周内完成考勤绑定，逾期未绑定会提示直属上级。",
              sourceName: "人事制度汇编.pdf",
              sourceType: "pdf",
              url: "/documents/doc_7",
              citedAt: "2026-11-19T06:30:00Z",
            },
            { title: "只有标题的一条" },
          ],
        });
      }
      if (url === RECORDS) return Promise.resolve({ events: [] });
      return fail(404, "这个数据接口还没有接入。");
    });

    await render("/knowledge?tab=spaces&panel=retrieval");
    expect(urlsCalled()).toContain(SEARCH_NO_QUERY);
    expect(fetchMock).toHaveBeenCalledWith(RECORDS);
    expect(byTestid("knw5-search-empty")).toBeTruthy();
    expect(container.textContent).toContain("这不等于知识库是空的");

    await type("knw5-search-input", "员工");
    await submitForm("knw5-search-form");
    expect((byTestid("loc")?.textContent ?? "").concat("&")).toContain("q=%E5%91%98%E5%B7%A5");
    expect(urlsCalled()).toContain(SEARCH_STAFF);
    expect(attr("knw5-search", "data-len")).toBe("2");
    const text = container.textContent ?? "";
    expect(text).toContain("入职与考勤");
    expect(text).toContain("人事制度汇编.pdf");
    expect(text).toContain("PDF");
    expect(text).toContain("2026-11-19 14:30");
    expect(text).toContain("来源：人事制度汇编.pdf");
    expect(text).toContain("数据截至 2026-11-19 15:00");
    expect(text).toContain("打开原文");
    expect(attr("knw5-search-results-open", "href")).toBe("/documents/doc_7");
    // 缺值的行不补造：摘要与来源都写「—」并给原因。
    expect(text).toContain("上游没有给出来源文档或空间");
    expect(text).not.toContain("hit_987654321");
  });

  it("says 原文不可达 with a reason when the original cannot be opened", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SEARCH_STAFF || url === CITATIONS) {
        return Promise.resolve({
          results: [
            {
              citationId: "cit_ext",
              title: "外部镜像",
              url: "https://files.example.invalid/annual.pdf",
              createdAt: "2026-11-19T06:30:00Z",
            },
            { citationId: "cit_none", title: "没有位置" },
          ],
          citations: [
            {
              citationId: "cit_ext",
              title: "外部镜像",
              url: "https://files.example.invalid/annual.pdf",
              createdAt: "2026-11-19T06:30:00Z",
            },
            { citationId: "cit_none", title: "没有位置" },
          ],
        });
      }
      if (url === RECORDS) return Promise.resolve({ events: [] });
      if (url === SESSIONS) return Promise.resolve({ sessions: [] });
      return fail(404, "这个数据接口还没有接入。");
    });

    await render("/knowledge?tab=spaces&panel=retrieval&q=员工");
    const text = container.textContent ?? "";
    expect(text).toContain("原文不可达");
    expect(text).toContain("上游给出的原文位置不是站内地址，无法直接打开。");
    expect(text).toContain("上游没有给出原文位置，无法打开原文。");
    expect(byTestid("knw5-search-results-open")).toBeNull();

    await click("knw5-tab-evidence");
    expect(urlsCalled()).toContain(CITATIONS);
    expect(container.querySelectorAll('[data-testid="knw5-citations-list-row"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid="knw5-citations-list-unreachable"]')).toHaveLength(2);
    expect(container.textContent).toContain("原文不可达");
  });

  it("shows a skeleton while a surface reads, then its rows", async () => {
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    await render();
    expect(byTestid("knw5-spaces-loading")).toBeTruthy();
    expect(attr("knw5-spaces", "data-state")).toBe("loading");
    expect(byTestid("knw5-spaces-table")).toBeNull();

    await act(async () => {
      release({ items: [{ spaceId: "s1", name: "空间一", docCount: 0 }], asOf: "2026-11-19T06:00:00Z" });
    });
    await act(async () => {});
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(container.textContent).toContain("空间一");
    expect(container.textContent).toContain("0 条");
  });

  it("keeps a copyable request id and retries a failure without HTTP copy", async () => {
    fetchMock.mockImplementationOnce(() => fail(500, "数据服务暂时没有响应，请稍后重试。", "req-knw5-7"));
    await render();
    expect(byTestid("knw5-spaces-error")).toBeTruthy();
    expect(attr("knw5-spaces", "data-state")).toBe("error");
    const text = container.textContent ?? "";
    expect(text).toContain("请求编号：req-knw5-7");
    expect(text).toContain("复制");
    expect(text).not.toContain("500");
    expect(byTestid("knw5-spaces-retry")).toBeTruthy();

    fetchMock.mockResolvedValue({ items: [{ spaceId: "s1", name: "空间一" }] });
    await click("knw5-spaces-retry");
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(container.textContent).toContain("空间一");
  });

  it("reads citations from sessions when the citation read is not wired", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === CITATIONS) return fail(404, "这个数据接口还没有接入。", "rid-cit");
      if (url === SESSIONS) {
        return Promise.resolve({
          sessions: [{ sessionId: "cs_123456789", employeeId: "u_123456789", messageCount: 2, updatedAt: "2026-11-19T06:01:00Z" }],
          total: 1,
        });
      }
      if (url === "/agent-api/api/console-sessions/cs_123456789") {
        return Promise.resolve({
          messages: [
            { role: "user", createdAt: "2026-11-19T05:59:00Z", content: "问" },
            {
              role: "assistant",
              createdAt: "2026-11-19T06:00:00Z",
              citations: [
                { id: "cit_1", type: "citation", title: "季度报告", documentName: "季度报告.pdf", href: "/runs/run_1" },
                { id: "cit_2", title: "没有原文位置" },
              ],
            },
          ],
        });
      }
      return fail(404, "这个数据接口还没有接入。");
    });

    await render("/knowledge?tab=spaces&panel=evidence");
    expect(attr("knw5-citations", "data-state")).toBe("unwired");
    expect(container.textContent).toContain("请求编号：rid-cit");
    expect(attr("knw5-session-cites", "data-state")).toBe("ready");
    expect(container.querySelectorAll('[data-testid="knw5-session-cites-list-row"]')).toHaveLength(2);
    const text = container.textContent ?? "";
    expect(text).toContain("季度报告");
    expect(text).toContain("员工 · 23456789");
    expect(text).toContain("2026-11-19 14:00");
    expect(attr("knw5-session-cites-list-open", "href")).toBe("/runs/run_1");
    expect(text).toContain("原文不可达");
    expect(text).not.toContain("u_123456789");
    expect(text).not.toContain("示例");
    expect(text).not.toContain("样例引用");
  });

  it("renders real retrieval audit rows without raw field names", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === RECORDS) {
        return Promise.resolve({
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
      }
      return Promise.resolve({ results: [] });
    });

    await render("/knowledge?tab=spaces&panel=retrieval");
    expect(fetchMock).toHaveBeenCalledWith(RECORDS);
    expect(container.querySelectorAll('[data-testid="knw5-records-row"]')).toHaveLength(1);
    const text = container.textContent ?? "";
    expect(text).toContain("员工 · 23456789");
    expect(text).toContain("允许");
    expect(text).toContain("成功");
    expect(text).toContain("知识查询");
    expect(text).toContain("2026-11-19 14:10");
    expect(attr("knw5-records-open", "href")).toBe("/runs/run_123456789");
    expect(text).not.toContain("kbq_123456789");
    expect(text).not.toContain("ev_123456789");
  });

  it("maps every shell tab value to its panel and its own real reads", async () => {
    fetchMock.mockResolvedValue({ items: [] });
    const cases: [string, string, string[]][] = [
      ["/knowledge", "spaces", [SPACES]],
      ["/knowledge?tab=spaces&panel=ingest", "ingest", [DOCUMENTS]],
      ["/knowledge?tab=spaces&panel=retrieval", "retrieval", [SEARCH_NO_QUERY, RECORDS]],
      ["/knowledge?tab=spaces&panel=evidence", "evidence", [CITATIONS, SESSIONS]],
      ["/knowledge?tab=ingest", "ingest", [DOCUMENTS]],
      ["/knowledge?tab=sources", "ingest", [DOCUMENTS]],
      ["/knowledge?tab=retrieval", "retrieval", [SEARCH_NO_QUERY, RECORDS]],
      ["/knowledge?tab=search", "retrieval", [SEARCH_NO_QUERY, RECORDS]],
      ["/knowledge?tab=citations", "evidence", [CITATIONS, SESSIONS]],
      ["/knowledge?tab=evidence", "evidence", [CITATIONS, SESSIONS]],
    ];
    for (const [path, panel, urls] of cases) {
      fetchMock.mockClear();
      await render(path);
      for (const key of ["spaces", "ingest", "retrieval", "evidence"]) {
        expect(byTestid(`knw5-tab-${key}`), key).toBeTruthy();
      }
      const selected = container.querySelector('[role="tab"][aria-selected="true"]');
      expect(selected?.getAttribute("data-testid")).toBe(`knw5-tab-${panel}`);
      expect(attr("knw5-panel", "data-tab")).toBe(panel);
      expect(byTestid(`knw5-panel-${panel}`)).toBeTruthy();
      for (const url of urls) expect(urlsCalled(), url).toContain(url);
    }
  });

  it("keeps the selected panel and keyword in the URL and restores both on re-render", async () => {
    fetchMock.mockResolvedValue({ items: [], results: [], events: [], sessions: [] });
    await render("/knowledge?tab=spaces");
    await click("knw5-tab-retrieval");
    await type("knw5-search-input", "员工");
    await submitForm("knw5-search-form");
    const search = (byTestid("loc")?.textContent ?? "").replace(/^\?/, "");
    expect(search).toContain("panel=retrieval");
    expect(search).toContain("tab=spaces");
    expect(search).toContain("q=%E5%91%98%E5%B7%A5");

    fetchMock.mockClear();
    await render(`/knowledge?${search}`);
    expect(attr("knw5-panel", "data-tab")).toBe("retrieval");
    expect(urlsCalled()).toContain(SEARCH_STAFF);
    expect((byTestid("knw5-search-input") as HTMLInputElement | null)?.value).toBe("员工");
  });

  it("switches panels when only the URL changes, without a stale copy of it", async () => {
    fetchMock.mockResolvedValue({ items: [] });
    await render("/knowledge?tab=sources");
    const initial = container.querySelector('[role="tab"][aria-selected="true"]');
    expect(initial?.getAttribute("data-testid")).toBe("knw5-tab-ingest");
    await click("jump-search");
    expect(attr("knw5-panel", "data-tab")).toBe("retrieval");
    expect(urlsCalled()).toContain(SEARCH_NO_QUERY);
    expect(urlsCalled()).toContain(RECORDS);
  });

  it("carries no data-fixture anywhere, and still reads with a state in the URL", async () => {
    fetchMock.mockResolvedValue({ items: [{ spaceId: "s1", name: "空间一" }] });
    await render("/knowledge?state=error");
    expect(container.querySelector("[data-fixture]")).toBeNull();
    expect(attr("knw5-page", "data-fixture")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(SPACES);
    expect(container.textContent).toContain("空间一");
    expect(container.textContent).not.toContain("预览");
  });

  it("shows a login state for an expired session without inventing data", async () => {
    fetchMock.mockImplementation(() => fail(401, "需要登录：这个页面的登录状态已经失效。", "rid-expired"));
    await render();
    expect(byTestid("knw5-spaces-login")).toBeTruthy();
    expect(attr("knw5-spaces", "data-state")).toBe("login");
    expect(container.textContent).toContain("需要登录");
    expect(byTestid("knw5-spaces-unwired")).toBeNull();
    expect(byTestid("knw5-spaces-table")).toBeNull();
  });

  it("uses no engineering copy anywhere on the page", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === RECORDS) return Promise.resolve({ events: [] });
      if (url === SESSIONS) return Promise.resolve({ sessions: [] });
      return fail(404, "这个数据接口还没有接入。");
    });
    for (const panel of ["spaces", "ingest", "retrieval", "evidence"]) {
      await render(`/knowledge?tab=spaces&panel=${panel}`);
      const text = container.textContent ?? "";
      for (const token of [
        "/api",
        "HTTP",
        "GAP-03",
        "spaceId",
        "docCount",
        "updated_at",
        "kb.read",
        "citationId",
        "sourceName",
        "console-sessions",
        "unknown_route",
        "not_wired",
        "status=",
        "404",
        "403",
      ]) {
        expect(text, `${panel} leaked ${token}`).not.toContain(token);
      }
    }
  });
});
