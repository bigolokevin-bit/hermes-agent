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

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";
const DOCUMENTS = "/agent-api/api/documents?limit=50";
const TASKS = "/agent-api/api/knowledge/sources?limit=20";
const INGEST_STATUS = "/agent-api/api/knowledge/ingest-status?limit=20";
const SEARCH_NO_QUERY = "/agent-api/api/knowledge/search?limit=12";
const SEARCH_STAFF = "/agent-api/api/knowledge/search?q=%E5%91%98%E5%B7%A5&limit=12";
const CITATIONS = "/agent-api/api/knowledge/citations?limit=20";
const RECORDS = "/agent-api/api/audit?action=kb.read&limit=50";
const SESSIONS = "/agent-api/api/console-sessions?limit=20";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.search}</div>;
}

function JumpProbe() {
  const navigate = useNavigate();
  return (
    <>
      <button data-testid="jump-search" onClick={() => navigate("/knowledge?tab=retrieval")}>
        jump
      </button>
      <button data-testid="go-back" onClick={() => navigate(-1)}>
        back
      </button>
    </>
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

async function clickNth(testid: string, index: number) {
  const nodes = container.querySelectorAll(`[data-testid="${testid}"]`);
  expect(nodes.length > index, `${testid}[${index}]`).toBe(true);
  await act(async () => {
    nodes[index].dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
  it("draws one body for a 404 and a 403 alike, naming the read that is missing", async () => {
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");

    // 同一个读口，404 与 403 必须逐字同体（只有请求编号可以不同）。
    fetchMock.mockImplementation(() => fail(404, "这个数据接口还没有接入。", "rid-notfound"));
    await render();
    const notFound = byTestid("knw5-spaces-unwired");
    expect(notFound).toBeTruthy();
    expect(notFound?.getAttribute("title")).toBe("GAP-03");
    const notFoundText = bodyOf(notFound);
    expect(notFoundText).toContain("知识空间读口未接入");
    expect(notFoundText).toContain("也不写「0 个」");
    expect(container.textContent).toContain("请求编号：rid-notfound");
    expect(byTestid("knw5-spaces-table")).toBeNull();
    expect(container.querySelector('a[href="/approvals"]')).toBeTruthy();

    fetchMock.mockImplementation(() => fail(403, "没有查看这项数据的权限。", "rid-denied"));
    await render();
    const denied = byTestid("knw5-spaces-unwired");
    expect(bodyOf(denied)).toBe(notFoundText);
    expect(denied?.getAttribute("title")).toBe("GAP-03");
    expect(container.textContent).toContain("请求编号：rid-denied");

    // 换面板后仍是一份诚实正文，并点名该面自己的读口。
    await click("knw5-tab-ingest");
    const ingest = byTestid("knw5-ingest-unwired");
    expect(ingest).toBeTruthy();
    expect(bodyOf(ingest)).toContain("未接入");
    const screen = container.textContent ?? "";
    expect(screen).not.toContain("GAP-03");
    expect(screen).not.toContain("403");
    expect(screen).not.toContain("404");
    expect(screen).not.toContain("0 个空间");
  });

  it("renders one row per space: 名称 / 文档数 / 最近同步 / 状态人话", async () => {
    fetchMock.mockResolvedValue({
      asOf: "2026-11-19T06:05:00Z",
      items: [
        {
          spaceId: "space_123456789",
          name: "产品知识",
          type: "team",
          documentCount: 128,
          lastSyncAt: "2026-11-19T06:00:00Z",
          status: "indexed",
        },
        { spaceId: "space_zero", name: "归档空间", scope: "personal", docCount: 0, updatedAt: "2026-11-18T20:30:00Z", state: "active" },
        { spaceId: "space_syncing", name: "同步中的空间", type: "tenant", syncStatus: "indexing", chunkCount: 320 },
        { spaceId: "space_failed", name: "坏掉的空間", status: "failed", lastError: "上游索引服务返回 503" },
        { spaceId: "space_thin" },
      ],
    });
    await render();
    expect(fetchMock).toHaveBeenCalledWith(SPACES);
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(attr("knw5-spaces", "data-len")).toBe("5");
    expect(container.querySelectorAll('[data-testid="knw5-spaces-row"]')).toHaveLength(5);
    const text = container.textContent ?? "";
    for (const head of ["空间名称", "文档数", "最近同步", "状态"]) expect(text).toContain(head);
    expect(text).toContain("产品知识");
    expect(text).toContain("团队空间");
    expect(text).toContain("128 篇");
    expect(text).toContain("最近同步：2026-11-19 14:00");
    expect(text).toContain("已同步");
    expect(text).toContain("数据截至 2026-11-19 14:05");
    // 真 0 与「没给」是两回事；时间列说清它是哪一刻。
    expect(text).toContain("0 篇");
    expect(text).toContain("个人空间");
    expect(text).toContain("可用");
    expect(text).toContain("最近更新：2026-11-19 04:30");
    expect(text).toContain("同步中");
    expect(text).toContain("上游没有给出这个空间有多少文档");
    expect(text).toContain("分块 320 段");
    expect(text).toContain("上游没有给出时间");
    expect(text).toContain("租户空间");
    // 状态认不出来就待核实，不猜。
    expect(text).toContain("待核实");
    expect(text).toContain("上游没有给出空间状态");
    // 缺名字的那一行也不放样例。
    expect(text).toContain("上游没有给出这个空间叫什么");
    // 原始值与英文状态词不上屏。
    for (const raw of ["space_123456789", "space_zero", "space_thin", "indexed", "indexing", "tenant"]) {
      expect(text, raw).not.toContain(raw);
    }
    expect(text).not.toContain("documents");
    expect(text).not.toContain("chunkCount");
    expect(attr("knw5-spaces-row", "title")).toBe("space_123456789");
  });

  it("keeps the 失败 reason human on screen and technical text only in the title", async () => {
    fetchMock.mockResolvedValue({
      items: [
        { spaceId: "sp_a", name: "薪酬口径", status: "failed", lastError: "凭据已过期，请重新授权后重试", documentCount: 12 },
        { spaceId: "sp_b", name: "工单镜像", status: "failed", lastError: "ECONNREFUSED 10.0.0.8:8443 after 3 retries" },
      ],
    });
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("凭据已过期，请重新授权后重试");
    expect(text).not.toContain("ECONNREFUSED");
    const hidden = container.querySelector('[data-testid="knw5-spaces-failure"][title*="ECONNREFUSED"]');
    expect(hidden).toBeTruthy();
    expect(hidden?.textContent ?? "").toContain("悬停可看原文");
    expect(text).toContain("12 篇");
  });

  it("keeps a true empty answer empty instead of a zero count", async () => {
    fetchMock.mockResolvedValue({ items: [] });
    await render();
    expect(byTestid("knw5-spaces-empty")).toBeTruthy();
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(attr("knw5-spaces", "data-len")).toBe("0");
    const text = container.textContent ?? "";
    expect(text).toContain("接口已响应，但列表为空");
    expect(text).toContain("也不写 0 个");
    expect(text).not.toContain("0 个空间");
    expect(text).not.toContain("共 0");
    // 这一份回答没带采集时间：时间那行要如实说未知并给原因。
    const source = byTestid("knw5-spaces-source")?.textContent ?? "";
    expect(source).toContain("数据截至 未知");
    expect(source).toContain("上游响应没有带采集时间");
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

  it("renders search depth per hit and says 「检索未接入」 on 404 with a way forward", async () => {
    const HITS = {
      asOf: "2026-11-19T09:30:00Z",
      results: [
        {
          citationId: "hit_full",
          title: "员工手册 · 考勤与加班",
          summary: "弹性工时的边界：三十分钟以内不计迟到，超过需事前报备，跨月加班按调休处理。",
          sourceName: "员工手册.pdf",
          sourceType: "pdf",
          documentId: "emp_DOC20261119",
          page: 12,
          citedAt: "2026-11-19T07:05:00Z",
          href: "/documents/doc_attendance",
        },
        {
          citationId: "hit_ext",
          title: "外部镜像：加班口径问答",
          excerpt: "这份镜像把问答原样搬过来，没有站内位置。",
          url: "https://mirror.example.invalid/overtime.pdf",
          createdAt: "2026-11-19T06:40:00Z",
        },
        { citationId: "hit_thin", title: "只有一条标题" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === SEARCH_STAFF) return Promise.resolve(HITS);
      if (url === RECORDS) return Promise.resolve({ events: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-search-probe");
    });

    await render(`/knowledge?tab=spaces&panel=retrieval&q=%E5%91%98%E5%B7%A5`);
    expect(urlsCalled()).toContain(SEARCH_STAFF);
    expect(attr("knw5-search", "data-state")).toBe("ready");
    expect(attr("knw5-search", "data-len")).toBe("3");
    expect(container.querySelectorAll('[data-testid="knw5-search-results-row"]')).toHaveLength(3);
    const first = container.querySelectorAll('[data-testid="knw5-search-results-row"]')[0]?.textContent ?? "";
    // 标题 / 摘要 / 来源人话 / BJT 到分 / 原文可点
    expect(first).toContain("员工手册 · 考勤与加班");
    expect(first).toContain("弹性工时的边界：三十分钟以内不计迟到");
    expect(first).toContain("来源：员工手册.pdf");
    expect(first).toContain("时间：2026-11-19 15:05");
    expect(first).toContain("第 12 页");
    expect(first).toContain("打开原文");
    // 第二条：站外位置 → 原文不可达并给这一条自己的原因
    const second = container.querySelectorAll('[data-testid="knw5-search-results-row"]')[1]?.textContent ?? "";
    expect(second).toContain("原文不可达");
    expect(second).toContain("不是站内地址");
    // 第三条：只有标题，其余逐项说缺，不借上面两条的值
    const third = container.querySelectorAll('[data-testid="knw5-search-results-row"]')[2]?.textContent ?? "";
    expect(third).toContain("上游没有给出这段内容的摘要");
    expect(third).toContain("上游没有给出来源文档或空间");
    expect(third).toContain("上游记录没有给出时间");
    const screen = container.textContent ?? "";
    for (const banned of ["hit_full", "hit_ext", "emp_DOC20261119", "https://mirror", "citationId", "/api/", "404"]) {
      expect(screen, banned).not.toContain(banned);
    }

    // 404：一份「检索未接入」正文 + 去处；GAP 只进 title。
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");
    fetchMock.mockImplementation((url: string) =>
      url === RECORDS ? Promise.resolve({ events: [] }) : fail(404, "这个数据接口还没有接入。", "rid-404-gone"),
    );
    await render("/knowledge?tab=spaces&panel=retrieval");
    const gone = byTestid("knw5-search-unwired");
    expect(gone).toBeTruthy();
    expect(gone?.querySelector("b")?.textContent).toBe("检索未接入");
    expect(gone?.getAttribute("title")).toBe("GAP-03");
    expect(bodyOf(gone)).toContain("不编命中");
    expect(bodyOf(gone)).not.toContain("0 条");
    expect(byTestid("knw5-search-results")).toBeNull();
    expect(byTestid("knw5-search-apply")).toBeTruthy();
    expect(byTestid("knw5-search-retry")).toBeTruthy();
    expect(container.querySelector('a[href="/approvals"]')).toBeTruthy();

    // 403 同一份正文，只有请求编号不同。
    fetchMock.mockImplementation((url: string) =>
      url === RECORDS ? Promise.resolve({ events: [] }) : fail(403, "没有查看这项数据的权限。", "rid-403-denied"),
    );
    await render("/knowledge?tab=spaces&panel=retrieval");
    expect(bodyOf(byTestid("knw5-search-unwired"))).toBe(bodyOf(gone));

    // 200 空集：说「没有匹配结果」，并给另一条能看的腿。
    fetchMock.mockImplementation((url: string) =>
      url === SEARCH_STAFF || url === SEARCH_NO_QUERY
        ? Promise.resolve({ results: [] })
        : Promise.resolve({ events: [] }),
    );
    await render("/knowledge?tab=spaces&panel=retrieval&q=%E5%91%98%E5%B7%A5");
    expect(attr("knw5-search", "data-state")).toBe("ready");
    expect(attr("knw5-search", "data-len")).toBe("0");
    const emptyText = byTestid("knw5-search-empty")?.textContent ?? "";
    expect(emptyText).toContain("没有匹配结果");
    expect(emptyText).toContain("员工");
    expect(emptyText).not.toContain("0 条");
    expect(byTestid("knw5-search-empty-citations")).toBeTruthy();

    // 500：错误态换的是内容，不只是徽标。
    fetchMock.mockImplementation((url: string) =>
      url === RECORDS
        ? Promise.resolve({ events: [] })
        : fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-search-busy"),
    );
    await render("/knowledge?tab=spaces&panel=retrieval");
    expect(byTestid("knw5-search-error")).toBeTruthy();
    expect(byTestid("knw5-search-unwired")).toBeNull();
    expect(container.textContent).toContain("请求编号：rid-search-busy");
    expect(byTestid("knw5-search-retry")).toBeTruthy();
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
      if (url === SESSIONS) return Promise.resolve({ items: [] });
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
    expect(container.textContent).toContain("0 篇");
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

  it("gives every citation row a human 来源、目标对象与可点原文，raw ids stay off screen", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === CITATIONS) {
        return Promise.resolve({
          asOf: "2026-11-19T09:00:00Z",
          citations: [
            {
              citationId: "cit_doc",
              title: "员工手册 · 考勤篇",
              documentName: "员工手册.pdf",
              documentId: "emp_DOC20261119",
              sourceType: "pdf",
              href: "/documents/doc_attendance",
              citedAt: "2026-11-19T07:20:00Z",
              actor: { type: "employee", id: "emp_86A81CE8FF6F42E1", name: "陈嘉禾" },
            },
            {
              citationId: "cit_chunk",
              doc: "薪酬口径说明",
              chunkId: "humn_CHUNK000000991",
              targetType: "chunk",
              createdBy: { type: "human", id: "human:1" },
              createdAt: "2026-11-19T06:10:00Z",
              url: "https://files.example.invalid/x.pdf",
            },
            { citationId: "cit_bare" },
          ],
        });
      }
      if (url === SESSIONS) return Promise.resolve({ items: [] });
      return fail(404, "这个数据接口还没有接入。");
    });

    await render("/knowledge?tab=spaces&panel=evidence");
    expect(attr("knw5-citations", "data-state")).toBe("ready");
    expect(attr("knw5-citations", "data-len")).toBe("3");
    expect(container.querySelectorAll('[data-testid="knw5-citations-list-row"]')).toHaveLength(3);

    // 第一行：来源人话 + 目标对象 + 北京时间到分 + 可点回原文
    await click("knw5-citations-list-drill");
    const detail = byTestid("knw5-citations-list-detail")?.textContent ?? "";
    const row1 = container.textContent ?? "";
    expect(row1).toContain("指向：文档 · 20261119");
    expect(detail).toContain("员工手册.pdf");
    expect(detail).toContain("2026-11-19 15:20");
    expect(attr("knw5-citations-list-detail-open", "href")).toBe("/documents/doc_attendance");
    expect(attr("knw5-citations-list-detail-target", "title")).toBe("emp_DOC20261119");

    // 第二行：片段对象；真人账号不带 id 片段；站外原文不可达要说明原因
    await clickNth("knw5-citations-list-drill", 1);
    const second = byTestid("knw5-citations-list-detail")?.textContent ?? "";
    const screen = container.textContent ?? "";
    expect(screen).toContain("知识片段");
    expect(screen).toContain("真人账号");
    expect(second).toContain("原文不可达");
    expect(second).toContain("不是站内地址");
    expect(byTestid("knw5-citations-list-detail-open")).toBeNull();

    // 第三行：全缺就逐项说缺什么，不编一个对象出来
    await clickNth("knw5-citations-list-drill", 2);
    const third = byTestid("knw5-citations-list-detail")?.textContent ?? "";
    expect(third).toContain("上游没有说明这段引用指向哪个对象");
    expect(third).toContain("上游没有给出原文位置");
    expect(third).toContain("上游记录没有给出标题或文档名");

    // 裸标识、前缀与字段名一律不上屏
    for (const banned of [
      "emp_86A81CE8FF6F42E1",
      "emp_DOC20261119",
      "humn_CHUNK000000991",
      "human:",
      "HUMAN1",
      "citationId",
      "targetType",
      "chunkId",
      "/api/",
    ]) {
      expect(container.textContent ?? "", banned).not.toContain(banned);
    }

    // 空集：诚实「暂无引用」，不写 0 条也不放样例
    expect(byTestid("knw5-session-cites-empty")?.textContent ?? "").toContain("暂无引用");
    expect(screen).not.toContain("0 条引用");
    expect(container.querySelectorAll('[data-testid="knw5-session-cites-list-row"]')).toHaveLength(0);
  });

  it("reads citations from sessions when the citation read is not wired", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === CITATIONS) return fail(404, "这个数据接口还没有接入。", "rid-cit");
      if (url === SESSIONS) {
        return Promise.resolve({
          items: [{ session_id: "cs_123456789", employee_id: "u_123456789", message_count: 2, updated_at: "2026-11-19T06:01:00Z" }],
          nextCursor: null,
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

  it("renders one row per source: 来源名称 / 类型 / 最近同步 / 状态人话 / 条目数", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === TASKS) {
        return Promise.resolve({
          asOf: "2026-11-19T07:00:00Z",
          items: [
            {
              sourceId: "src_HR2026AAA",
              name: "人事制度库",
              sourceType: "sharepoint",
              syncStatus: "syncing",
              itemCount: 1380,
              processed: 412,
              lastSyncAt: "2026-11-19T06:40:00Z",
            },
            {
              sourceId: "src_legal",
              sourceName: "法务合同归档",
              type: "s3",
              status: "completed",
              documentCount: 0,
              syncedAt: "2026-11-19T05:05:00Z",
            },
            {
              sourceId: "src_pay",
              name: "薪酬口径外部镜像",
              provider: "http",
              state: "failed",
              lastError: "凭据已过期，无法登录源站",
              totalItems: 214,
            },
            {
              sourceId: "src_tech",
              name: "工单系统接口",
              provider: "api",
              state: "failed",
              lastError: "ECONNREFUSED 10.0.0.8:8443 after 3 retries",
            },
            { sourceId: "src_thin" },
          ],
        });
      }
      return fail(404, "这个数据接口还没有接入。", "rid-docs");
    });

    await render("/knowledge?tab=ingest");
    expect(fetchMock).toHaveBeenCalledWith(TASKS);
    expect(attr("knw5-ingest-tasks", "data-state")).toBe("ready");
    expect(attr("knw5-ingest-tasks", "data-len")).toBe("5");
    expect(container.querySelectorAll('[data-testid="knw5-ingest-tasks-row"]')).toHaveLength(5);
    const text = container.textContent ?? "";

    // 列头按运营口径写；时间列写清它是哪一刻。
    for (const head of ["来源名称", "类型", "最近同步", "状态", "条目数"]) expect(text).toContain(head);
    expect(text).not.toContain("最近一次");
    expect(text).toContain("人事制度库");
    expect(text).toContain("SharePoint");
    expect(text).toContain("对象存储");
    expect(text).toContain("网页抓取");
    expect(text).toContain("接口同步");
    expect(text).toContain("进行中");
    expect(text).toContain("最近同步：2026-11-19 14:40");
    expect(text).toContain("1,380 条");
    expect(text).toContain("已处理 412 条");
    expect(text).toContain("数据截至 2026-11-19 15:00");

    // 真实 0 与「没给」是两回事。
    expect(text).toContain("0 条");
    expect(text).not.toContain("法务合同归档 —");
    expect(text).toContain("最近同步：2026-11-19 13:05");

    // 失败要带原因：人话直出，技术性原文只进 title。
    expect(text).toContain("凭据已过期，无法登录源站");
    expect(text).not.toContain("ECONNREFUSED");
    const technical = container.querySelector('[data-testid="knw5-ingest-tasks-failure"][title*="ECONNREFUSED"]');
    expect(technical).toBeTruthy();
    expect(technical?.textContent ?? "").toContain("悬停可看原文");
    expect(text).toContain("214 条");

    // 近乎空壳的一条：每一缺项各自说明缺什么，不借别行的数字。
    expect(text).toContain("上游没有给出这个数据源叫什么");
    expect(text).toContain("上游没有给出来源类型");
    expect(text).toContain("上游没有给出同步状态");
    expect(text).toContain("待核实");
    expect(text).toContain("上游没有给出这一条有多少条目");
    expect(text).toContain("上游没有给出时间");

    // 原始值不上屏。
    for (const raw of ["src_HR2026AAA", "src_legal", "src_pay", "src_tech", "src_thin"]) expect(text).not.toContain(raw);
    expect(text).not.toContain("syncing");
    expect(text).not.toContain("sourceId");
    expect(text).not.toContain("itemCount");
    expect(text).not.toContain("lastError");
    expect(attr("knw5-ingest-tasks-row", "title")).toBe("src_HR2026AAA");

    // 文档登记是另一个读口：它没接上，就用自己的话说自己没接上。
    expect(attr("knw5-ingest", "data-state")).toBe("unwired");
    expect(text).toContain("请求编号：rid-docs");
    expect(byTestid("knw5-ingest-unwired")?.querySelector("b")?.textContent).toBe("文档登记读口未接入");
    expect(byTestid("knw5-ingest-unwired")?.getAttribute("title")).toBe("GAP-03");
    const taskSource = byTestid("knw5-ingest-tasks-source")?.textContent ?? "";
    expect(taskSource).toContain("数据截至 2026-11-19 15:00");
    expect(taskSource).not.toContain("时间未知");
  });

  it("draws the one unwired body for the ingest task read on 403 and on 404", async () => {
    fetchMock.mockImplementation((url: string) =>
      url === TASKS ? fail(403, "没有查看这项数据的权限。", "rid-tasks-denied") : fail(404, "这个数据接口还没有接入。", "rid-tasks-gone"),
    );

    await render("/knowledge?tab=spaces&panel=ingest");
    const denied = byTestid("knw5-ingest-tasks-unwired");
    expect(denied).toBeTruthy();
    expect(denied?.getAttribute("title")).toBe("GAP-03");
    expect(container.textContent).toContain("请求编号：rid-tasks-denied");
    expect(byTestid("knw5-ingest-tasks-table")).toBeNull();

    await click("knw5-tab-spaces");
    await click("knw5-tab-ingest");
    const gone = byTestid("knw5-ingest-tasks-unwired");
    expect(gone).toBeTruthy();
    expect(container.textContent).toContain("请求编号：rid-tasks-gone");
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");
    expect(bodyOf(gone)).toBe(bodyOf(denied));
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
      ["/knowledge?tab=spaces&panel=ingest", "ingest", [INGEST_STATUS, TASKS, DOCUMENTS]],
      ["/knowledge?tab=spaces&panel=retrieval", "retrieval", [SEARCH_NO_QUERY, RECORDS]],
      ["/knowledge?tab=spaces&panel=evidence", "evidence", [CITATIONS, SESSIONS]],
      ["/knowledge?tab=ingest", "ingest", [INGEST_STATUS, TASKS, DOCUMENTS]],
      ["/knowledge?tab=sources", "ingest", [INGEST_STATUS, TASKS, DOCUMENTS]],
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

  it("?state=error switches the content surface without calling the service", async () => {
    await render("/knowledge?state=error");
    expect(container.querySelector('[data-testid="knw5-forced-error"]')).toBeTruthy();
    expect(container.textContent).toContain("预览错误");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("?state=ready is live data, not a fixture", async () => {
    fetchMock.mockResolvedValue({ items: [{ spaceId: "s1", name: "空间一" }] });
    await render("/knowledge?state=ready");
    expect(fetchMock).toHaveBeenCalledWith(SPACES);
    expect(container.textContent).toContain("空间一");
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

  it("drills a citation open to its 原文与摘要 and keeps that choice in the URL", async () => {
    const LONG_SUMMARY =
      "这一段的完整摘要：第三季度的毛利口径按区域拆分，退货冲销计入当月，华东口径自 11 月起与集团一致，因此同比数据需要按新口径重算后才能对比。";
    fetchMock.mockImplementation((url: string) => {
      if (url === CITATIONS) {
        return Promise.resolve({
          asOf: "2026-11-19T07:31:00Z",
          citations: [
            {
              citationId: "cit_long",
              title: "季度经营复盘报告",
              documentName: "季度经营复盘.docx",
              sourceType: "docx",
              href: "/runs/run_9",
              createdAt: "2026-11-19T05:00:00Z",
              summary: LONG_SUMMARY,
              employeeName: "陈嘉禾",
              employeeId: "emp_A1B2C3D4E5F60718",
            },
            {
              citationId: "cit_ext",
              title: "外部镜像：薪酬口径说明",
              url: "https://files.example.invalid/comp.pdf",
              createdAt: "2026-11-19T04:00:00Z",
            },
          ],
        });
      }
      if (url === SESSIONS) {
        return Promise.resolve({ items: [{ session_id: "cs_1", employee_id: "u_1", message_count: 1, updated_at: "2026-11-19T06:00:00Z" }] });
      }
      if (url === "/agent-api/api/console-sessions/cs_1") {
        return Promise.resolve({
          messages: [{ role: "assistant", createdAt: "2026-11-19T06:00:00Z", citations: [{ id: "cit_s1", title: "会话里的引用", href: "/documents/d1" }] }],
        });
      }
      return fail(404, "这个数据接口还没有接入。");
    });

    await render("/knowledge?tab=spaces&panel=evidence");
    expect(attr("knw5-citations", "data-len")).toBe("2");
    expect(byTestid("knw5-citations-list-detail")).toBeNull();

    await click("knw5-citations-list-drill");
    const detail = byTestid("knw5-citations-list-detail");
    expect(detail).toBeTruthy();
    expect(detail?.textContent ?? "").toContain(LONG_SUMMARY);
    expect(detail?.textContent ?? "").toContain("原文位置");
    expect(attr("knw5-citations-list-detail-open", "href")).toBe("/runs/run_9");
    expect(attr("knw5-citations-list-detail", "title")).toBe("cit_long");
    expect(attr("knw5-citations-list-row", "data-open")).toBe("1");
    expect((byTestid("loc")?.textContent ?? "")).toContain("ref=cit_long");

    // 刷新：还开在同一行。
    await render("/knowledge?tab=spaces&panel=evidence&ref=cit_long");
    expect(byTestid("knw5-citations-list-detail")).toBeTruthy();
    expect(attr("knw5-citations-list-detail-summary", "data-testid")).toBe("knw5-citations-list-detail-summary");

    // 第二行：原文不可达要把原因写清楚。
    await clickNth("knw5-citations-list-drill", 1);
    const second = byTestid("knw5-citations-list-detail");
    expect(second?.textContent ?? "").toContain("原文不可达");
    expect(second?.textContent ?? "").toContain("不是站内地址");
    expect(byTestid("knw5-citations-list-detail-open")).toBeNull();

    // 收回；换面板不带着上一面板的展开行跑。
    await clickNth("knw5-citations-list-drill", 1);
    expect(byTestid("knw5-citations-list-detail")).toBeNull();
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("ref=");

    await click("knw5-citations-list-drill");
    expect(byTestid("knw5-citations-list-detail")).toBeTruthy();
    await click("knw5-tab-spaces");
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("ref=");
    expect(byTestid("knw5-citations-list-detail")).toBeNull();

    // 会话引用同一套下钻。
    await click("knw5-tab-evidence");
    expect(attr("knw5-session-cites", "data-len")).toBe("1");
    await click("knw5-session-cites-list-drill");
    expect(attr("knw5-session-cites-list-detail-open", "href")).toBe("/documents/d1");
  });

  it("drills a citation down to 定位、原话与出处，缺的那一项各自写明原因", async () => {
    const CITATION_ROWS = {
      asOf: "2026-11-19T08:00:00Z",
      citations: [
        {
          citationId: "cit_page",
          title: "员工手册 · 考勤篇",
          documentName: "员工手册.pdf",
          sourceType: "pdf",
          page: 12,
          quote: "迟到三十分钟以内记为弹性工时，超过三十分钟需事前报备。",
          summary: "这一段讲弹性工时与迟到报备的口径。",
          query: "员工迟到怎么算？",
          runId: "run_20261119abcd",
          citeCount: 4,
          href: "/documents/doc_attendance",
          citedAt: "2026-11-19T07:20:00Z",
        },
        { citationId: "cit_lines", doc: "薪酬口径说明", lineStart: 40, lineEnd: 52 },
        { citationId: "cit_doc_only", doc: "远程办公约定" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === CITATIONS) return Promise.resolve(CITATION_ROWS);
      if (url === SESSIONS) return Promise.resolve({ items: [] });
      return fail(404, "这个数据接口还没有接入。");
    });

    await render("/knowledge?tab=spaces&panel=evidence");
    expect(attr("knw5-citations", "data-state")).toBe("ready");
    expect(attr("knw5-citations", "data-len")).toBe("3");

    await click("knw5-citations-list-drill");
    const detail = byTestid("knw5-citations-list-detail");
    const detailText = detail?.textContent ?? "";
    expect(detailText).toContain("第 12 页");
    expect(detailText).toContain("迟到三十分钟以内记为弹性工时，超过三十分钟需事前报备。");
    expect(detailText).toContain("当时的提问：员工迟到怎么算？");
    expect(detailText).toContain("由一次运行引出");
    expect(detailText).toContain("被引用 4 次");
    expect(detailText).toContain("2026-11-19 15:20");
    expect(attr("knw5-citations-list-detail-open", "href")).toBe("/documents/doc_attendance");
    expect(attr("knw5-citations-list-detail-origin-link", "href")).toBe("/runs/run_20261119abcd");
    expect(detailText).not.toContain("cit_page");
    expect(detail?.getAttribute("title")).toBe("cit_page");

    // 只有行区间的一条：页码缺着就写缺，不借别条的数字。
    await clickNth("knw5-citations-list-drill", 1);
    const second = byTestid("knw5-citations-list-detail")?.textContent ?? "";
    expect(second).toContain("行 40–52");
    expect(second).toContain("上游没有说明这段内容是谁留下的");
    expect(second).not.toContain("第 12 页");

    // 契约里 citations 只有 {"doc":"…"}：其余全部如实缺省，不编造。
    await clickNth("knw5-citations-list-drill", 2);
    const third = byTestid("knw5-citations-list-detail")?.textContent ?? "";
    expect(third).toContain("原文不可达");
    expect(third).toContain("上游没有给出原文位置");
    expect(third).toContain("上游没有给出这段内容在原文里的位置");
    expect(third).toContain("上游没有给出被引用的原话");
    expect(third).toContain("上游没有说明这段引用是从哪儿产生的");
    expect(third).toContain("上游没有给出这段内容的摘要");
    expect(third).toContain("上游记录没有给出时间");
    expect(third).toContain("上游没有说明这段引用是从哪儿产生的");
    expect(third).not.toContain("被引用 0");
    expect(third).not.toContain("共 0");
  });

  it("carries the conversation depth of session citations: 哪一轮问的、第几条回答", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === CITATIONS) return fail(404, "这个数据接口还没有接入。", "rid-cit-404");
      if (url === SESSIONS) {
        return Promise.resolve({
          items: [
            { sessionId: "cs_01M7ABCDEF0123456789abcd", tenantId: "t_1", employeeId: "emp_86A81CE8FF6F42E1", createdAt: "2026-11-19T05:50:00Z", updatedAt: "2026-11-19T06:01:00Z", messageCount: 4 },
          ],
        });
      }
      if (url.startsWith("/agent-api/api/console-sessions/cs_01M7")) {
        return Promise.resolve({
          sessionId: "cs_01M7ABCDEF0123456789abcd",
          messageCount: 4,
          messages: [
            { seq: 1, role: "user", content: "远程办公要谁批？", requestId: "req-a", createdAt: "2026-11-19T05:55:00Z" },
            {
              seq: 2,
              role: "assistant",
              content: "按制度需要直属上级与人事双批。",
              requestId: "req-a",
              createdAt: "2026-11-19T05:56:00Z",
              citations: [{ doc: "远程办公约定.pdf" }],
            },
            { seq: 3, role: "user", content: "那加班呢？", requestId: "req-b", createdAt: "2026-11-19T05:59:00Z" },
            {
              seq: 4,
              role: "assistant",
              content: "加班需事前报备。",
              requestId: "req-b",
              createdAt: "2026-11-19T06:00:00Z",
              citations: [{ doc: "员工手册 · 考勤篇" }],
            },
          ],
        });
      }
      return fail(404, "这个数据接口还没有接入。");
    });

    await render("/knowledge?tab=spaces&panel=evidence");
    expect(attr("knw5-citations", "data-state")).toBe("unwired");
    expect(attr("knw5-session-cites", "data-state")).toBe("ready");
    expect(attr("knw5-session-cites", "data-len")).toBe("2");

    await click("knw5-session-cites-list-drill");
    const detail = byTestid("knw5-session-cites-list-detail")?.textContent ?? "";
    expect(detail).toContain("会话 · 6789ABCD 的第 2 条回答");
    expect(detail).toContain("当时的提问：远程办公要谁批？");
    expect(detail).toContain("远程办公约定.pdf");
    expect(detail).toContain("原文不可达");
    expect(detail).toContain("上游没有给出原文位置");
    expect(detail).toContain("2026-11-19 13:56");

    await clickNth("knw5-session-cites-list-drill", 1);
    const secondDetail = byTestid("knw5-session-cites-list-detail")?.textContent ?? "";
    expect(secondDetail).toContain("会话 · 6789ABCD 的第 4 条回答");
    expect(secondDetail).toContain("当时的提问：那加班呢？");

    const screen = container.textContent ?? "";
    expect(screen).not.toContain("cs_01M7");
    expect(screen).not.toContain("req-a");
    expect(screen).not.toContain("emp_86A81CE8FF6F42E1");
    expect(screen).not.toContain("citationId");
    expect(screen).not.toContain("messageCount");
  });

  it("keeps the drilled row through browser back and refresh, and drops it on another panel", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === CITATIONS) {
        return Promise.resolve({
          citations: [
            { citationId: "cit_a", title: "第一条", doc: "第一条", href: "/documents/a", createdAt: "2026-11-19T06:00:00Z" },
            { citationId: "cit_b", title: "第二条", doc: "第二条", url: "https://x.invalid/b.pdf", createdAt: "2026-11-19T06:05:00Z" },
          ],
        });
      }
      if (url === SESSIONS) return Promise.resolve({ items: [] });
      return Promise.resolve({ items: [] });
    });

    await render("/knowledge");
    await click("knw5-tab-evidence");
    await click("knw5-citations-list-drill");
    expect((byTestid("loc")?.textContent ?? "")).toContain("ref=cit_a");
    expect(byTestid("knw5-citations-list-detail")).toBeTruthy();

    await click("knw5-tab-spaces");
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("ref=");
    expect(byTestid("knw5-citations-list-detail")).toBeNull();

    // 后退 = 回到刚才那一面板与那一条展开行。
    await click("go-back");
    expect(attr("knw5-panel", "data-tab")).toBe("evidence");
    expect((byTestid("loc")?.textContent ?? "")).toContain("ref=cit_a");
    expect(byTestid("knw5-citations-list-detail")).toBeTruthy();

    const loc = byTestid("loc")?.textContent ?? "";
    await render(`/knowledge${loc}`);
    expect(attr("knw5-panel", "data-tab")).toBe("evidence");
    expect(byTestid("knw5-citations-list-detail")).toBeTruthy();

    await clickNth("knw5-citations-list-drill", 1);
    expect((byTestid("loc")?.textContent ?? "")).toContain("ref=cit_b");
    expect(byTestid("knw5-citations-list-detail-unreachable")).toBeTruthy();
    expect(byTestid("knw5-citations-list-detail-open")).toBeNull();
  });

  it("reads 入库状态 on its own port and says 「入库状态未接入」 when it is not wired", async () => {
    const STATUS_ROWS = {
      asOf: "2026-11-19T08:30:00Z",
      items: [
        { sourceName: "人事制度库", sourceType: "sharepoint", status: "in_progress", itemCount: 1380, processed: 412, lastSyncAt: "2026-11-19T06:40:00Z" },
        { sourceName: "法务合同归档", type: "s3", state: "completed", totalItems: 0, lastSyncAt: "2026-11-19T05:05:00Z" },
        { sourceName: "薪酬口径镜像", provider: "http", status: "failed", lastError: "凭据已过期，请重新授权", itemCount: 214 },
        { sourceId: "st_thin" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === INGEST_STATUS) return Promise.resolve(STATUS_ROWS);
      if (url === TASKS) return fail(404, "这个数据接口还没有接入。", "rid-tasks-gone");
      return fail(404, "这个数据接口还没有接入。", "rid-docs");
    });

    await render("/knowledge?tab=ingest");
    expect(fetchMock).toHaveBeenCalledWith(INGEST_STATUS);
    expect(attr("knw5-ingest-status", "data-state")).toBe("ready");
    expect(attr("knw5-ingest-status", "data-len")).toBe("4");
    expect(container.querySelectorAll('[data-testid="knw5-ingest-status-row"]')).toHaveLength(4);
    const text = container.textContent ?? "";
    expect(text).toContain("进行中");
    expect(text).toContain("1,380 条");
    expect(text).toContain("已处理 412 条");
    expect(text).toContain("最近同步：2026-11-19 14:40");
    // 真 0 与缺失可区分
    expect(text).toContain("已完成");
    expect(text).toContain("0 条");
    expect(text).toContain("失败");
    expect(text).toContain("凭据已过期，请重新授权");
    expect(text).toContain("来源：知识入库状态 · 数据截至 2026-11-19 16:30");
    // 三个读口各自说话：另两个没接上，不用入库状态的数据冒充。
    expect(attr("knw5-ingest-tasks", "data-state")).toBe("unwired");
    expect(attr("knw5-ingest", "data-state")).toBe("unwired");
    expect(text).toContain("数据源接入读口未接入");
    expect(text).toContain("文档登记读口未接入");
    expect(text).not.toContain("sourceName");
    expect(text).not.toContain("in_progress");

    // 404：一份诚实正文，点名这页自己的读口，GAP 只进 title。
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");
    fetchMock.mockImplementation((url: string) =>
      url === INGEST_STATUS ? fail(404, "这个数据接口还没有接入。", "rid-status-gone") : fail(403, "没有查看这项数据的权限。", "rid-other-denied"),
    );
    await render("/knowledge?tab=ingest");
    const gone = byTestid("knw5-ingest-status-unwired");
    expect(gone).toBeTruthy();
    expect(gone?.querySelector("b")?.textContent).toBe("入库状态未接入");
    expect(gone?.getAttribute("title")).toBe("GAP-03");
    expect(bodyOf(gone)).toContain("也不写「0 个源」");
    expect(byTestid("knw5-ingest-status-table")).toBeNull();
    expect(byTestid("knw5-ingest-status-retry")).toBeTruthy();
    expect(byTestid("knw5-ingest-status-apply")).toBeTruthy();
    expect(container.textContent).toContain("请求编号：rid-status-gone");

    // 403 同一份正文，只有请求编号不同。
    fetchMock.mockImplementation(() => fail(403, "没有查看这项数据的权限。", "rid-status-denied"));
    await render("/knowledge?tab=ingest");
    const denied = byTestid("knw5-ingest-status-unwired");
    expect(bodyOf(denied)).toBe(bodyOf(gone));
    expect(container.textContent).toContain("请求编号：rid-status-denied");
    const screen = container.textContent ?? "";
    for (const banned of ["GAP-03", "/api/", "ingest-status", "403", "404", "0 个源。", "共 0"]) {
      expect(screen, banned).not.toContain(banned);
    }

    // 200 空列表：如实说没读到，不编源。
    fetchMock.mockResolvedValue({ items: [] });
    await render("/knowledge?tab=ingest");
    expect(attr("knw5-ingest-status", "data-state")).toBe("ready");
    expect(attr("knw5-ingest-status", "data-len")).toBe("0");
    expect(container.textContent).toContain("这不等于一个源都没有");
    expect(container.querySelectorAll('[data-testid="knw5-ingest-status-row"]')).toHaveLength(0);
  });

  it("keeps the ingest bodies honest per read, identical for 403 and 404, and never a count", async () => {
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");

    fetchMock.mockImplementation(() => fail(404, "这个数据接口还没有接入。", "rid-gone-x"));
    await render("/knowledge?tab=ingest");
    const notFound = byTestid("knw5-ingest-tasks-unwired");
    expect(notFound?.querySelector("b")?.textContent).toBe("数据源接入读口未接入");
    expect(notFound?.getAttribute("title")).toBe("GAP-03");
    const notFoundText = bodyOf(notFound);
    expect(notFoundText).toContain("也不写「0 个源」");
    expect(byTestid("knw5-ingest-tasks-table")).toBeNull();
    expect(byTestid("knw5-ingest-tasks-apply")).toBeTruthy();

    fetchMock.mockImplementation(() => fail(403, "没有查看这项数据的权限。", "rid-denied-x"));
    await render("/knowledge?tab=ingest");
    const denied = byTestid("knw5-ingest-tasks-unwired");
    expect(bodyOf(denied)).toBe(notFoundText);
    expect(container.textContent).toContain("请求编号：rid-denied-x");

    const screen = container.textContent ?? "";
    for (const banned of ["共 0", "0 个源。", "403", "404", "/api/", "knowledge/sources", "documents?limit", "syncStatus", "itemCount", "GAP-03"]) {
      expect(screen, banned).not.toContain(banned);
    }

    // 200 但空：说清是空回答，不编源、不写数量。
    fetchMock.mockResolvedValue({ items: [] });
    await render("/knowledge?tab=ingest");
    expect(attr("knw5-ingest-tasks", "data-state")).toBe("ready");
    expect(attr("knw5-ingest-tasks", "data-len")).toBe("0");
    expect(container.textContent).toContain("接口已响应，但没有给出接入中的数据源");
    expect(container.querySelectorAll('[data-testid="knw5-ingest-tasks-row"]')).toHaveLength(0);
  });

  it("selects all four tabs and restores the chosen one on refresh and on back", async () => {
    fetchMock.mockResolvedValue({ items: [], results: [], events: [], sessions: [] });
    await render();
    for (const key of ["spaces", "ingest", "retrieval", "evidence"]) {
      await click(`knw5-tab-${key}`);
      expect(attr("knw5-panel", "data-tab")).toBe(key);
      expect(byTestid(`knw5-panel-${key}`)).toBeTruthy();
      const selected = container.querySelector('[role="tab"][aria-selected="true"]');
      expect(selected?.getAttribute("data-testid")).toBe(`knw5-tab-${key}`);
    }
    const lastSearch = byTestid("loc")?.textContent ?? "";

    await click("knw5-tab-spaces");
    await click("knw5-tab-ingest");
    await click("go-back");
    expect(attr("knw5-panel", "data-tab")).toBe("spaces");

    await click("knw5-tab-retrieval");
    await click("knw5-tab-evidence");
    await click("go-back");
    expect(attr("knw5-panel", "data-tab")).toBe("retrieval");
    const restored = byTestid("loc")?.textContent ?? "";
    await render(`/knowledge${restored}`);
    expect(attr("knw5-panel", "data-tab")).toBe("retrieval");

    // 深链带关键词也能恢复。
    await render(`/knowledge${lastSearch}&q=%E5%91%98%E5%B7%A5`);
    expect(attr("knw5-panel", "data-tab")).toBe("evidence");
    expect((byTestid("knw5-search-input") as HTMLInputElement | null)?.value ?? "").toBe("");
  });

  it("uses no engineering copy anywhere on the page", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === RECORDS) return Promise.resolve({ events: [] });
      if (url === SESSIONS) return Promise.resolve({ items: [] });
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
