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
import { DOC_LINE_HEADER, docSingleCopy, readSpaceDocuments, shortId } from "./knowledge";

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";
const DOCUMENTS = "/agent-api/api/documents?limit=50";
const TASKS = "/agent-api/api/knowledge/sources?limit=20";
const INGEST_STATUS = "/agent-api/api/knowledge/ingest-status?limit=20";
const docsUrlFor = (id: string) => `/agent-api/api/documents?limit=50&spaceId=${id}`;
const DOCS_SPACE = docsUrlFor("sp_hr");
const DOCUMENTS_PLAIN = "/agent-api/api/documents?limit=50";
const DOCUMENTS_DETAIL_MANUAL = "/agent-api/api/documents/d_manual";
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

/** The drawer is an overlay portalled to the document, not a node inside the pane. */
function byDocTestid(testid: string): Element | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

function docText(testid: string): string {
  return (byDocTestid(testid)?.textContent ?? "").replace(/\s+/g, " ");
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
  const node = (byTestid(testid) ?? document.querySelector(`[data-testid="${testid}"]`)) as HTMLElement | null;
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
  const nodes = document.querySelectorAll(`[data-testid="${testid}"]`);
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
    expect(notFoundText).toContain("知识空间未接入");
    expect(notFoundText).toContain("去审批中心提交申请");
    expect(notFoundText).not.toContain("0 个");
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

  it("opens the document drawer in place: focusable, closable by Esc and backdrop, focus back to the row", async () => {
    const LIST = {
      asOf: "2026-11-19T08:00:00Z",
      documents: [
        { documentId: "d_manual", fileName: "员工手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z", url: "/documents/d_manual" },
        { documentId: "d_bare" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === docsUrlFor("sp_hr")) return Promise.resolve(LIST);
      if (url === DOCUMENTS_DETAIL_MANUAL) return fail(404, "这个数据接口还没有接入。", "rid-detail-gone");
      return fail(404, "这个数据接口还没有接入。", "rid-x");
    });

    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byDocTestid("kn7-preview-panel")).toBeNull();
    expect(attr("kn3-docs", "data-len")).toBe("2");

    await click("kn3-docs-name");
    const panel = byDocTestid("kn7-preview-panel");
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-modal")).toBe("true");
    expect(panel?.getAttribute("aria-labelledby")).toBe("kn7-preview-title");
    expect((byDocTestid("loc")?.textContent ?? "")).toContain("doc=d_manual");
    // 抽屉不跳页：还在同一个地址族里，列表仍在下面
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]')).toHaveLength(2);
    // 列表给过的字段照常显示；详情口的两个字段老实说读不到
    expect(byDocTestid("kn7-preview-field-type")?.textContent).toBe("PDF");
    expect(byDocTestid("kn7-preview-field-size")?.textContent).toBe("2.4 MB");
    expect(byDocTestid("kn7-preview-field-updated")?.textContent).toContain("2026-11-19 15:10");
    expect(byDocTestid("kn7-preview-field-source")?.textContent ?? "").toContain("—");
    expect(byDocTestid("kn7-preview-field-pending")?.textContent ?? "").toContain("详情读口没接上");
    expect(byDocTestid("kn7-preview-field-status")?.textContent).toBe("—");
    // 不编正文/摘要
    expect(byDocTestid("kn7-preview-excerpt")).toBeNull();
    // 详情口未接入：一份正文 + GAP 只在 title + 可复制 rid + 重试 + 去处
    const unwired = byDocTestid("kn7-preview-unwired");
    expect(unwired?.querySelector("b")?.textContent).toBe("文档详情未接入");
    expect(unwired?.getAttribute("title")).toBe("GAP-03");
    expect(document.body.textContent ?? "").toContain("请求编号：rid-detail-gone");
    expect(byDocTestid("kn7-preview-retry")).toBeTruthy();
    expect(byDocTestid("kn7-preview-apply")).toBeTruthy();

    // Esc 关闭并把焦点还给原来那一行
    const firstAnchor = container.querySelector('a[data-testid="kn3-docs-name"]') as HTMLAnchorElement;
    firstAnchor.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeNull();
    expect((byDocTestid("loc")?.textContent ?? "")).not.toContain("doc=");
    expect(container.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as Element)?.getAttribute("data-testid")).toBe("kn3-docs-name");

    // 点遮罩（覆盖层自身，不是面板）也关闭
    await click("kn3-docs-name");
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    const scrimNode = byDocTestid("kn7-preview-backdrop") as HTMLElement;
    expect(scrimNode).toBeTruthy();
    expect(scrimNode.contains(byDocTestid("kn7-preview-panel"))).toBe(true);
    await act(async () => {
      scrimNode.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeNull();
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("doc=");

    // 刷新复现：?doc= 直接把抽屉开回来
    fetchMock.mockImplementation((url: string) => {
      if (url === docsUrlFor("sp_hr")) return Promise.resolve(LIST);
      if (url === DOCUMENTS_DETAIL_MANUAL) return Promise.resolve({ sourceName: "员工手册原件.pdf", status: "indexed" });
      return fail(404, "这个数据接口还没有接入。", "rid-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d_manual");
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    expect(byDocTestid("kn7-preview-field-source")?.textContent).toContain("员工手册原件.pdf");
    expect(byDocTestid("kn7-preview-field-status")?.textContent).toBe("已完成");
    expect(byDocTestid("kn7-preview-field-pending")).toBeNull();

    // 抽屉里的详情口出错：换内容而不是换徽标
    fetchMock.mockImplementation((url: string) => {
      if (url === docsUrlFor("sp_hr")) return Promise.resolve(LIST);
      if (url === DOCUMENTS_DETAIL_MANUAL) return fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-detail-busy");
      return fail(404, "这个数据接口还没有接入。", "rid-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d_manual");
    expect(byDocTestid("kn7-preview-error")).toBeTruthy();
    expect(byDocTestid("kn7-preview-unwired")).toBeNull();
    expect(document.body.textContent ?? "").toContain("请求编号：rid-detail-busy");

    // 403 与 404 同体
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");
    fetchMock.mockImplementation((url: string) => {
      if (url === docsUrlFor("sp_hr")) return Promise.resolve(LIST);
      if (url === DOCUMENTS_DETAIL_MANUAL) return fail(403, "没有查看这项数据的权限。", "rid-detail-denied");
      return fail(404, "这个数据接口还没有接入。", "rid-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d_manual");
    expect(bodyOf(byDocTestid("kn7-preview-unwired"))).toBe(bodyOf(unwired));
    expect(document.body.textContent ?? "").toContain("请求编号：rid-detail-denied");

    // 抽屉里没有任何写入控件，原始标识不上屏；它是覆盖层，不在面板节点里
    const drawerText = (byDocTestid("kn7-preview-panel")?.textContent ?? "").replace(/\s+/g, " ");
    expect(container.contains(byDocTestid("kn7-preview-panel") as Node)).toBe(false);
    expect(byDocTestid("kn7-preview-panel")?.querySelectorAll('form, textarea, select, input').length).toBe(0);
    expect(drawerText).not.toContain("d_manual");
    expect(drawerText).not.toContain("sizeBytes");
    expect(drawerText).not.toContain("/api/");
    expect(byDocTestid("kn7-preview-fields")?.getAttribute("data-testid")).toBe("kn7-preview-fields");
  });

  it("searches spaces across the loaded list with kn8-global, locally, in the URL, and with real links", async () => {
    const SPACE_LIST = {
      asOf: "2026-11-19T07:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", scope: "team", sourceName: "SharePoint · 集团人事库", docCount: 12, lastSyncAt: "2026-11-19T06:20:00Z", status: "synced" },
        { spaceId: "sp_fin", name: "财务口径空间", scope: "tenant", provider: "s3", docCount: 0, updatedAt: "2026-11-18T20:30:00Z", state: "ready" },
        { spaceId: "sp_ops", name: "运维手册空间", sourceName: "mirror.example.com", docCount: 7, status: "syncing" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE_LIST);
      return Promise.resolve({ items: [] });
    });

    await render("/knowledge?tab=spaces");
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(attr("knw5-spaces", "data-len")).toBe("3");
    const callsAfterLoad = fetchMock.mock.calls.length;
    const note = byTestid("kn8-scope-note")?.textContent ?? "";
    expect(note).toContain("仅在当前已加载 3 个空间内搜索");
    expect(note).toContain("不叫全库搜索");
    expect(note).toContain("键入也不会再请求一次");

    // 键入只筛不取数
    await type("kn8-global-input", "财务");
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
    expect(attr("knw5-spaces", "data-len")).toBe("1");
    const rows = container.querySelectorAll('[data-testid="knw5-spaces-row"]');
    expect(rows).toHaveLength(1);
    expect((byTestid("kn8-scope-note")?.textContent ?? "")).toContain("命中 1 个");
    // 命中数与展示同源：同一个 shown 数组
    expect(rows[0]?.textContent ?? "").toContain("财务口径空间");

    // 行仍是真 a[href] 到空间
    const link = rows[0]?.querySelector('[data-testid="kn-space-open"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toContain("space=sp_fin");

    // 提交才进 URL；刷新可复现
    await submitForm("kn8-global-form");
    expect((byTestid("loc")?.textContent ?? "")).toContain("q=%E8%B4%A2%E5%8A%A1");
    expect(fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]) === SPACES)).toHaveLength(1);
    await render("/knowledge?tab=spaces&q=%E8%B4%A2%E5%8A%A1");
    expect((byTestid("kn8-global-input") as HTMLInputElement | null)?.value).toBe("财务");
    expect(attr("knw5-spaces", "data-len")).toBe("1");

    // 来源也参与本地筛选（运维那条名字里没有 mirror）
    await type("kn8-global-input", "mirror");
    expect(container.querySelectorAll('[data-testid="knw5-spaces-row"]')).toHaveLength(1);

    // 无匹配：说清是本地筛完的结果，并给清空出口
    await type("kn8-global-input", "查无此空间");
    const empty = byTestid("knw5-spaces-empty")?.textContent ?? "";
    expect(empty).toContain("没有匹配的空间");
    expect(empty).toContain("已加载的 3 个空间");
    expect(empty).toContain("不代表库里没有这样的空间");
    await click("kn8-global-empty-clear");
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("q=");
    expect((byTestid("kn8-global-input") as HTMLInputElement | null)?.value).toBe("");
    expect(attr("knw5-spaces", "data-len")).toBe("3");

    // 零写入口与泄漏
    expect(container.querySelectorAll('[data-testid="knw5-page"] form[method="post"], [data-testid="knw5-page"] textarea, [data-testid="knw5-page"] select').length).toBe(0);
    const screen = container.textContent ?? "";
    for (const banned of ["sp_hr", "sp_fin", "sourceName", "docCount", "/api/", "knowledge/spaces"]) {
      expect(screen, banned).not.toContain(banned);
    }
  });

  it("keeps kn8 states honest: skeleton, empty without a fake count, and one body for 403 and 404", async () => {
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");

    // 空回答：注脚不写「已加载 0 个」
    fetchMock.mockImplementation((url: string) => (url === SPACES ? Promise.resolve({ items: [] }) : Promise.resolve({ items: [] })));
    await render("/knowledge?tab=spaces");
    const note = byTestid("kn8-scope-note")?.textContent ?? "";
    expect(note).toContain("这一份空间回答里没有可筛的空间");
    expect(note).not.toContain("0 个空间");
    expect(attr("knw5-spaces", "data-len")).toBe("0");
    expect(byTestid("knw5-spaces-empty")?.textContent ?? "").toContain("这不等于「没有空间」");

    // 未接入
    fetchMock.mockImplementation((url: string) => (url === SPACES ? fail(404, "这个数据接口还没有接入。", "rid-sp-gone") : fail(404, "没接上", "rid-x")));
    await render("/knowledge?tab=spaces");
    const gone = byTestid("knw5-spaces-unwired");
    expect(gone?.querySelector("b")?.textContent).toBe("知识空间未接入");
    expect(gone?.getAttribute("title")).toBe("GAP-03");
    expect(byTestid("kn8-global-clear")).toBeNull();

    // 403 同一份正文
    fetchMock.mockImplementation((url: string) => (url === SPACES ? fail(403, "没有查看这项数据的权限。", "rid-sp-denied") : fail(404, "没接上", "rid-x")));
    await render("/knowledge?tab=spaces");
    expect(bodyOf(byTestid("knw5-spaces-unwired"))).toBe(bodyOf(gone));

    // 500 换内容而不是换徽标
    fetchMock.mockImplementation((url: string) => (url === SPACES ? fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-sp-busy") : fail(404, "没接上", "rid-x")));
    await render("/knowledge?tab=spaces");
    expect(byTestid("knw5-spaces-error")).toBeTruthy();
    expect(byTestid("knw5-spaces-unwired")).toBeNull();
    expect(container.textContent).toContain("请求编号：rid-sp-busy");

    // 骨架
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await render("/knowledge?tab=spaces");
    expect(attr("knw5-spaces", "data-state")).toBe("loading");
    expect(byTestid("knw5-spaces-loading")).toBeTruthy();
    await act(async () => { release({ items: [{ spaceId: "s1", name: "空间一", docCount: 1 }] }); });
    await act(async () => {});
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(container.textContent ?? "").toContain("空间一");

    // 详情位与抽屉仍完好：kn3/kn7/kn6 家族没有被这次改动打断
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" }] });
      if (url.startsWith("/agent-api/api/documents?limit=50&spaceId=")) return Promise.resolve({ documents: [{ documentId: "d1", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 1024, updatedAt: "2026-11-19T07:00:00Z", url: "/documents/d1" }] });
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ documents: [] });
      if (url === "/agent-api/api/documents/d1") return Promise.resolve({ sourceName: "员工手册原件.pdf", status: "indexed" });
      return fail(404, "这个数据接口还没有接入。", "rid-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d1");
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    expect(byDocTestid("kn7-preview-field-status")?.textContent).toBe("已完成");
    expect(byTestid("kn3-docs")).toBeTruthy();
    expect(byTestid("kn6-search")).toBeTruthy();
    // kn8-global 只在空间列表页顶部；进了某个空间的详情位就不该再挂着它
    for (const id of ["kn8-global-input", "kn8-global-submit", "kn8-scope-note", "kn8-global-form"]) {
      expect(byTestid(id), id).toBeNull();
    }
    await click("kn3-docs-back");
    expect(byTestid("kn8-global-input")).toBeTruthy();
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
    for (const head of ["空间名称", "来源", "文档数", "最近同步", "状态"]) expect(text).toContain(head);
    expect(text).toContain("产品知识");
    expect(text).toContain("团队空间");
    expect(byTestid("knw5-space-source")?.textContent ?? "").toBe("—");
    expect((byTestid("knw5-space-source")?.closest("td")?.textContent ?? "").replace(/\s+/g, " ")).toContain(
      "上游没有说明这个空间的内容从哪里来",
    );
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

  it("renders spaces depth: 空间名 / 来源人话 / 文档数真 0 与缺失分开 / 最近同步 BJT / 状态词", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) {
        return Promise.resolve({
          asOf: "2026-11-19T07:00:00Z",
          items: [
            {
              spaceId: "sp_hr",
              name: "人事制度空间",
              scope: "team",
              sourceName: "SharePoint · 集团人事库",
              docCount: 1240,
              lastSyncAt: "2026-11-19T06:20:00Z",
              status: "synced",
            },
            { spaceId: "sp_zero", name: "空的知识空间", provider: "s3", totalDocuments: 0, syncedAt: "2026-11-19T04:00:00Z", state: "ready" },
            { spaceId: "sp_url", name: "对外口径镜像", origin: "https://mirror.example.com/kb/policy", documentCount: 18, status: "unknown_value" },
            { spaceId: "sp_fail", name: "断掉的数据库空间", repository: "crm-mysql", status: "failed", lastError: "凭据过期，无法读取库表清单", chunkCount: 512 },
            { spaceId: "sp_bare" },
            { name: "没给标识的空间", documentCount: 3, status: "synced" },
          ],
        });
      }
      if (url === INGEST_STATUS) return fail(404, "这个数据接口还没有接入。", "rid-status-x");
      if (url === TASKS) return fail(404, "这个数据接口还没有接入。", "rid-tasks-x");
      return fail(404, "这个数据接口还没有接入。", "rid-docs-x");
    });

    await render("/knowledge?tab=spaces");
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(attr("knw5-spaces", "data-len")).toBe("6");
    const rows = container.querySelectorAll('[data-testid="knw5-spaces-row"]');
    expect(rows).toHaveLength(6);
    const cell = (i: number, id: string) => {
      const sel = id === "knw5-space-name" ? "[data-testid='kn-space-open'],[data-testid='knw5-space-name']" : `[data-testid="${id}"]`;
      return (rows[i]?.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
    };

    // 来源人话：直给的名字、认得出的工具、只有链接时给主机名
    expect(cell(0, "knw5-space-name")).toContain("人事制度空间");
    // 有标识的空间行是真实可聚焦链接，点进去就是这个空间的文档列表
    const link0 = rows[0]?.querySelector('[data-testid="kn-space-open"]') as HTMLAnchorElement | null;
    expect(link0?.getAttribute("href")).toContain("space=sp_hr");
    expect(cell(0, "knw5-space-source")).toBe("SharePoint · 集团人事库");
    expect(cell(0, "knw5-space-docs")).toBe("1,240 篇");
    expect(cell(0, "knw5-space-time")).toContain("最近同步：2026-11-19 14:20");
    expect(cell(0, "knw5-space-status")).toContain("已同步");
    expect(cell(1, "knw5-space-source")).toBe("对象存储");
    expect(cell(1, "knw5-space-docs")).toBe("0 篇");            // 真 0
    expect(cell(1, "knw5-space-status")).toContain("可用");
    expect(cell(2, "knw5-space-source")).toContain("mirror.example.com");
    expect(cell(2, "knw5-space-status")).toContain("待核实");   // 认不出的值不猜

    // 失败：原因直出；只有分块数时不冒充文档数
    expect(cell(3, "knw5-space-status")).toContain("失败");
    expect(cell(3, "knw5-space-failure")).toContain("凭据过期，无法读取库表清单");
    expect(cell(3, "knw5-space-docs")).toContain("—");
    expect(cell(3, "knw5-space-docs-extra")).toBe("分块 512 段");

    // 全缺的一条：逐项说缺，绝不借别条或别端点的数字
    expect(cell(4, "knw5-space-name")).toBe("—");
    expect(cell(4, "knw5-space-source")).toBe("—");
    expect(cell(4, "knw5-space-docs")).toBe("—");
    expect(cell(4, "knw5-space-time")).toBe("—");
    expect(cell(4, "knw5-space-status")).toContain("待核实");

    // 没有标识的空间不硬造链接，直说点不进去
    const nameless = rows[5]?.querySelector('[data-testid="kn-space-open"]');
    expect(nameless).toBeNull();
    expect((rows[5]?.querySelector('[data-testid="knw5-space-name"]')?.textContent ?? "")).toContain("没给标识的空间");
    expect((rows[5]?.textContent ?? "").replace(/\s+/g, " ")).toContain("点不进文档列表");

    const text = container.textContent ?? "";
    expect(text).toContain("来源：知识空间登记 · 数据截至 2026-11-19 15:00");
    for (const banned of ["sp_hr", "sp_zero", "sp_bare", "sourceName", "docCount", "totalDocuments", "chunkCount", "https://mirror.example.com/kb", "unknown_value", "/api/"]) {
      expect(text, banned).not.toContain(banned);
    }
    // 零写入口：只有一个读侧关键词框（method 不是 post），没有写控件
    expect(container.querySelectorAll('[data-testid="knw5-page"] form[method="post"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="knw5-page"] textarea, [data-testid="knw5-page"] select, [data-testid="knw5-page"] input[type="checkbox"]').length).toBe(0);
    const forms = [...container.querySelectorAll('[data-testid="knw5-page"] form')];
    expect(forms.every((f) => (f.getAttribute("method") ?? "get").toLowerCase() !== "post")).toBe(true);
    expect(container.querySelectorAll('[data-testid="kn6-search-input"]').length).toBe(1);
    expect(attr("knw5-page", "data-fixture")).toBeNull();

    // 404 与 403：同一份「知识空间未接入」正文 + 去处；GAP 只在 title
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");
    fetchMock.mockImplementation(() => fail(404, "这个数据接口还没有接入。", "rid-space-gone"));
    await render("/knowledge?tab=spaces");
    const gone = byTestid("knw5-spaces-unwired");
    expect(gone?.querySelector("b")?.textContent).toBe("知识空间未接入");
    expect(gone?.getAttribute("title")).toBe("GAP-03");
    expect(bodyOf(gone)).toContain("去审批中心提交申请");
    expect(bodyOf(gone)).toContain("运行事件引用");
    expect(bodyOf(gone)).not.toContain("0 个");
    expect(byTestid("knw5-spaces-table")).toBeNull();
    expect(byTestid("knw5-spaces-apply")).toBeTruthy();
    expect(container.textContent).toContain("请求编号：rid-space-gone");

    fetchMock.mockImplementation(() => fail(403, "没有查看这项数据的权限。", "rid-space-denied"));
    await render("/knowledge?tab=spaces");
    expect(bodyOf(byTestid("knw5-spaces-unwired"))).toBe(bodyOf(gone));
    expect(container.textContent).toContain("请求编号：rid-space-denied");

    // 200 空列表：诚实空态，不写数量
    fetchMock.mockResolvedValue({ items: [] });
    await render("/knowledge?tab=spaces");
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    expect(attr("knw5-spaces", "data-len")).toBe("0");
    expect(byTestid("knw5-spaces-empty")?.textContent ?? "").toContain("这不等于「没有空间」");
    expect(container.querySelectorAll('[data-testid="knw5-spaces-row"]')).toHaveLength(0);
  });

  it("searches document names across spaces locally, in the URL, and never claims the whole library", async () => {
    const LIST = {
      asOf: "2026-11-19T08:00:00Z",
      documents: [
        { documentId: "d_manual", fileName: "员工手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z", url: "/documents/d_manual", spaceId: "sp_hr", spaceName: "人事制度空间" },
        { documentId: "d_pay", title: "薪酬口径表.xlsx", docType: "xlsx", sizeBytes: 40960, lastSyncAt: "2026-11-19T05:30:00Z", spaceId: "sp_fin" },
        { documentId: "d_bare" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(LIST);
      if (url === SPACES) return Promise.resolve({ items: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-x");
    });

    await render("/knowledge?tab=spaces");
    // 一次读取
    expect(urlsCalled().filter((u: string) => u === DOCUMENTS_PLAIN)).toHaveLength(1);
    expect(attr("kn6-search", "data-state")).toBe("ready");
    expect(attr("kn6-search", "data-len")).toBe("3");
    const note = byTestid("kn6-search-note")?.textContent ?? "";
    expect(note).toContain("仅在当前已加载 3 条内搜索");
    expect(note).toContain("不接受关键词参数");
    expect(note).toContain("不叫全库搜索");   // 明确否认全库口径

    // 行是真实可聚焦 a[href]，列为 文档名/所属空间/类型/大小/更新
    const rows = container.querySelectorAll('[data-testid="kn6-search-row"]');
    expect(rows).toHaveLength(3);
    const anchors = container.querySelectorAll('a[data-testid="kn6-search-name"]');
    expect(anchors).toHaveLength(3);
    expect((anchors[0] as HTMLAnchorElement).getAttribute("href")).toContain("sdoc=d_manual");
    const r0 = (rows[0]?.textContent ?? "").replace(/\s+/g, " ");
    expect(r0).toContain("员工手册.pdf");
    expect(r0).toContain("人事制度空间");
    expect(r0).toContain("PDF");
    expect(r0).toContain("2.4 MB");
    expect(r0).toContain("2026-11-19 15:10");
    const r2 = rows[2] as Element;
    expect(r2.querySelector('[data-testid="kn6-search-size"]')?.getAttribute("title")).toBe("上游没有给出文件大小");
    expect(r2.querySelector('[data-testid="kn6-search-type"]')?.getAttribute("title")).toBe("上游没有给出文档类型");
    expect(r2.querySelector('[data-testid="kn6-search-space"]')?.getAttribute("title")).toBeNull();
    expect((r2.querySelector('[data-testid="kn6-search-space"]')?.textContent ?? "")).toBe("—");
    // 认不出的类型值不上屏，只在 title；给了时间就正常显示，不写缺失原因
    const r1 = rows[1] as Element;
    expect((r1.querySelector('[data-testid="kn6-search-type"]')?.textContent ?? "")).toBe("表格");
    expect((r1.querySelector('[data-testid="kn6-search-updated"]')?.textContent ?? "")).toContain("2026-11-19 13:30");
    expect(r1.querySelector('[data-testid="kn6-search-updated"]')?.getAttribute("title")).toBe("时间 2026-11-19T05:30:00Z（UTC）"); // R75 统一在场句
    expect(r2.querySelector('[data-testid="kn6-search-updated"]')?.getAttribute("title")).toBe("上游未返回时间；不用本机时间顶替。"); // R75 统一缺失句

    // 本地筛选：不再请求
    const before = fetchMock.mock.calls.length;
    await type("kn6-search-input", "薪酬");
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(attr("kn6-search", "data-len")).toBe("1");
    expect(container.querySelectorAll('[data-testid="kn6-search-row"]')).toHaveLength(1);

    // 提交才进 URL，可分享/刷新复现
    await submitForm("kn6-search-form");
    expect((byTestid("loc")?.textContent ?? "")).toContain("q=%E8%96%AA%E9%85%AC");
    expect(fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]) === DOCUMENTS_PLAIN)).toHaveLength(1);
    await render("/knowledge?tab=spaces&q=%E8%96%AA%E9%85%AC");
    expect((byTestid("kn6-search-input") as HTMLInputElement | null)?.value).toBe("薪酬");
    expect(attr("kn6-search", "data-len")).toBe("1");

    // 行展开：这一条没有站内位置，就写原因
    await click("kn6-search-name");
    expect(byTestid("kn6-search-detail")).toBeTruthy();
    expect(byTestid("kn6-search-detail-unreachable")?.textContent ?? "").toContain("原文不可达");
    expect(byTestid("kn6-search-detail-open")).toBeNull();
    expect((byTestid("loc")?.textContent ?? "")).toContain("sdoc=d_pay");

    // 回到未筛选的列表，站内那条才能点回原文
    await render("/knowledge?tab=spaces");
    await click("kn6-search-name");
    expect(attr("kn6-search-detail-open", "href")).toBe("/documents/d_manual");
    expect((byTestid("loc")?.textContent ?? "")).toContain("sdoc=d_manual");
    await click("kn6-search-name");
    expect(byTestid("kn6-search-detail")).toBeNull();

    // 没有匹配：说清是本地筛选，并给清除入口
    await type("kn6-search-input", "查无此名");
    const emptyText = byTestid("kn6-search-empty")?.textContent ?? "";
    expect(emptyText).toContain("没有匹配的文档");
    expect(emptyText).toContain("3 条");
    expect(emptyText).toContain("不代表全库没有");
    await click("kn6-search-empty-clear");
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("q=");
    expect(attr("kn6-search", "data-len")).toBe("3");

    // 裸 id 与字段名不上屏
    const screen = container.textContent ?? "";
    for (const banned of ["d_manual", "d_pay", "sp_hr", "fileName", "sizeBytes", "mimeType", "limit=50", "/api/"]) {
      expect(screen, banned).not.toContain(banned);
    }
  });

  it("says 文档读口未接入 once for 404 and 403, with a copyable id, and shows a skeleton while reading", async () => {
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");

    fetchMock.mockImplementation((url: string) =>
      url === DOCUMENTS_PLAIN ? fail(404, "这个数据接口还没有接入。", "rid-docs-gone") : Promise.resolve({ items: [] }),
    );
    await render("/knowledge?tab=spaces");
    const gone = byTestid("kn6-search-unwired");
    expect(gone?.querySelector("b")?.textContent).toBe("文档登记读口未接入");
    expect(gone?.getAttribute("title")).toBe("GAP-03");
    expect(container.textContent).toContain("请求编号：rid-docs-gone");
    expect(byTestid("kn6-search-retry")).toBeTruthy();
    expect(byTestid("kn6-search-table")).toBeNull();
    const goneText = bodyOf(gone);

    fetchMock.mockImplementation((url: string) =>
      url === DOCUMENTS_PLAIN ? fail(403, "没有查看这项数据的权限。", "rid-docs-denied") : Promise.resolve({ items: [] }),
    );
    await render("/knowledge?tab=spaces");
    expect(bodyOf(byTestid("kn6-search-unwired"))).toBe(goneText);
    expect(container.textContent).toContain("请求编号：rid-docs-denied");

    // 骨架
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url === DOCUMENTS_PLAIN ? new Promise((resolve) => { release = resolve; }) : Promise.resolve({ items: [] }),
    );
    await render("/knowledge?tab=spaces");
    expect(byTestid("kn6-search-loading")).toBeTruthy();
    expect(attr("kn6-search", "data-state")).toBe("loading");
    await act(async () => { release({ documents: [] }); });
    await act(async () => {});
    expect(attr("kn6-search", "data-state")).toBe("ready");
    expect(byTestid("kn6-search-empty")?.textContent ?? "").toContain("这份回答是空的");

    // 强制预览态仍然一个请求都不发（他车道闸门的口径）
    fetchMock.mockClear();
    await render("/knowledge?tab=spaces&state=error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(byTestid("kn6-search-panel")).toBeNull();
  });

  // 队列#22 UX r1 P1-3（维度 4「三态无差异」的载入腿）：载入中必须自己说清在等什么，
  // 带关键词时还要把关键词回显出来——否则「载入中」与「无命中」在屏上只差几条占位条。
  it("P1-3 载入态在屏上说出在等什么，落定后这句话消失", async () => {
    let q22Docs: (value: unknown) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url === DOCUMENTS_PLAIN
        ? new Promise((resolve) => { q22Docs = resolve; })
        : Promise.resolve({ items: [] }),
    );
    await render("/knowledge?tab=spaces");
    expect(byTestid("kn6-search-loading")).toBeTruthy();
    const hint = byTestid("kn6-search-loading-hint");
    expect(hint, "载入中必须有一句在屏上的状态话").toBeTruthy();
    expect(hint?.getAttribute("role")).toBe("status");
    expect(hint?.textContent).toContain("正在取这份文档列表");
    expect(hint?.textContent ?? "").not.toMatch(/(^|[^0-9.])0\s*(条|篇|个)/); // 裸 0 不上屏
    await act(async () => { q22Docs({ documents: [] }); });
    await act(async () => {});
    expect(attr("kn6-search", "data-state")).toBe("ready");
    expect(byTestid("kn6-search-loading-hint"), "落定后这句话必须消失").toBeNull();

    let q22Search: (value: unknown) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url === SEARCH_STAFF
        ? new Promise((resolve) => { q22Search = resolve; })
        : Promise.resolve({ items: [] }),
    );
    await render("/knowledge?tab=spaces&panel=retrieval&q=%E5%91%98%E5%B7%A5");
    expect(attr("knw5-search", "data-state")).toBe("loading");
    const searchHint = byTestid("knw5-search-loading-hint");
    expect(searchHint, "检索面载入中同样要有状态话").toBeTruthy();
    expect(searchHint?.textContent).toContain("员工");
    await act(async () => { q22Search({ items: [] }); });
    await act(async () => {});
    expect(byTestid("knw5-search-loading-hint")).toBeNull();
  });

  it("lists a space's documents as focusable rows with honest gaps and a local filter", async () => {
    const DOC_ROWS = {
      asOf: "2026-11-19T08:00:00Z",
      documents: [
        { documentId: "doc_manual", fileName: "员工手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z", url: "/documents/doc_manual" },
        { documentId: "doc_xlsx", title: "薪酬口径表.xlsx", docType: "xlsx", sizeBytes: 40960, lastSyncAt: "2026-11-19T05:30:00Z" },
        { documentId: "doc_nothing" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === docsUrlFor("sp_hr")) return Promise.resolve(DOC_ROWS);
      if (url === SPACES) return fail(404, "这个数据接口还没有接入。", "rid-spaces-x");
      return fail(404, "这个数据接口还没有接入。");
    });

    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(urlsCalled()).toContain(DOCS_SPACE);
    // 顶部关键词框读的是不分空间的文档列表，且只读一次
    expect(urlsCalled().filter((u: string) => u === "/agent-api/api/documents?limit=50")).toHaveLength(1);
    expect(attr("kn3-docs", "data-state")).toBe("ready");
    expect(attr("kn3-docs", "data-len")).toBe("3");
    const rows = container.querySelectorAll('[data-testid="kn3-docs-row"]');
    expect(rows).toHaveLength(3);
    const texts = [...rows].map((tr) => (tr.textContent ?? "").replace(/\s+/g, " ").trim());
    expect(texts[0]).toContain("员工手册.pdf");
    expect(texts[0]).toContain("PDF");
    expect(texts[0]).toContain("2.4 MB");
    expect(texts[0]).toContain("2026-11-19 15:10");
    expect(texts[1]).toContain("表格");
    expect(texts[1]).toContain("40.0 KB");
    expect(texts[1]).toContain("最近同步：2026-11-19 13:30".replace("最近同步：", ""));
    // 缺值：屏面是「—」，原因在 title
    expect(texts[2]).toContain("—");
    const bare = rows[2] as Element;
    const sizeHint = bare.querySelector('[data-testid="kn3-docs-size"]')?.getAttribute("title") ?? "";
    expect(sizeHint).toBe("上游没有给出文件大小");
    expect(bare.querySelector('[data-testid="kn3-docs-type"]')?.getAttribute("title")).toBe("上游没有给出文档类型");
    expect(bare.querySelector('[data-testid="kn3-docs-updated"]')?.getAttribute("title")).toBe("上游未返回时间；不用本机时间顶替。"); // R75 统一缺失句
    expect(bare.querySelector('[data-testid="kn3-docs-name"]')?.getAttribute("title")).toBe("上游没有给出这份文档叫什么");

    // 每一行都是真实可聚焦的 a[href]
    const anchors = container.querySelectorAll('a[data-testid="kn3-docs-name"]');
    expect(anchors).toHaveLength(3);
    expect((anchors[0] as HTMLAnchorElement).getAttribute("href")).toContain("doc=doc_manual");
    expect(anchors[0].getAttribute("tabindex")).toBeNull();

    // 行就地开抽屉：抽屉是 document 上的覆盖层，面板节点里没有它
    await click("kn3-docs-name");
    expect(byDocTestid("kn3-docs-detail")).toBeTruthy();
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    expect(byDocTestid("kn7-preview-field-name")?.textContent ?? "").toContain("员工手册.pdf");
    expect(document.querySelector('[data-testid="kn3-docs-detail-open"]')?.getAttribute("href")).toBe("/documents/doc_manual");
    await click("kn7-preview-close");
    expect(byDocTestid("kn3-docs-detail")).toBeNull();
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("doc=doc_manual");

    await clickNth("kn3-docs-name", 1);
    expect(byDocTestid("kn3-docs-detail-unreachable")).toBeTruthy();
    expect(docText("kn3-docs-detail-unreachable")).toContain("上游没有给出原文位置");
    await click("kn7-preview-close");

    // 本地筛选必须自己说明是本地筛选
    const note = byTestid("kn3-docs-filter-note")?.textContent ?? "";
    expect(note).toContain("本地筛选");
    expect(note).toContain("不再问一次服务");
    const callsBefore = fetchMock.mock.calls.length;
    await type("kn3-docs-filter-input", "薪酬");
    expect(attr("kn3-docs", "data-len")).toBe("1");
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    const only = container.querySelectorAll('[data-testid="kn3-docs-row"]');
    expect(only).toHaveLength(1);
    expect(only[0].textContent ?? "").toContain("薪酬口径表.xlsx");

    await type("kn3-docs-filter-input", "不存在的关键词");
    const emptyFiltered = byTestid("kn3-docs-empty")?.textContent ?? "";
    expect(emptyFiltered).toContain("本地筛选没有匹配");
    expect(emptyFiltered).toContain("3 份文档");
    expect(emptyFiltered).not.toContain("该空间暂无文档");

    await type("kn3-docs-filter-input", "");
    expect(container.textContent ?? "").toContain("员工手册.pdf");

    // 返回链接把详情位关掉，回到空间列表
    await click("kn3-docs-back");
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("space=sp_hr");
    expect(byTestid("knw5-spaces")).toBeTruthy();

    // 原始 id 与字段名不上屏
    const screen = container.textContent ?? "";
    for (const banned of ["doc_manual", "doc_xlsx", "documentId", "sizeBytes", "mimeType", "limit=50", "/api/"]) {
      expect(screen, banned).not.toContain(banned);
    }
  });

  it("draws one 空间不存在或未授权 body for 403 and 404, and a real empty list", async () => {
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");

    fetchMock.mockImplementation((url: string) =>
      url === docsUrlFor("sp_missing") ? fail(404, "这个数据接口还没有接入。", "rid-docs-gone") : fail(404, "这个数据接口还没有接入。", "rid-other"),
    );
    await render("/knowledge?tab=spaces&space=sp_missing");
    const gone = byTestid("kn3-docs-unwired");
    expect(gone?.querySelector("b")?.textContent).toBe("空间不存在或未授权");
    expect(gone?.getAttribute("title")).toBe("GAP-03");
    expect(bodyOf(gone)).toContain("不靠回答的差别去猜");
    expect(container.textContent).toContain("请求编号：rid-docs-gone");
    expect(byTestid("kn3-docs-retry")).toBeTruthy();
    expect(byTestid("kn3-docs-table")).toBeNull();

    fetchMock.mockImplementation((url: string) =>
      url === docsUrlFor("sp_missing") ? fail(403, "没有查看这项数据的权限。", "rid-docs-denied") : fail(404, "这个数据接口还没有接入。"),
    );
    await render("/knowledge?tab=spaces&space=sp_missing");
    expect(bodyOf(byTestid("kn3-docs-unwired"))).toBe(bodyOf(gone));
    expect(container.textContent).toContain("请求编号：rid-docs-denied");

    // 200 空列表：该空间暂无文档（不是未接入）
    fetchMock.mockImplementation((url: string) =>
      url === docsUrlFor("sp_empty") ? Promise.resolve({ documents: [] }) : fail(404, "这个数据接口还没有接入。"),
    );
    await render("/knowledge?tab=spaces&space=sp_empty");
    expect(attr("kn3-docs", "data-state")).toBe("ready");
    expect(attr("kn3-docs", "data-len")).toBe("0");
    const emptyText = byTestid("kn3-docs-empty")?.textContent ?? "";
    expect(emptyText).toContain("该空间暂无文档");
    expect(emptyText).not.toContain("未接入");

    // 500：错误态换内容，rid 可复制
    fetchMock.mockImplementation((url: string) =>
      url === docsUrlFor("sp_boom") ? fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-docs-busy") : fail(404, "这个数据接口还没有接入。"),
    );
    await render("/knowledge?tab=spaces&space=sp_boom");
    expect(byTestid("kn3-docs-error")).toBeTruthy();
    expect(byTestid("kn3-docs-unwired")).toBeNull();
    expect(container.textContent).toContain("请求编号：rid-docs-busy");
    expect(byTestid("kn3-docs-retry")).toBeTruthy();

    // 骨架
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await render("/knowledge?tab=spaces&space=sp_slow");
    expect(byTestid("kn3-docs-loading")).toBeTruthy();
    expect(attr("kn3-docs", "data-state")).toBe("loading");
    await act(async () => { release({ documents: [{ documentId: "d1", fileName: "a.md", mimeType: "md" }] }); });
    await act(async () => {});
    expect(attr("kn3-docs", "data-state")).toBe("ready");
    expect(container.textContent ?? "").toContain("Markdown");

    // 详情位不是新路由：普通 URL 不带 space 时仍是空间列表，且没有写入控件
    fetchMock.mockResolvedValue({ items: [] });
    await render("/knowledge?tab=spaces");
    expect(byTestid("kn3-docs")).toBeNull();
    expect(byTestid("knw5-spaces")).toBeTruthy();
    expect(container.querySelector('[data-testid="knw5-page"] form[method="post"]')).toBeNull();
    expect(attr("knw5-page", "data-fixture")).toBeNull();

    // 切面板把详情位一起清掉，四 tab 仍 4/4
    await click("knw5-tab-retrieval");
    const loc = (byTestid("loc")?.textContent ?? "").replace(/^\?/, "");
    expect(loc).not.toContain("space=");
    expect(loc).not.toContain("doc=");
    for (const key of ["spaces", "ingest", "retrieval", "evidence"]) {
      expect(byTestid(`knw5-tab-${key}`)).toBeTruthy();
    }
    await render(`/knowledge?${loc}&space=sp_hr&doc=doc_manual`);
    expect((byTestid("loc")?.textContent ?? "")).toContain("panel=retrieval");
    expect(byTestid("kn3-docs")).toBeNull();
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
    const hidden = container.querySelector('[data-testid="knw5-space-failure"][title*="ECONNREFUSED"]');
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
    expect(text).toContain("这不等于「没有空间」");
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

  it("marks the matched span, counts hits from the same array, and moves focus by keyboard", async () => {
    const SPACE_LIST = {
      asOf: "2026-11-19T07:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", scope: "team", sourceName: "SharePoint · 集团人事库", docCount: 12, status: "synced" },
        { spaceId: "sp_fin", name: "财务口径空间", scope: "tenant", provider: "s3", docCount: 0, status: "ready" },
        { spaceId: "sp_ops", name: "运维手册空间", sourceName: "mirror.example.com", docCount: 7, status: "syncing" },
      ],
    };
    fetchMock.mockImplementation((url: string) => (url === SPACES ? Promise.resolve(SPACE_LIST) : Promise.resolve({ items: [] })));


    await render("/knowledge?tab=spaces");
    // 没关键词：不高亮，计数说“全部列出”
    expect(container.querySelectorAll('[data-testid="kn9-mark-space"]')).toHaveLength(0);
    expect(byTestid("kn9-count")?.textContent ?? "").toContain("当前已加载 3 项，全部列出");

    // 键入只筛不取数，并只包住宿命的那一段
    await type("kn8-global-input", "空间");
    const marks = container.querySelectorAll('[data-testid="kn9-mark-space"]');
    expect(marks).toHaveLength(3);
    expect(marks[0]?.textContent).toBe("空间");
    const rows = container.querySelectorAll('[data-testid="knw5-spaces-row"]');
    expect(rows).toHaveLength(3);
    // 文本语义没被改：单元格文字仍是原值
    const link0 = rows[0]?.querySelector('[data-testid="kn-space-open"]');
    expect((link0?.textContent ?? "").replace(/\s+/g, "")).toBe("人事制度空间");
    const count = byTestid("kn9-count")?.textContent ?? "";
    expect(count).toContain("当前已加载 3 项内命中 3 项");
    expect(count).toContain("同一份筛选结果");
    // 命中数与列表同源
    expect(count).toContain(`${(byTestid("knw5-spaces")?.getAttribute("data-len") ?? "")}`);

    await type("kn8-global-input", "财务");
    expect(container.querySelectorAll('[data-testid="kn9-mark-space"]')).toHaveLength(1);
    expect(byTestid("kn9-count")?.textContent ?? "").toContain("当前已加载 3 项内命中 1 项");

    // 键盘：↓ 从输入框进入第一行，再 ↓ 移动，↑ 回来，Esc 交还焦点
    const input = byTestid("kn8-global-input") as HTMLInputElement;
    const anchors = [...container.querySelectorAll('a[data-testid="kn-space-open"]')] as HTMLAnchorElement[];
    expect(anchors).toHaveLength(1);
    // 未开始 roving 之前，每个链接都可 tab（tabindex 0 = 随 DOM 顺序）
    expect(anchors.map((a) => a.getAttribute("tabindex"))).toEqual(["0"]);
    input.focus();
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(anchors[0]);

    // 三行都在时验证移动与回收
    await type("kn8-global-input", "");
    const all = [...container.querySelectorAll('a[data-testid="kn-space-open"]')] as HTMLAnchorElement[];
    expect(all).toHaveLength(3);
    const list = byTestid("kn9-space-list") as HTMLElement;
    all[0].focus();
    await act(async () => {
      list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(all[1]);
    expect(byTestid("kn9-space-list")?.getAttribute("data-active-row")).toBe("1");
    // roving 开始后：只有当前行可 tab，其余退出 tab 序列
    expect(all.map((a) => a.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    await act(async () => {
      list.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(all[2]);
    await act(async () => {
      list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(all[1]);
    await act(async () => {
      list.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(byTestid("kn8-global-input"));
    expect(all.map((a) => a.getAttribute("tabindex"))).toEqual(["0", "0", "0"]);

    // 读口不通时不报条数：计数元素直接不出现，免得「已加载 0 项」看着像假 0
    fetchMock.mockImplementation((url: string) =>
      url === SPACES ? Promise.resolve(SPACE_LIST) : fail(404, "这个数据接口还没有接入。", "rid-count-check"),
    );
    await render("/knowledge?tab=spaces");
    expect(byTestid("kn9-count")).toBeTruthy();
    expect(byTestid("kn9-count-docs")).toBeNull();

    fetchMock.mockImplementation(() => fail(404, "这个数据接口还没有接入。", "rid-count-none"));
    await render("/knowledge?tab=spaces");
    expect(byTestid("kn9-count")).toBeNull();
    expect(container.textContent ?? "").not.toContain("已加载 0 项");

    // 行落点仍是真 a[href]，Enter 走的就是它
    expect((all[1] as HTMLAnchorElement).getAttribute("href")).toContain("space=sp_fin");

    // 文档名那条腿同样高亮 + 计数
    fetchMock.mockImplementation((url: string) => {
      if (url === DOCUMENTS_PLAIN) {
        return Promise.resolve({
          documents: [
            { documentId: "d1", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z", url: "/documents/d1" },
            { documentId: "d2", fileName: "员工考勤补充说明", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    await render("/knowledge?tab=spaces");
    await type("kn6-search-input", "员工");
    const docMarks = container.querySelectorAll('[data-testid="kn9-mark-doc"]');
    expect(docMarks).toHaveLength(2);
    expect(docMarks[0]?.textContent).toBe("员工");
    expect(byTestid("kn9-count-docs")?.textContent ?? "").toContain("当前已加载 2 项内命中 2 项");
    const docList = byTestid("kn9-doc-list") as HTMLElement;
    const docLinks = [...container.querySelectorAll('a[data-testid="kn6-search-name"]')] as HTMLAnchorElement[];
    expect(docLinks).toHaveLength(2);
    docLinks[0].focus();
    await act(async () => {
      docList.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(docLinks[1]);
    expect((docLinks[1] as HTMLAnchorElement).getAttribute("href")).toContain("sdoc=d2");
    await act(async () => {
      docList.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(byTestid("kn6-search-input"));

    // 空结果文案与出口没有退化
    await type("kn6-search-input", "查无此名");
    expect(byTestid("kn6-search-empty")?.textContent ?? "").toContain("没有匹配的文档");
    expect(byTestid("kn6-search-empty-clear")).toBeTruthy();
  });

  it("keeps a copyable request id and retries a failure without HTTP copy", async () => {
    fetchMock.mockImplementation((url: string) =>
      url === SPACES ? fail(500, "数据服务暂时没有响应，请稍后重试。", "req-knw5-7") : Promise.resolve({ items: [] }),
    );
    await render();
    expect(byTestid("knw5-spaces-error")).toBeTruthy();
    expect(attr("knw5-spaces", "data-state")).toBe("error");
    const text = container.textContent ?? "";
    expect(text).toContain("请求编号：req-knw5-7");
    expect(text).toContain("复制");
    expect(text).not.toContain("500");
    expect(byTestid("knw5-spaces-retry")).toBeTruthy();

    fetchMock.mockImplementation((url: string) =>
      url === SPACES ? Promise.resolve({ items: [{ spaceId: "s1", name: "空间一" }] }) : Promise.resolve({ items: [] }),
    );
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

  it("separates real-empty from unreadable with knD-state-* on spaces and space docs, keeps 403≡404 bodies, retries only that read", async () => {
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ");

    // ---------- 空间列表：/knowledge ----------
    // 404：整块诚实态 + knD-state-unavailable，绝不冒充空集，GAP 只在 title
    fetchMock.mockImplementation(() => fail(404, "这个数据接口还没有接入。", "rid-sp-nw"));
    await render("/knowledge?tab=spaces");
    const gone404 = byTestid("knw5-spaces-unwired");
    expect(gone404).toBeTruthy();
    expect(byTestid("knD-state-unavailable")).toBeTruthy();
    expect(byTestid("knD-state-empty")).toBeNull();
    expect(byTestid("knD-state-denied")).toBeNull();
    expect(gone404?.getAttribute("title")).toBe("GAP-03");
    expect(container.textContent ?? "").not.toContain("0 个空间");
    const text404 = bodyOf(gone404);

    // 403：换一次读口，可见正文与 404 逐字相同，只多一个 denied 标记；屏面不泄露状态码
    fetchMock.mockImplementation(() => fail(403, "没有查看这项数据的权限。", "rid-sp-dn"));
    await render("/knowledge?tab=spaces");
    expect(byTestid("knD-state-denied")).toBeTruthy();
    expect(byTestid("knD-state-unavailable")).toBeNull();
    expect(bodyOf(byTestid("knw5-spaces-unwired"))).toBe(text404);
    expect(container.textContent ?? "").not.toContain("404");
    expect(container.textContent ?? "").not.toContain("403");

    // 真 0：200 + 空集 → knD-state-empty，走空态块，不出未接入块，也不写 0 个空间
    fetchMock.mockImplementation((url: string) =>
      url === SPACES ? Promise.resolve({ asOf: "2026-11-19T07:00:00Z", items: [] }) : fail(404, "没接上", "rid-x"),
    );
    await render("/knowledge?tab=spaces");
    expect(byTestid("knD-state-empty")).toBeTruthy();
    expect(byTestid("knD-state-unavailable")).toBeNull();
    expect(byTestid("knw5-spaces-unwired")).toBeNull();
    expect(byTestid("knw5-spaces-empty")).toBeTruthy();
    expect((byTestid("knw5-spaces-empty")?.textContent ?? "")).not.toContain("0 个空间");

    // 有数据：不挂任何 knD 标记
    fetchMock.mockImplementation((url: string) =>
      url === SPACES
        ? Promise.resolve({ asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 2 }] })
        : fail(404, "没接上", "rid-x"),
    );
    await render("/knowledge?tab=spaces");
    expect(container.querySelectorAll('[data-testid^="knD-state-"]')).toHaveLength(0);

    // ---------- 文档列表：/knowledge/:spaceId ----------
    const HR_SPACE = () => Promise.resolve({ asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] });
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return HR_SPACE();
      return fail(404, "这个数据接口还没有接入。", "rid-doc-nw");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("kn3-docs-unwired")).toBeTruthy();
    expect(byTestid("knD-state-unavailable")).toBeTruthy();
    const docText404 = bodyOf(byTestid("kn3-docs-unwired"));

    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return HR_SPACE();
      return fail(403, "没有查看这项数据的权限。", "rid-doc-dn");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("knD-state-denied")).toBeTruthy();
    expect(byTestid("knD-state-unavailable")).toBeNull();
    expect(bodyOf(byTestid("kn3-docs-unwired"))).toBe(docText404);

    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] });
      if (url.includes("spaceId=sp_hr")) return Promise.resolve({ asOf: "2026-11-19T07:00:00Z", documents: [] });
      return fail(404, "没接上", "rid-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("knD-state-empty")).toBeTruthy();
    expect(byTestid("kn3-docs-unwired")).toBeNull();
    expect((byTestid("kn3-docs-empty")?.textContent ?? "")).not.toContain("0 篇");

    // ---------- 切空间不残留：sp_hr 有文档 → sp_fin 读不到，筛选也清空 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T07:00:00Z", items: [] });
      if (url.includes("spaceId=sp_hr"))
        return Promise.resolve({ asOf: "2026-11-19T07:00:00Z", documents: [{ documentId: "d_1", fileName: "员工手册.pdf" }, { documentId: "d_2", fileName: "考勤说明.docx" }] });
      if (url.includes("spaceId=sp_fin")) return fail(404, "这个数据接口还没有接入。", "rid-fin");
      return fail(404, "没接上", "rid-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]')).toHaveLength(2);
    await type("kn3-docs-filter-input", "手册");
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]')).toHaveLength(1);
    await render("/knowledge?tab=spaces&space=sp_fin");
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]')).toHaveLength(0);
    expect(byTestid("knD-state-unavailable")).toBeTruthy();
    expect((byTestid("kn3-docs-filter-input") as HTMLInputElement | null)?.value).toBe("");

    // ---------- 重试只重发文档读口，不连带重发空间读口 ----------
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T07:00:00Z", items: [] });
      if (url.includes("spaceId=sp_fin")) return fail(404, "这个数据接口还没有接入。", "rid-fin");
      return fail(404, "没接上", "rid-x");
    });
    await render("/knowledge?tab=spaces&space=sp_fin");
    const docsBefore = urlsCalled().filter((u: string) => u.includes("spaceId=sp_fin")).length;
    const spacesBefore = urlsCalled().filter((u: string) => u === SPACES).length;
    expect(docsBefore).toBe(1);
    await click("kn3-docs-retry");
    const docsAfter = urlsCalled().filter((u: string) => u.includes("spaceId=sp_fin")).length;
    const spacesAfter = urlsCalled().filter((u: string) => u === SPACES).length;
    expect(docsAfter).toBe(docsBefore + 1);
    expect(spacesAfter).toBe(spacesBefore);
  });

  it("sorts the space document list locally (name/size/updated): aria-sort, URL state, missing-last, zero refetch", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const DOC_LIST = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 100, updatedAt: "2026-11-19T03:00:00Z" },
        { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 5000, updatedAt: "2026-11-19T09:00:00Z" },
        { documentId: "d_c", fileName: "C 说明.txt", mimeType: "txt", sizeBytes: 2000, updatedAt: "2026-11-19T05:00:00Z" },
        { documentId: "d_d", fileName: "D 无元数据" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(DOC_LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-sort-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");

    const nameOf = (tr: Element) => (tr.querySelector('[data-testid="kn3-docs-name"]')?.textContent ?? "").trim();
    const order = () => [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].map(nameOf);
    const ariaSort = (col: string) =>
      container.querySelector(`[data-testid="kn-sort-${col}"]`)?.closest("th")?.getAttribute("aria-sort") ?? null;
    const head = (col: string) => container.querySelector(`[data-testid="kn-sort-${col}"]`) as HTMLButtonElement | null;

    // 三列表头都是真 button[type=button]（Enter/Space 由浏览器原生触发，focus-visible 实测在浏览器侧）
    for (const col of ["name", "size", "updated"]) {
      expect(head(col)?.tagName).toBe("BUTTON");
      expect(head(col)?.getAttribute("type")).toBe("button");
    }

    // 默认口径：更新时间、新在前；缺更新时间的 D 恒末位
    expect(ariaSort("updated")).toBe("descending");
    expect(ariaSort("name")).toBe("none");
    expect(ariaSort("size")).toBe("none");
    expect(order()).toEqual(["B 表.xlsx", "C 说明.txt", "A 手册.pdf", "D 无元数据"]);

    const callsAfterLoad = fetchMock.mock.calls.length;

    // 点名称 → 升序并落 URL
    await click("kn-sort-name");
    expect(byTestid("loc")?.textContent ?? "").toContain("sort=name");
    expect(byTestid("loc")?.textContent ?? "").toContain("dir=asc");
    expect(ariaSort("name")).toBe("ascending");
    expect(order()).toEqual(["A 手册.pdf", "B 表.xlsx", "C 说明.txt", "D 无元数据"]);

    // 再点名称 → 翻转降序
    await click("kn-sort-name");
    expect(byTestid("loc")?.textContent ?? "").toContain("dir=desc");
    expect(ariaSort("name")).toBe("descending");
    expect(order()).toEqual(["D 无元数据", "C 说明.txt", "B 表.xlsx", "A 手册.pdf"]);

    // 点大小 → 该列首点落降序（大在前），无大小的 D 仍末位
    await click("kn-sort-size");
    expect(byTestid("loc")?.textContent ?? "").toContain("sort=size");
    expect(byTestid("loc")?.textContent ?? "").toContain("dir=desc");
    expect(ariaSort("size")).toBe("descending");
    expect(ariaSort("name")).toBe("none");
    expect(ariaSort("updated")).toBe("none");
    expect(order()).toEqual(["B 表.xlsx", "C 说明.txt", "A 手册.pdf", "D 无元数据"]);

    // 大小升序 → 小在前，缺大小仍末位（不当 0、不占首位）
    await click("kn-sort-size");
    expect(byTestid("loc")?.textContent ?? "").toContain("dir=asc");
    expect(order()).toEqual(["A 手册.pdf", "C 说明.txt", "B 表.xlsx", "D 无元数据"]);

    // 更新时间首点落降序、再点升序：旧在前，缺时间仍末位
    await click("kn-sort-updated");
    await click("kn-sort-updated");
    expect(byTestid("loc")?.textContent ?? "").toContain("sort=updated");
    expect(byTestid("loc")?.textContent ?? "").toContain("dir=asc");
    expect(ariaSort("updated")).toBe("ascending");
    expect(order()).toEqual(["A 手册.pdf", "C 说明.txt", "B 表.xlsx", "D 无元数据"]);

    // 点表头一次都没再问服务：读口只在进页时发过那一次
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
    expect(urlsCalled().filter((u: string) => u.includes("spaceId=sp_hr"))).toHaveLength(1);

    // 排序后点行仍按 id 开抽屉（key 取自读入顺序，排序不漂移）
    const bRow = [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].find((tr) =>
      nameOf(tr).startsWith("B"),
    );
    expect((bRow?.querySelector('[data-testid="kn3-docs-name"]') as HTMLAnchorElement).getAttribute("href")).toContain("doc=d_b");
    const bAnchor = bRow?.querySelector('[data-testid="kn3-docs-name"]') as HTMLElement | null;
    await act(async () => {
      bAnchor?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(docText("kn7-preview-field-name")).toContain("B 表.xlsx");
    await click("kn7-preview-close");

    // 空集保持既有诚实句（本地筛到没有，不算排序问题）
    await type("kn3-docs-filter-input", "查无此词");
    expect(byTestid("kn3-docs-empty")).toBeTruthy();
    expect((byTestid("kn3-docs-empty")?.textContent ?? "")).toContain("本地筛选没有匹配");

    // 粘 URL / 刷新可复现：带 sort=size&dir=asc 直接进来就是同一顺序，不多发请求
    fetchMock.mockClear();
    await render("/knowledge?tab=spaces&space=sp_hr&sort=size&dir=asc");
    expect(ariaSort("size")).toBe("ascending");
    expect(order()).toEqual(["A 手册.pdf", "C 说明.txt", "B 表.xlsx", "D 无元数据"]);
    expect(urlsCalled().filter((u: string) => u.includes("spaceId=sp_hr"))).toHaveLength(1);
  });

  it("keeps the search state across detail pages and renders a real breadcrumb chain", async () => {
    const SPACE_LIST = {
      asOf: "2026-11-19T07:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", scope: "team", sourceName: "SharePoint · 集团人事库", docCount: 12, status: "synced" },
        { spaceId: "sp_fin", name: "财务口径空间", scope: "tenant", docCount: 0, status: "ready" },
      ],
    };
    const DOC_LIST = {
      documents: [
        { documentId: "d_manual", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z", url: "/documents/d_manual" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE_LIST);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(DOC_LIST);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(DOC_LIST);
      if (url === "/agent-api/api/documents/d_manual") return Promise.resolve({ sourceName: "员工手册原件.pdf", status: "indexed" });
      return fail(404, "这个数据接口还没有接入。", "rid-x");
    });

    // 1) 检索页：关键词为空时不出检索层级
    await render("/knowledge?tab=spaces");
    expect(byTestid("knB-nav")).toBeTruthy();
    expect(byTestid("knB-crumb-search")).toBeNull();
    // 只有一级时它就是当前页：不可点、带 aria-current
    const listCrumb = byTestid("knB-crumb-list");
    expect(listCrumb?.tagName).toBe("SPAN");
    expect(listCrumb?.getAttribute("aria-current")).toBe("page");

    // 2) 关键词进 URL，面包屑出现检索层级
    await type("kn8-global-input", "人事");
    await submitForm("kn8-global-form");
    const urlWithQ = byTestid("loc")?.textContent ?? "";
    expect(urlWithQ).toContain("q=%E4%BA%BA%E4%BA%8B");
    expect(byTestid("knB-crumb-search")?.textContent ?? "").toContain("检索「人事」");
    // 出现检索层级后，「知识」变回真链且落点是去掉关键词的列表；末级仍不可点
    expect(byTestid("knB-crumb-list")?.tagName).toBe("A");
    expect((byTestid("knB-crumb-list") as HTMLAnchorElement).getAttribute("href")).toBe("/knowledge?tab=spaces");
    expect(byTestid("knB-crumb-search")?.getAttribute("aria-current")).toBe("page");

    // 3) 从命中行进到空间详情，面包屑三级：知识 / 空间名 / （末级）
    await click("kn-space-open");
    const afterEnter = byTestid("loc")?.textContent ?? "";
    expect(afterEnter).toContain("space=sp_hr");
    expect(afterEnter).toContain("q=%E4%BA%BA%E4%BA%8B"); // 关键词跟着进详情，返回才有得复原
    expect(byTestid("knB-crumb-space")?.textContent ?? "").toContain("人事制度空间");
    expect(byTestid("knB-crumb-space")?.getAttribute("aria-current")).toBe("page");
    expect(byTestid("knB-crumb-doc")).toBeNull();
    // 进了详情，检索层级也变成真链，落点带着关键词回到检索页
    expect(byTestid("knB-crumb-search")?.tagName).toBe("A");
    expect((byTestid("knB-crumb-search") as HTMLAnchorElement).getAttribute("href")).toContain("q=%E4%BA%BA%E4%BA%8B");
    expect((byTestid("knB-crumb-search") as HTMLAnchorElement).getAttribute("href")).not.toContain("space=");

    // 4) 进文档行 → 文档层级成为末级，且不可点
    await click("kn3-docs-name");
    expect((byTestid("loc")?.textContent ?? "")).toContain("doc=d_manual");
    const docCrumb = byTestid("knB-crumb-doc");
    expect(docCrumb?.tagName).toBe("SPAN");
    expect(docCrumb?.getAttribute("aria-current")).toBe("page");
    expect(docCrumb?.textContent ?? "").toContain("员工手册.pdf");
    const spaceCrumb = byTestid("knB-crumb-space");
    expect(spaceCrumb?.tagName).toBe("A");
    expect(spaceCrumb?.getAttribute("aria-current")).toBeNull();
    expect(spaceCrumb?.getAttribute("href")).toContain("space=sp_hr");
    expect(spaceCrumb?.getAttribute("href")).not.toContain("doc=");

    // 5) 浏览器后退逐级回退，回到检索页时 q 与命中态复原
    expect((byTestid("loc")?.textContent ?? "")).toContain("doc=d_manual");
    await click("go-back");
    const backToSpace = byTestid("loc")?.textContent ?? "";
    expect(backToSpace).toContain("space=sp_hr");
    expect(backToSpace).not.toContain("doc=");
    expect(byDocTestid("kn7-preview-panel")).toBeNull();
    await click("go-back");
    const backToSearch = byTestid("loc")?.textContent ?? "";
    expect(backToSearch).toContain("q=%E4%BA%BA%E4%BA%8B");
    expect(backToSearch).not.toContain("space=sp_hr");
    expect((byTestid("kn8-global-input") as HTMLInputElement | null)?.value).toBe("人事");
    expect(byTestid("knw5-spaces")?.getAttribute("data-len")).toBe("1");
    expect(container.querySelectorAll('[data-testid="knw5-spaces-row"]')).toHaveLength(1);
    expect(byTestid("kn9-count")?.textContent ?? "").toContain("当前已加载 2 项内命中 1 项");
    expect(byTestid("knB-crumb-search")?.textContent ?? "").toContain("检索「人事」");

    // 6) 面包屑两条真链：「知识」回不带关键词的列表，「检索」把关键词与命中态带回来
    await render("/knowledge?tab=spaces&space=sp_hr&q=%E4%BA%BA%E4%BA%8B");
    await click("knB-crumb-list");
    const viaListCrumb = byTestid("loc")?.textContent ?? "";
    expect(viaListCrumb).not.toContain("space=");
    expect(viaListCrumb).not.toContain("q=");
    expect(byTestid("knB-crumb-search")).toBeNull();

    await render("/knowledge?tab=spaces&space=sp_hr&q=%E4%BA%BA%E4%BA%8B");
    await click("knB-crumb-search");
    const viaSearchCrumb = byTestid("loc")?.textContent ?? "";
    expect(viaSearchCrumb).toContain("q=%E4%BA%BA%E4%BA%8B");
    expect(viaSearchCrumb).not.toContain("space=");
    expect((byTestid("kn8-global-input") as HTMLInputElement | null)?.value).toBe("人事");
    expect(container.querySelectorAll('[data-testid="knw5-spaces-row"]')).toHaveLength(1);
    expect(byTestid("kn9-count")?.textContent ?? "").toContain("当前已加载 2 项内命中 1 项");

    // 7) 空间名读不到时用短码，原始标识与原因在 title
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return fail(404, "这个数据接口还没有接入。", "rid-name-gone");
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=")) return Promise.resolve(DOC_LIST);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-x");
    });
    fetchMock.mockClear();
    await render("/knowledge?tab=spaces&space=sp_01M7ABCDEF0123456789");
    const codeCrumb = byTestid("knB-crumb-space");
    expect(codeCrumb?.textContent ?? "").toContain(`空间 · ${shortId("sp_01M7ABCDEF0123456789")}`);
    expect(codeCrumb?.textContent ?? "").not.toContain("sp_01M7ABCDEF0123456789");
    expect(codeCrumb?.getAttribute("title") ?? "").toContain("sp_01M7ABCDEF0123456789");
    expect(codeCrumb?.getAttribute("title") ?? "").toContain("空间名没读到");
    // 名字只靠一次空间读口：不为每一行文档再问一遍
    expect(fetchMock.mock.calls.filter((c: unknown[]) => String(c[0]) === SPACES)).toHaveLength(1);
    // 四态没退化：未接入正文仍在，带可复制 rid 与重试
    expect(byTestid("kn3-docs")).toBeTruthy();
    expect(byTestid("knB-crumb-list")?.tagName).toBe("A");
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

  it("pages the space document list by cursor (knE-*): honest total, condition reset, replay guard, 403≡404 retry", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const P1 = {
      asOf: "2026-11-19T07:00:00Z",
      nextCursor: "c2",
      documents: [
        { documentId: "d_a", fileName: "A 手册.pdf", sizeBytes: 100, updatedAt: "2026-11-19T03:00:00Z" },
        { documentId: "d_b", fileName: "B 表.xlsx", sizeBytes: 5000, updatedAt: "2026-11-19T09:00:00Z" },
      ],
    };
    const P2 = {
      asOf: "2026-11-19T07:00:00Z",
      nextCursor: null,
      documents: [{ documentId: "d_c", fileName: "C 说明.txt", sizeBytes: 2000, updatedAt: "2026-11-19T05:00:00Z" }],
    };
    const P1URL = docsUrlFor("sp_hr"); // 第一页与 documentsUrl 完全同串（无 cursor）
    const P2URL = `${P1URL}&cursor=c2`;
    const rowCount = () => container.querySelectorAll('[data-testid="kn3-docs-row"]').length;
    const countText = () => (byTestid("knE-page-count")?.textContent ?? "").replace(/\s+/g, " ");
    const moreBtn = () => byTestid("knE-page-more") as HTMLButtonElement | null;
    const cursorCalls = () => urlsCalled().filter((u: string) => u.includes("cursor=")).length;

    // ---------- A. 信封给了 total：共 N / 已显示 M，翻页后到末页 ----
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url === P1URL) return Promise.resolve({ ...P1, total: 3 });
      if (url === P2URL) return Promise.resolve({ ...P2, total: 3 });
      return fail(404, "这个数据接口还没有接入。", "rid-e-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(rowCount()).toBe(2);
    expect(countText()).toBe("共 3 篇 / 已显示 2 篇");
    expect(moreBtn()?.disabled).toBe(false);
    expect((moreBtn()?.textContent ?? "")).toContain("显示更多");
    expect(moreBtn()?.tagName).toBe("BUTTON");
    expect(byTestid("knE-page-end")).toBeNull();
    expect(cursorCalls()).toBe(0); // 第一页绝不带 cursor：还是那一次 documentsUrl 读取

    await click("knE-page-more");
    expect(urlsCalled().filter((u: string) => u === P2URL)).toHaveLength(1);
    expect(rowCount()).toBe(3);
    expect(countText()).toBe("共 3 篇 / 已显示 3 篇");
    // 无重复行：三行 id 各不相同
    const ids = [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].map((tr) => tr.getAttribute("title"));
    expect(new Set(ids).size).toBe(3);
    expect(moreBtn()?.disabled).toBe(true);
    expect((moreBtn()?.textContent ?? "")).toContain("已到末页");
    expect(byTestid("knE-page-end")).toBeTruthy();
    expect(attr("kn3-docs", "data-state")).toBe("ready");

    // ---------- B. 排序/筛选变化：列表与游标重置回第一页，0 新请求；再翻是新的 cursor 读取 ----
    const callsBeforeSort = fetchMock.mock.calls.length;
    await click("kn-sort-name");
    expect(fetchMock.mock.calls.length).toBe(callsBeforeSort); // 重置不重新问服务（R52 口径）
    expect(rowCount()).toBe(2);
    expect(countText()).toBe("共 3 篇 / 已显示 2 篇");
    expect(byTestid("knE-page-end")).toBeNull();
    expect((byTestid("loc")?.textContent ?? "")).toContain("sort=name");
    expect((byTestid("loc")?.textContent ?? "")).toContain("dir=asc");
    await click("knE-page-more");
    expect(cursorCalls()).toBe(2); // A 段一次 + 重置后再翻页一次
    expect(rowCount()).toBe(3);

    // 本地筛选同样重置累加页（筛前口径不变：M 仍是加载到的条数）
    await type("kn3-docs-filter-input", "A");
    expect(rowCount()).toBe(1);
    expect(countText()).toBe("共 3 篇 / 已显示 2 篇");
    await type("kn3-docs-filter-input", "");
    expect(rowCount()).toBe(2);

    // ---------- C. 无 total：总数不可用 + title，绝不用 M 推算 ----
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url === P1URL) return Promise.resolve(P1);
      if (url === P2URL) return Promise.resolve(P2);
      return fail(404, "这个数据接口还没有接入。", "rid-e-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(countText()).toBe("已显示 2 篇 · 总数不可用");
    expect((byTestid("knE-page-count")?.getAttribute("title") ?? "")).toContain("不按已加载条数推算");
    await click("knE-page-more");
    expect(countText()).toBe("已显示 3 篇 · 总数不可用"); // 加载到 3 也不冒充「共 3 篇」
    expect(countText()).not.toContain("共");

    // ---------- D. 信封没有 cursor 字段（今天线上读口的形状）：不谎称末页、不发 cursor 请求 ----
    const FLAT = { asOf: "2026-11-19T07:00:00Z", documents: P1.documents };
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url === P1URL) return Promise.resolve(FLAT);
      return fail(404, "这个数据接口还没有接入。", "rid-e-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect((moreBtn()?.textContent ?? "")).toContain("无分页游标");
    expect(moreBtn()?.disabled).toBe(true);
    expect(byTestid("knE-page-end")).toBeNull();
    expect(cursorCalls()).toBe(0);
    expect(rowCount()).toBe(2);

    // ---------- E. 坏 cursor 重放首页：不并回、停止、无重复行 ----
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url === P1URL) return Promise.resolve(P1);
      if (url === P2URL) return Promise.resolve(P1); // 上游对过期 cursor 静默返回首页
      return fail(404, "这个数据接口还没有接入。", "rid-e-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await click("knE-page-more");
    expect(cursorCalls()).toBe(1); // 确实问了一次，只是结果不并回
    expect(rowCount()).toBe(2); // 一行都没并进来
    expect(byTestid("knE-page-stale")).toBeTruthy();
    expect(moreBtn()?.disabled).toBe(true);
    expect((moreBtn()?.textContent ?? "")).toContain("游标已过期");
    expect(byTestid("knE-page-end")).toBeNull(); // 过期 ≠ 末页，不谎称到底

    // ---------- F. 下一页失败：403≡404 同体、可复制 rid、只重试这一页 ----
    const bodyOf = (node: Element | null) =>
      Array.from(node?.querySelectorAll("b, .knw5-wrap") ?? [])
        .map((part) => part.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ");
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url === P1URL) return Promise.resolve(P1);
      if (url === P2URL) return fail(403, "没有查看这项数据的权限。", "rid-more-denied");
      return fail(404, "这个数据接口还没有接入。", "rid-e-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await click("knE-page-more");
    const deniedErr = byTestid("knE-page-error");
    expect(deniedErr).toBeTruthy();
    expect(container.textContent ?? "").toContain("请求编号：rid-more-denied");
    expect(rowCount()).toBe(2); // 已显示的列表不受影响
    expect(byTestid("knE-page-retry")).toBeTruthy();

    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url === P1URL) return Promise.resolve(P1);
      if (url === P2URL) return fail(404, "这个数据接口还没有接入。", "rid-more-gone");
      return fail(404, "这个数据接口还没有接入。", "rid-e-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await click("knE-page-more");
    expect(bodyOf(byTestid("knE-page-error"))).toBe(bodyOf(deniedErr)); // 403 与 404 逐字同体

    // 重试成功：先失败进错误态，再只重发下一页这一个请求，首页与空间读口不连带
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url === P1URL) return Promise.resolve(P1);
      if (url === P2URL) return fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-more-busy");
      return fail(404, "这个数据接口还没有接入。", "rid-e-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await click("knE-page-more");
    expect(byTestid("knE-page-error")).toBeTruthy();
    const p1CallsBefore = urlsCalled().filter((u: string) => u === P1URL).length;
    // 换回答：不再渲染重来，只点「重试」
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url === P1URL) return Promise.resolve(P1);
      if (url === P2URL) return Promise.resolve(P2);
      return fail(404, "这个数据接口还没有接入。", "rid-e-x");
    });
    await click("knE-page-retry");
    expect(urlsCalled().filter((u: string) => u === P1URL).length).toBe(p1CallsBefore); // 不重发首页
    expect(urlsCalled().filter((u: string) => u === SPACES).length).toBe(1); // 不重发空间名
    expect(byTestid("knE-page-error")).toBeNull();
    expect(rowCount()).toBe(3);
    expect(countText()).toBe("已显示 3 篇 · 总数不可用");
  });

  it("copies the visible document list as on-screen text (knF-*): zero refetch, stale guard, empty disabled, fallback", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const DOCS = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 2457600, updatedAt: "2026-11-19T07:10:00Z" },
        { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 40960, updatedAt: "2026-11-19T05:30:00Z" },
        { documentId: "d_c" },
      ],
    };
    // 屏上口径：默认 updated/desc → A(15:10)·B(13:30)·缺值末位；缺值「—」，BJT 到分
    // R71：行体走单点 docLine——公共五列（含短码），knF 无「所属空间」列
    const EXPECTED_FULL =
      "文档名 | 类型 | 大小 | 更新 | 短码\n" +
      "A 手册.pdf | PDF | 2.3 MB | 2026-11-19 15:10 | DA\n" +
      "B 表.xlsx | 表格 | 40.0 KB | 2026-11-19 13:30 | DB\n" +
      "— | — | — | — | DC\n";
    const copyBtn = () => byTestid("knF-copy") as HTMLButtonElement | null;
    const statusText = () => (byTestid("knF-copy-status")?.textContent ?? "").trim();
    const stubClipboard = (writeText: ReturnType<typeof vi.fn>) =>
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    // ---------- 1. 成功复制：文本=屏上行，且 0 新请求 ----------
    fetchMock.mockClear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(DOCS);
      return fail(404, "这个数据接口还没有接入。", "rid-f-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    const urlsBefore = fetchMock.mock.calls.length;
    expect(copyBtn()?.disabled).toBe(false);
    expect((copyBtn()?.textContent ?? "")).toContain("复制清单");
    expect(copyBtn()?.tagName).toBe("BUTTON");
    expect(statusText()).toBe("");
    await click("knF-copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(EXPECTED_FULL); // 头行 + 3 条可见行，顺序=屏上排序
    expect(statusText()).toBe("已复制");
    expect(fetchMock.mock.calls.length).toBe(urlsBefore); // 纯屏上数据：urls() 前后计数不变
    expect(byTestid("knF-fallback")).toBeNull();

    // ---------- 2. 列表文本一变，旧「已复制」作废（不再冒充当前清单复制过） ----------
    // name/asc 与 updated/desc 在这份夹具里同序（文本没变，「已复制」仍属实）；再点成 name/desc 才真变了
    await click("kn-sort-name");
    await click("kn-sort-name"); // name/desc：B·A·—，与已复制的文本不同序
    expect(statusText()).toBe("");

    // ---------- 3. 筛选后复制的是筛后行 ----------
    const writeText2 = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText2);
    await type("kn3-docs-filter-input", "B 表");
    await click("knF-copy");
    expect(writeText2).toHaveBeenCalledTimes(1);
    expect(writeText2.mock.calls[0][0]).toBe("文档名 | 类型 | 大小 | 更新 | 短码\nB 表.xlsx | 表格 | 40.0 KB | 2026-11-19 13:30 | DB\n");
    expect(statusText()).toBe("已复制");
    expect(fetchMock.mock.calls.length).toBe(urlsBefore); // 筛选与复制都零新请求

    // ---------- 4. 筛到 0 行：disabled + title 原因，不伪造行 ----------
    await type("kn3-docs-filter-input", "查无此词");
    expect(copyBtn()?.disabled).toBe(true);
    expect((copyBtn()?.getAttribute("title") ?? "")).toContain("本地筛选没有留下行");
    expect((byTestid("knF-lines")?.textContent ?? "")).toBe("—"); // R62：不写 0 冒充空集
    await click("knF-copy"); // 守卫兜底：即便被触发也不写剪贴板
    expect(writeText2).toHaveBeenCalledTimes(1);

    // ---------- 5. 剪贴板拒绝：给只读 textarea，内容与屏上文本一致；再成功即收起 ----------
    await type("kn3-docs-filter-input", "");
    await click("kn-sort-updated"); // 回到 updated/desc：A·B·缺值末位，文本可按行断言
    const writeFail = vi.fn().mockRejectedValue(new Error("denied"));
    stubClipboard(writeFail);
    await click("knF-copy");
    expect(statusText()).toContain("复制失败");
    const fallback = byTestid("knF-fallback") as HTMLTextAreaElement | null;
    expect(fallback).toBeTruthy();
    expect(fallback?.readOnly).toBe(true);
    expect(fallback?.value).toBe(EXPECTED_FULL);
    const writeOk = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeOk);
    await click("knF-copy");
    expect(statusText()).toBe("已复制");
    expect(byTestid("knF-fallback")).toBeNull();

    // ---------- 6. 剪贴板不可用：同样进 fallback ----------
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await click("knF-copy");
    expect(statusText()).toContain("复制失败");
    expect(byTestid("knF-fallback")).toBeTruthy();

    // ---------- 7. 真空集：按钮 disabled + title，不编行（空集文案仍在） ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.includes("spaceId=sp_hr")) return Promise.resolve({ asOf: "2026-11-19T07:00:00Z", documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-f-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("kn3-docs-empty")).toBeTruthy();
    expect(byTestid("knF-row")).toBeTruthy();
    expect(copyBtn()?.disabled).toBe(true);
    expect((copyBtn()?.getAttribute("title") ?? "")).toContain("这份列表是空的");
    expect((byTestid("knF-lines")?.textContent ?? "")).toBe("—"); // R62：真空集也不写 0
  });

  it("copies the global document-name search hits as on-screen text (knG-*): hit order, zero refetch, empty guard, fallback", async () => {
    const LIST = {
      asOf: "2026-11-19T08:00:00Z",
      documents: [
        { documentId: "d_manual", fileName: "员工手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z", url: "/documents/d_manual", spaceId: "sp_hr", spaceName: "人事制度空间" },
        { documentId: "d_pay", title: "薪酬口径表.xlsx", docType: "xlsx", sizeBytes: 40960, lastSyncAt: "2026-11-19T05:30:00Z", spaceId: "sp_fin" },
        { documentId: "d_bare" },
      ],
    };
    // R71：knG 行体 = docLine 五列 + 固定的第 2 列「所属空间」
    const EXPECTED_ALL =
      "文档名 | 所属空间 | 类型 | 大小 | 更新 | 短码\n" +
      "员工手册.pdf | 人事制度空间 | PDF | 2.4 MB | 2026-11-19 15:10 | DMANUAL\n" +
      "薪酬口径表.xlsx | 空间 · SPFIN | 表格 | 40.0 KB | 2026-11-19 13:30 | DPAY\n" +
      "— | — | — | — | — | DBARE\n";
    const EXPECTED_HUMAN =
      "文档名 | 所属空间 | 类型 | 大小 | 更新 | 短码\n" +
      "员工手册.pdf | 人事制度空间 | PDF | 2.4 MB | 2026-11-19 15:10 | DMANUAL\n";
    const gBtn = () => byTestid("knG-copy") as HTMLButtonElement | null;
    const gStatus = () => (byTestid("knG-copy-status")?.textContent ?? "").trim();
    const stubClipboard = (writeText: ReturnType<typeof vi.fn>) =>
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    // ---------- 1. 成功复制：命中顺序全文逐字；urls() 前后计数不变 ----------
    fetchMock.mockClear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    fetchMock.mockImplementation((url: string) => {
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-g-x");
    });
    await render("/knowledge?tab=spaces");
    expect(attr("kn6-search", "data-state")).toBe("ready");
    const urlsBefore = fetchMock.mock.calls.length;
    expect(gBtn()?.disabled).toBe(false);
    expect(gBtn()?.tagName).toBe("BUTTON");
    expect(gStatus()).toBe("");
    await click("knG-copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(EXPECTED_ALL); // 头行 + 3 条命中，顺序=屏上命中顺序
    expect(gStatus()).toBe("已复制 3 条");
    expect(fetchMock.mock.calls.length).toBe(urlsBefore); // 纯屏上数据：零新请求
    expect(byTestid("knG-copy-fallback")).toBeNull();

    // ---------- 2. 检索词一变，旧「已复制 N 条」立即作废；复制的是筛后行 ----------
    const writeText2 = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText2);
    await type("kn6-search-input", "员工");
    expect(gStatus()).toBe(""); // 内容签名不再相合
    await click("knG-copy");
    expect(writeText2.mock.calls[0][0]).toBe(EXPECTED_HUMAN);
    expect(gStatus()).toBe("已复制 1 条");
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // ---------- 3. 提交关键词只进 URL，不重发文档读取 ----------
    await submitForm("kn6-search-form");
    expect((byTestid("loc")?.textContent ?? "")).toContain("q=%E5%91%98%E5%B7%A5");
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // ---------- 4. 0 命中：disabled + 指定 title，不伪造行、不写剪贴板 ----------
    await type("kn6-search-input", "查无此词");
    expect(gBtn()?.disabled).toBe(true);
    expect(gBtn()?.getAttribute("title")).toBe("当前没有可复制的结果");
    expect((byTestid("knG-lines")?.textContent ?? "")).toBe("—"); // R62：不写 0 冒充空集
    await click("knG-copy");
    expect(writeText2).toHaveBeenCalledTimes(1); // 守卫兜底
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // ---------- 5. 剪贴板拒绝 → 只读 textarea（内容同文本）；再成功即收起；不可用同路 ----------
    await type("kn6-search-input", "员工");
    const writeFail = vi.fn().mockRejectedValue(new Error("denied"));
    stubClipboard(writeFail);
    await click("knG-copy");
    expect(gStatus()).toContain("复制失败");
    const fallback = byTestid("knG-copy-fallback") as HTMLTextAreaElement | null;
    expect(fallback).toBeTruthy();
    expect(fallback?.readOnly).toBe(true);
    expect(fallback?.value).toBe(EXPECTED_HUMAN);
    const writeOk = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeOk);
    await click("knG-copy");
    expect(gStatus()).toBe("已复制 1 条");
    expect(byTestid("knG-copy-fallback")).toBeNull();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await click("knG-copy");
    expect(gStatus()).toContain("复制失败");
    expect(byTestid("knG-copy-fallback")).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // ---------- 6. 真空集（200 但 0 条）：控件出现但 disabled，空态文案仍在 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-g-x");
    });
    await render("/knowledge?tab=spaces");
    expect(byTestid("kn6-search-empty")).toBeTruthy();
    expect(byTestid("knG-row")).toBeTruthy();
    expect(gBtn()?.disabled).toBe(true);
    expect(gBtn()?.getAttribute("title")).toBe("当前没有可复制的结果");
  });

  it("copies the spaces list as on-screen text (knI-*): scope line, hit order, zero refetch, empty guard, fallback", async () => {
    const SPACE_LIST = {
      asOf: "2026-11-19T08:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", docCount: 12, lastSyncAt: "2026-11-19T06:20:00Z", status: "synced" },
        { spaceId: "sp_fin", name: "财务口径空间", updatedAt: "2026-11-18T20:30:00Z", status: "ready" },
        { name: "无标识空间" },
      ],
    };
    const EXPECTED_ALL =
      "当前已加载 3 个空间；本清单只覆盖这份回答，不冒充全库。\n" +
      "空间名 | 文档数 | 最近更新 | 短码\n" +
      "人事制度空间 | 12 篇 | 最近同步：2026-11-19 14:20 | SPHR\n" +
      "财务口径空间 | — | 最近更新：2026-11-19 04:30 | SPFIN\n" +
      "无标识空间 | — | — | —\n";
    const EXPECTED_FILTERED =
      "当前已加载 3 个空间；本清单只覆盖这份回答，不冒充全库。\n" +
      "以下为检索词「财务」筛后的可见行。\n" +
      "空间名 | 文档数 | 最近更新 | 短码\n" +
      "财务口径空间 | — | 最近更新：2026-11-19 04:30 | SPFIN\n";
    const iBtn = () => byTestid("knI-copy") as HTMLButtonElement | null;
    const iStatus = () => (byTestid("knI-copy-status")?.textContent ?? "").trim();
    const stubClipboard = (writeText: ReturnType<typeof vi.fn>) =>
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    // ---------- 1. 成功复制：口径行 + 头行 + 可见行全文逐字；urls() 前后计数不变 ----------
    fetchMock.mockClear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE_LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-i-x");
    });
    await render("/knowledge?tab=spaces");
    expect(attr("knw5-spaces", "data-state")).toBe("ready");
    const urlsBefore = fetchMock.mock.calls.length;
    expect(iBtn()?.disabled).toBe(false);
    expect(iBtn()?.tagName).toBe("BUTTON");
    expect(iStatus()).toBe("");
    await click("knI-copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(EXPECTED_ALL); // 首行明写「已加载 3 个空间…不冒充全库」
    expect(iStatus()).toBe("已复制 3 行");
    expect(fetchMock.mock.calls.length).toBe(urlsBefore); // 纯屏上数据：零新请求
    expect(byTestid("knI-copy-fallback")).toBeNull();
    // 裸 sp_ 不进文本：全 id 只在行 title 里
    expect(String(writeText.mock.calls[0][0])).not.toContain("sp_");
    expect(container.querySelector('[data-testid="knw5-spaces-row"]')?.getAttribute("title")).toBe("sp_hr");

    // ---------- 2. 检索词一变：旧「已复制 N 行」作废；复制的是筛后行 + 筛后口径 ----------
    const writeText2 = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText2);
    await type("kn8-global-input", "财务");
    expect(iStatus()).toBe("");
    await click("knI-copy");
    expect(writeText2.mock.calls[0][0]).toBe(EXPECTED_FILTERED);
    expect(iStatus()).toBe("已复制 1 行");
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // ---------- 3. 提交关键词只进 URL，不重发空间读口 ----------
    await submitForm("kn8-global-form");
    expect((byTestid("loc")?.textContent ?? "")).toContain("q=%E8%B4%A2%E5%8A%A1");
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // ---------- 4. 筛到 0 行：disabled + 逐字 title，不伪造行、不写剪贴板 ----------
    await type("kn8-global-input", "查无此空间");
    expect(iBtn()?.disabled).toBe(true);
    expect(iBtn()?.getAttribute("title")).toBe("当前没有可复制的空间");
    expect((byTestid("knI-lines")?.textContent ?? "")).toBe("—"); // R62：不写 0 冒充空集
    await click("knI-copy");
    expect(writeText2).toHaveBeenCalledTimes(1);

    // ---------- 5. 剪贴板拒绝 → 只读 textarea（内容同文本）；再成功即收起；不可用同路 ----------
    await type("kn8-global-input", "财务");
    const writeFail = vi.fn().mockRejectedValue(new Error("denied"));
    stubClipboard(writeFail);
    await click("knI-copy");
    expect(iStatus()).toContain("复制失败");
    const fallback = byTestid("knI-copy-fallback") as HTMLTextAreaElement | null;
    expect(fallback).toBeTruthy();
    expect(fallback?.readOnly).toBe(true);
    expect(fallback?.value).toBe(EXPECTED_FILTERED);
    const writeOk = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeOk);
    await click("knI-copy");
    expect(iStatus()).toBe("已复制 1 行");
    expect(byTestid("knI-copy-fallback")).toBeNull();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await click("knI-copy");
    expect(iStatus()).toContain("复制失败");
    expect(byTestid("knI-copy-fallback")).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // ---------- 6. 真空集（200+空 items）：控件出现但 disabled，空态文案仍在 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-i-x");
    });
    await render("/knowledge?tab=spaces");
    expect(byTestid("knw5-spaces-empty")).toBeTruthy();
    expect(byTestid("knI-row")).toBeTruthy();
    expect(iBtn()?.disabled).toBe(true);
    expect(iBtn()?.getAttribute("title")).toBe("当前没有可复制的空间");
  });

  it("roves tabindex through space cards and the space document rows: arrows/Home/End, Esc back to the box, aria-current sync, no hijack when empty", async () => {
    const SPACE_LIST = {
      asOf: "2026-11-19T07:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", docCount: 3, status: "synced" },
        { spaceId: "sp_fin", name: "财务口径空间", docCount: 1, status: "ready" },
        { spaceId: "sp_ops", name: "运维手册空间", docCount: 2, status: "synced" },
      ],
    };
    const DOC_LIST = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d1", fileName: "员工手册.pdf", updatedAt: "2026-11-19T07:00:00Z" },
        { documentId: "d2", fileName: "员工考勤补充说明", updatedAt: "2026-11-19T06:00:00Z" },
        { documentId: "d3", fileName: "定薪表.xlsx", updatedAt: "2026-11-19T05:00:00Z" },
      ],
    };
    const key = (node: Element | null, code: string): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key: code, bubbles: true, cancelable: true });
      void node?.dispatchEvent(event);
      return event;
    };

    // ---------- A. 空间详情文档列表 ----------
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE_LIST);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(DOC_LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-k-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    const urlsBefore = fetchMock.mock.calls.length;
    const docs = () => [...container.querySelectorAll('a[data-testid="kn3-docs-name"]')] as HTMLAnchorElement[];
    const filterInput = byTestid("kn3-docs-filter-input") as HTMLInputElement;
    const docScope = () => container.querySelector('[data-roving="kn3"]');

    // 未进 roving：无显式 tabindex（原生 DOM 序），行是真 a[href]——Enter 由浏览器原生打开
    expect(docs().map((x) => x.getAttribute("tabindex"))).toEqual([null, null, null]);
    expect(docs()[0]?.getAttribute("href")).toContain("doc=d1");

    // 筛选框 ArrowDown 进第一行；进入后同时只有一个 0，其余 -1，无正数
    let ev = key(filterInput, "ArrowDown");
    await act(async () => {});
    expect(document.activeElement).toBe(docs()[0]);
    expect(docs().map((x) => x.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(docs().every((x) => !["1", "2", "3"].includes(x.getAttribute("tabindex") ?? ""))).toBe(true);
    // aria-current 与实际焦点同步
    expect(docs()[0]?.getAttribute("aria-current")).toBe("true");
    expect(docs()[1]?.hasAttribute("aria-current")).toBe(false);

    // ↓ → End → Home → ↑ 都在行间走，aria-current 跟着焦点
    key(filterInput, "ArrowDown");
    await act(async () => {});
    expect(document.activeElement).toBe(docs()[1]);
    ev = key(docScope(), "End");
    await act(async () => {});
    expect(document.activeElement).toBe(docs()[2]);
    expect(docs()[2]?.getAttribute("aria-current")).toBe("true");
    expect(docs()[0]?.hasAttribute("aria-current")).toBe(false);
    expect(ev.defaultPrevented).toBe(true); // 有行时确实接管
    key(docScope(), "Home");
    await act(async () => {});
    expect(document.activeElement).toBe(docs()[0]);
    key(docScope(), "ArrowUp");
    await act(async () => {});
    expect(document.activeElement).toBe(docs()[0]); // 首行不越界

    // Esc 回筛选框：tabindex 全数退回原生，aria-current 清干净
    ev = key(docScope(), "Escape");
    await act(async () => {});
    expect(document.activeElement).toBe(filterInput);
    expect(docs().map((x) => x.getAttribute("tabindex"))).toEqual([null, null, null]);
    expect(docs().every((x) => !x.hasAttribute("aria-current"))).toBe(true);

    // 全程零额外请求
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // 筛空后不劫持：方向键 defaultPrevented=false、焦点不动、原生滚动照旧
    await type("kn3-docs-filter-input", "查无此词");
    expect(byTestid("kn3-docs-empty")).toBeTruthy();
    ev = key(filterInput, "ArrowDown");
    await act(async () => {});
    expect(ev.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(filterInput);
    expect(fetchMock.mock.calls.length).toBe(urlsBefore);

    // 读口 404：没有表、没有 roving scope，也不劫持
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE_LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-k-gone");
    });
    await render("/knowledge?tab=spaces&space=sp_missing");
    const afterGone = fetchMock.mock.calls.length;
    const goneInput = byTestid("kn3-docs-filter-input") as HTMLInputElement;
    await act(async () => {
      goneInput.focus();
    });
    ev = key(goneInput, "ArrowDown");
    await act(async () => {});
    expect(ev.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(goneInput);
    expect(container.querySelector('[data-roving="kn3"]')).toBeNull();
    expect(byTestid("knD-state-unavailable")).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(afterGone);

    // ---------- B. 空间卡片的 aria-current 同步（roving 本就在，补同步断言） ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE_LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-k-x");
    });
    await render("/knowledge?tab=spaces");
    const urlsSpaces = fetchMock.mock.calls.length;
    const spaceLinks = () => [...container.querySelectorAll('a[data-testid="kn-space-open"]')] as HTMLAnchorElement[];
    const box = byTestid("kn8-global-input") as HTMLInputElement;
    key(box, "ArrowDown");
    await act(async () => {});
    expect(document.activeElement).toBe(spaceLinks()[0]);
    expect(spaceLinks().map((x) => x.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(spaceLinks()[0]?.getAttribute("aria-current")).toBe("true");
    key(box, "ArrowDown");
    await act(async () => {});
    expect(spaceLinks()[1]?.getAttribute("aria-current")).toBe("true");
    expect(spaceLinks()[0]?.hasAttribute("aria-current")).toBe(false);
    key(byTestid("kn9-space-list") as Element, "End");
    await act(async () => {});
    expect(spaceLinks()[2]?.getAttribute("aria-current")).toBe("true");
    key(byTestid("kn9-space-list") as Element, "Escape");
    await act(async () => {});
    expect(document.activeElement).toBe(box);
    expect(spaceLinks().every((x) => !x.hasAttribute("aria-current"))).toBe(true);
    expect(fetchMock.mock.calls.length).toBe(urlsSpaces);
  });

  it("keeps the document preview drawer modal-complete: focus in on open, closed Tab ring, Esc/scrim return focus, reads unchanged", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const LIST = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d1", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 100, updatedAt: "2026-11-19T07:00:00Z", url: "/documents/d1" },
        { documentId: "d2", fileName: "考勤说明.txt", mimeType: "txt", sizeBytes: 200, updatedAt: "2026-11-19T06:00:00Z" },
      ],
    };
    const DETAIL = "/agent-api/api/documents/d1";
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(LIST);
      if (url === DETAIL) return Promise.resolve({ sourceName: "员工手册原件.pdf", status: "indexed" });
      return fail(404, "这个数据接口还没有接入。", "rid-d-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");

    const rowLink = () => [...container.querySelectorAll('a[data-testid="kn3-docs-name"]')][0] as HTMLAnchorElement;
    const kd = (shift: boolean): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true, shiftKey: shift });
      document.dispatchEvent(event);
      return event;
    };

    // ---------- 打开：焦点进入抽屉第一个可聚焦元素；三件套齐 ----------
    await click("kn3-docs-name");
    await act(async () => {}); // 详情读口落定（打开即读一次，R49 设计）
    const panel = byDocTestid("kn7-preview-panel") as HTMLElement;
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.getAttribute("aria-labelledby")).toBe("kn7-preview-title");
    expect(byDocTestid("kn7-preview-title")?.textContent).toContain("员工手册.pdf");
    const nodes = Array.from(
      panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'),
    );
    expect(nodes.length).toBeGreaterThan(1);
    expect(document.activeElement).toBe(byDocTestid("kn7-preview-close"));
    expect(nodes.indexOf(document.activeElement as HTMLElement)).toBe(0); // 关钮就是第一个可聚焦元素
    expect(nodes.some((x) => x.getAttribute("tabindex") === "1")).toBe(false); // 无正数 tabindex

    const urlsOpen = fetchMock.mock.calls.length; // 打开后的基线：此后键盘与关闭流程必须 0 增量

    // ---------- Tab 环：末→首、首→末双向环绕，都扣住事件 ----------
    nodes[nodes.length - 1].focus();
    expect(kd(false).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(nodes[0]);
    expect(kd(true).defaultPrevented).toBe(true); // 在首个上 Shift+Tab → 拉回末位
    expect(document.activeElement).toBe(nodes[nodes.length - 1]);

    // ---------- 焦点漏到面板外：Tab 把它拉回来，不让模态被穿出 ----------
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    expect(kd(false).defaultPrevented).toBe(true);
    expect(panel.contains(document.activeElement as Node)).toBe(true);
    expect(fetchMock.mock.calls.length).toBe(urlsOpen); // 全程 0 请求

    // ---------- Esc：关闭、焦点还给触发行、URL 去掉 ?doc=、0 新请求 ----------
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    await act(async () => {
      document.dispatchEvent(esc);
    });
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeNull();
    expect(document.activeElement).toBe(rowLink());
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("doc=");
    expect(fetchMock.mock.calls.length).toBe(urlsOpen);

    // ---------- 遮罩点关：同一出口——焦点同样回到触发行、URL 清、0 新请求 ----------
    await act(async () => {
      rowLink().focus();
    });
    await click("kn3-docs-name");
    await act(async () => {}); // 再次打开：设计内再读一次详情（计数 +1，属 R49 既有读口）
    expect(fetchMock.mock.calls.filter((u: string[]) => String(u[0]) === DETAIL)).toHaveLength(2);
    const urlsSecond = fetchMock.mock.calls.length;
    const backdrop = byDocTestid("kn7-preview-backdrop") as HTMLElement;
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(urlsSecond); // 关闭流程 0 增量
    expect(document.activeElement).toBe(rowLink()); // 遮罩不丢焦点
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("doc=");
  });

  it("copies the drawer's on-screen metadata (knL-*): exact lines, zero reads, unmount, focus back both close paths, fallback", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const LIST = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d1", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z", spaceId: "sp_hr", spaceName: "人事制度空间" },
        { documentId: "d2", fileName: "薪酬表.xlsx", docType: "xlsx", sizeBytes: 40960, updatedAt: "2026-11-19T05:30:00Z", spaceId: "sp_fin" },
      ],
    };
    const EXPECTED_D1 =
      "文档名：员工手册.pdf\n所属空间：人事制度空间\n类型：PDF\n大小：2.0 KB\n更新：2026-11-19 15:00\n文档短码：D1\n";
    const EXPECTED_D2 =
      "文档名：薪酬表.xlsx\n所属空间：空间 · SPFIN\n类型：表格\n大小：40.0 KB\n更新：2026-11-19 13:30\n文档短码：D2\n";
    fetchMock.mockClear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(LIST);
      if (url === "/agent-api/api/documents/d1" || url === "/agent-api/api/documents/d2")
        return Promise.resolve({ sourceName: "原件", status: "indexed" });
      return fail(404, "这个数据接口还没有接入。", "rid-l-x");
    });
    // 刷新直开抽屉（?doc=d1 复现路径）
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d1");
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    const urlsSettled = fetchMock.mock.calls.length;

    const lBtn = () => byDocTestid("knL-copy-meta") as HTMLButtonElement | null;
    expect(lBtn()?.tagName).toBe("BUTTON");
    expect((byDocTestid("knL-copy-meta-status")?.getAttribute("aria-live") ?? "")).toBe("polite");
    await click("knL-copy-meta");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(EXPECTED_D1);
    expect((byDocTestid("knL-copy-meta-status")?.textContent ?? "").trim()).toBe("已复制");
    expect(fetchMock.mock.calls.length).toBe(urlsSettled); // 复制流程 0 新请求

    // Esc 关闭：按钮随抽屉卸载；焦点回触发行（读数取 activeElement 的 testid）
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    expect(byDocTestid("knL-copy-meta")).toBeNull();
    expect(document.activeElement?.getAttribute("data-testid")).toBe("kn3-docs-name");

    // 遮罩关闭：同样卸载 + 焦点回触发行
    await clickNth("kn3-docs-name", 1); // 打开 d2
    await act(async () => {});
    const urlsD2 = fetchMock.mock.calls.length;
    expect(byDocTestid("knL-row")).toBeTruthy();
    await act(async () => {
      (byDocTestid("kn7-preview-backdrop") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(byDocTestid("knL-copy-meta")).toBeNull();
    expect(document.activeElement?.getAttribute("data-testid")).toBe("kn3-docs-name");
    // 打开 d2 只有既有的详情一读（+1），复制前基线稳定
    expect(urlsD2).toBe(urlsSettled + 1);

    // 剪贴板拒绝 / 不可用：只读 textarea，内容逐字同；仍在模态 Tab 环内
    await clickNth("kn3-docs-name", 1);
    await act(async () => {});
    const writeFail = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText: writeFail }, configurable: true });
    await click("knL-copy-meta");
    expect((byDocTestid("knL-copy-meta-status")?.textContent ?? "")).toContain("复制失败");
    const fallback = byDocTestid("knL-copy-meta-fallback") as HTMLTextAreaElement | null;
    expect(fallback).toBeTruthy();
    expect(fallback?.readOnly).toBe(true);
    expect(fallback?.value).toBe(EXPECTED_D2);
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await click("knL-copy-meta");
    expect(byDocTestid("knL-copy-meta-fallback")).toBeTruthy();
    const ring = (byDocTestid("kn7-preview-panel") as HTMLElement).querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(Array.from(ring).includes(fallback as HTMLElement)).toBe(true); // 失败态焦点不外穿
    expect(fetchMock.mock.calls.length).toBe(urlsD2 + 1); // 本次打开的详情一读，此外 0 增量

    // URL 复现但行不在已加载列表（R62 收口）：元信息没读到 → 按钮 disabled，不给一串「—」冒充内容
    await render("/knowledge?tab=spaces&space=sp_hr&doc=zz9");
    await act(async () => {});
    const writeGhost = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: writeGhost }, configurable: true });
    expect((byDocTestid("knL-copy-meta") as HTMLButtonElement).disabled).toBe(true);
    expect((byDocTestid("knL-copy-meta")?.getAttribute("title") ?? "")).toContain("不在已加载的列表里");
    const urlsGhost = fetchMock.mock.calls.length;
    await click("knL-copy-meta");
    expect(writeGhost).toHaveBeenCalledTimes(0); // 守卫：disabled 且被触发也不写剪贴板
    expect(fetchMock.mock.calls.length).toBe(urlsGhost); // 点击前后 0 新请求
  });

  it("unifies the four states across the three list faces (knN-state-*): loading, real-empty vs no-match, rid probes, denied keeps context", async () => {
    const state = (id: string) => attr(`knN-state-${id}`, "data-knn-state");

    // ---------- A. loading：骨架在、复制条已在（disabled+原因+「—」），落定后同一条不重新出现——不跳 ----------
    let releaseSpaces: (value: unknown) => void = () => {};
    let releaseSearch: (value: unknown) => void = () => {};
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return new Promise((resolve) => { releaseSpaces = resolve; });
      if (url === DOCUMENTS_PLAIN) return new Promise((resolve) => { releaseSearch = resolve; });
      return fail(404, "这个数据接口还没有接入。", "rid-n-x");
    });
    await render("/knowledge?tab=spaces");
    expect(state("spaces")).toBe("loading");
    expect(state("doc-search")).toBe("loading");
    expect(byTestid("knw5-spaces-loading")).toBeTruthy();
    expect(byTestid("kn6-search-loading")).toBeTruthy();
    expect(byTestid("knI-row")).toBeTruthy();
    expect(byTestid("knG-row")).toBeTruthy();
    expect((byTestid("knI-copy") as HTMLButtonElement).disabled).toBe(true);
    expect((byTestid("knI-copy")?.getAttribute("title") ?? "")).toContain("还在读取");
    expect((byTestid("knI-lines")?.textContent ?? "")).toBe("—");
    expect((byTestid("knG-lines")?.textContent ?? "")).toBe("—");
    const rowNode = byTestid("knI-row");
    releaseSpaces({
      asOf: "2026-11-19T08:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" },
        { spaceId: "sp_ops", name: "运维手册空间", docCount: 1, status: "synced" },
      ],
    });
    releaseSearch({ asOf: "2026-11-19T08:00:00Z", documents: [{ documentId: "d1", fileName: "员工手册.pdf", spaceId: "sp_hr" }] });
    await act(async () => {});
    expect(byTestid("knI-row")).toBe(rowNode); // 同一个节点跨 loading→ready：条不消失不重挂
    expect(state("spaces")).toBe("ready");
    expect(state("doc-search")).toBe("ready");
    expect((byTestid("knI-lines")?.textContent ?? "")).toBe("2 行");

    // ---------- B. spaces：真 0 与筛空两种 empty，文案与出口都分开 ----------
    const realEmpty = { asOf: "2026-11-19T08:00:00Z", items: [] };
    const loaded = {
      asOf: "2026-11-19T08:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" },
        { spaceId: "sp_ops", name: "运维手册空间", docCount: 1, status: "synced" },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(realEmpty);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(realEmpty);
      return fail(404, "这个数据接口还没有接入。", "rid-n-x");
    });
    await render("/knowledge?tab=spaces");
    expect(state("spaces")).toBe("empty");
    expect(attr("knN-empty-text-spaces", "data-knn-empty")).toBe("empty");
    expect((byTestid("knN-empty-text-spaces")?.textContent ?? "")).toContain("这不等于");
    expect(byTestid("kn8-global-empty-clear")).toBeNull(); // 真 0 没有「清空」出口（没东西可清）
    expect((byTestid("knI-copy") as HTMLButtonElement).disabled).toBe(true);
    expect((byTestid("knI-copy")?.getAttribute("title") ?? "")).toBe("当前没有可复制的空间");

    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(loaded);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(realEmpty);
      return fail(404, "这个数据接口还没有接入。", "rid-n-x");
    });
    await render("/knowledge?tab=spaces");
    await type("kn8-global-input", "查无此空间");
    expect(state("spaces")).toBe("no-match");
    expect(attr("knN-empty-text-spaces", "data-knn-empty")).toBe("no-match");
    expect(byTestid("kn8-global-empty-clear")).toBeTruthy(); // 筛空带清空出口
    await click("kn8-global-empty-clear");
    expect(state("spaces")).toBe("ready");

    // ---------- C. 错误族探针：404→unavailable、403→denied、500→error；rid/retry 探针齐 ----------
    const probe404 = async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url === SPACES) return Promise.resolve(loaded);
        return fail(404, "这个数据接口还没有接入。", "rid-n-404");
      });
      await render("/knowledge?tab=spaces");
      expect(state("doc-search")).toBe("unavailable");
      expect(attr("knN-error-doc-search", "data-knn-kind")).toBe("unwired");
      expect(attr("knN-rid-doc-search", "data-knn-rid")).toBe("rid-n-404");
      expect(byTestid("knN-retry-doc-search")).toBeTruthy();
      expect((byTestid("knG-copy") as HTMLButtonElement).disabled).toBe(true);
      expect((byTestid("knG-copy")?.getAttribute("title") ?? "")).toContain("读口未接入或没有权限");
      expect((byTestid("knG-lines")?.textContent ?? "")).toBe("—");
      return byTestid("kn6-search-unwired");
    };
    const goneNode = await probe404();
    const goneVisible = Array.from(goneNode?.querySelectorAll("b, .knw5-wrap") ?? [])
      .map((p) => p.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ");
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(loaded);
      return fail(403, "没有查看这项数据的权限。", "rid-n-403");
    });
    await render("/knowledge?tab=spaces");
    expect(state("doc-search")).toBe("denied");
    const deniedVisible = Array.from(byTestid("kn6-search-unwired")?.querySelectorAll("b, .knw5-wrap") ?? [])
      .map((p) => p.textContent ?? "")
      .join(" ")
      .replace(/\s+/g, " ");
    expect(deniedVisible).toBe(goneVisible); // 403≡404 同体（三面共用 Surface，一处即全路）
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(loaded);
      return fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-n-500");
    });
    await render("/knowledge?tab=spaces");
    expect(state("doc-search")).toBe("error");
    expect(attr("knN-error-doc-search", "data-knn-kind")).toBe("error");
    expect(attr("knN-rid-doc-search", "data-knn-rid")).toBe("rid-n-500");

    // ---------- D. denied 不丢上下文：?q= 与已加载的面都在；详情位 ?sort/?dir= 同理 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(loaded);
      if (url === DOCUMENTS_PLAIN) return fail(403, "没有查看这项数据的权限。", "rid-n-denied");
      return fail(404, "这个数据接口还没有接入。", "rid-n-x");
    });
    await render("/knowledge?tab=spaces&q=%E7%A9%BA%E9%97%B4"); // 关键词=「空间」，筛后两个空间都命中
    await act(async () => {});
    expect((byTestid("loc")?.textContent ?? "")).toContain("q=%E7%A9%BA%E9%97%B4"); // URL 保留
    expect((byTestid("kn8-global-input") as HTMLInputElement | null)?.value).toBe("空间"); // 输入保留
    expect(attr("knw5-spaces", "data-state")).toBe("ready"); // 别的面已加载状态不丢
    expect(container.querySelectorAll('[data-testid="knw5-spaces-row"]')).toHaveLength(2);

    // 详情面 404 时 sort/dir 与返回上下文原样在地址里；space-docs 探针 unavailable + 复制条 disabled
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(loaded);
      return fail(404, "这个数据接口还没有接入。", "rid-n-gone");
    });
    await render("/knowledge?tab=spaces&space=sp_hr&sort=name&dir=asc&q=%E5%91%98%E5%B7%A5");
    await act(async () => {});
    const locText = byTestid("loc")?.textContent ?? "";
    expect(locText).toContain("sort=name");
    expect(locText).toContain("dir=asc");
    expect(locText).toContain("q=%E5%91%98%E5%B7%A5");
    expect(state("space-docs")).toBe("unavailable");
    expect(attr("knN-rid-space-docs", "data-knn-rid")).toBe("rid-n-gone");
    expect((byTestid("knF-copy") as HTMLButtonElement).disabled).toBe(true);
    expect((byTestid("knF-lines")?.textContent ?? "")).toBe("—");
    expect(byTestid("kn3-docs-back")).toBeTruthy(); // 返回出口还在：上下文没被错误态拆掉

    // ---------- E. space-docs 筛空带清空出口 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(loaded);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr"))
        return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [{ documentId: "d1", fileName: "员工手册.pdf" }, { documentId: "d2", fileName: "考勤表.xlsx" }] });
      return fail(404, "这个数据接口还没有接入。", "rid-n-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await type("kn3-docs-filter-input", "查无此词");
    expect(state("space-docs")).toBe("no-match");
    expect(byTestid("kn3-docs-empty-clear")).toBeTruthy();
    await click("kn3-docs-empty-clear");
    expect(state("space-docs")).toBe("ready");
    expect((byTestid("kn3-docs-filter-input") as HTMLInputElement).value).toBe("");
  });

  it("keeps a shared source-and-freshness ledger (knM-source-*): collapsed by default, zero extra reads, six-alias asOf only", async () => {
    const { resetKnwSources } = await import("./sourceReads");
    resetKnwSources();
    const SPACES_BODY = {
      asOf: "2026-11-19T08:00:00Z",
      items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" }],
    };
    const SEARCH_NO_STAMP = {
      items: [{ documentId: "d1", fileName: "员工手册.pdf" }],
    };
    const docsPath = docsUrlFor("sp_hr");
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACES_BODY);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(SEARCH_NO_STAMP);
      return fail(404, "这个数据接口还没有接入。", "rid-knm-gone");
    });
    await render("/knowledge?tab=spaces");
    await act(async () => {});
    const urlsSettled = fetchMock.mock.calls.length;

    // 默认收起：台账在，表不在；展开态不进 URL
    expect(byTestid("knM-source-panel")).toBeTruthy();
    expect(byTestid("knM-source-table")).toBeNull();
    expect(attr("knM-source-toggle", "aria-expanded")).toBe("false");

    // 展开：零新请求
    await click("knM-source-toggle");
    expect(byTestid("knM-source-table")).toBeTruthy();
    expect(attr("knM-source-toggle", "aria-expanded")).toBe("true");
    expect(fetchMock.mock.calls.length).toBe(urlsSettled);
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("expand");

    // spaces 行：正常 + 顶层 ISO 换算北京时间（08:00Z → 16:00，只由 payload 推出，非本机时钟）；原文与别名只进 title
    expect(attr("knM-source-row-spaces", "data-knm-status")).toBe("ok");
    expect((byTestid("knM-source-asof-spaces")?.textContent ?? "")).toBe("2026-11-19 16:00");
    const spacesTitle = byTestid("knM-source-asof-spaces")?.getAttribute("title") ?? "";
    expect(spacesTitle).toContain("asOf 原文：2026-11-19T08:00:00Z");
    expect(spacesTitle).toContain("字段：asOf");
    expect((byTestid("knM-source-status-spaces")?.textContent ?? "").trim()).toBe("正常");
    expect((byTestid("knM-source-path-spaces")?.textContent ?? "")).toBe(SPACES);

    // doc-search 行：读到数据但没有顶层 ISO → 降级，「—」+六别名原因在 title（行内时间不算顶层事实）
    expect(attr("knM-source-row-doc-search", "data-knm-status")).toBe("degraded");
    expect((byTestid("knM-source-asof-doc-search")?.textContent ?? "")).toBe("—");
    expect((byTestid("knM-source-asof-doc-search")?.getAttribute("title") ?? "")).toContain("六个别名");
    expect((byTestid("knM-source-status-doc-search")?.textContent ?? "").trim()).toBe("降级");
    expect((byTestid("knM-source-reason-doc-search")?.textContent ?? "")).toContain("新鲜度只能降级标注");

    // space-docs 行：还没下钻 → 未读取
    expect(attr("knM-source-row-space-docs", "data-knm-status")).toBe("idle");
    expect((byTestid("knM-source-status-space-docs")?.textContent ?? "").trim()).toBe("未读取");

    // 下钻：台账仍展开（切面不丢）、路径换成实际读口、404 → 读口未接入 + 去处
    await click("kn-space-open");
    await act(async () => {});
    expect(byTestid("knM-source-table")).toBeTruthy();
    expect((byTestid("loc")?.textContent ?? "")).toContain("space=sp_hr");
    expect(attr("knM-source-row-space-docs", "data-knm-status")).toBe("unwired");
    expect((byTestid("knM-source-path-space-docs")?.textContent ?? "")).toBe(docsPath);
    const unwiredVisible =
      (byTestid("knM-source-status-space-docs")?.textContent ?? "").trim() +
      (byTestid("knM-source-reason-space-docs")?.textContent ?? "").trim();
    expect(unwiredVisible).toContain("读口未接入");
    expect(byTestid("knM-source-apply-space-docs")).toBeTruthy();
    // GAP 与 rid 只在 title，屏面不见
    const ledgerText = (byTestid("knM-source-panel")?.textContent ?? "").replace(/\s+/g, " ");
    expect(ledgerText).not.toContain("GAP");
    expect(ledgerText).not.toContain("rid-knm-gone");
    const unwiredTitle = byTestid("knM-source-status-space-docs")?.getAttribute("title") ?? "";
    expect(unwiredTitle).toContain("GAP-03");
    expect(unwiredTitle).toContain("请求编号 rid-knm-gone");

    // 退回列表：展开态仍在；收起再展开全程 0 新请求
    await click("kn3-docs-back");
    await act(async () => {});
    expect(byTestid("knM-source-table")).toBeTruthy();
    const urlsToggles = fetchMock.mock.calls.length;
    await click("knM-source-toggle");
    await click("knM-source-toggle");
    expect(fetchMock.mock.calls.length).toBe(urlsToggles);
    expect(byTestid("knM-source-table")).toBeTruthy();

    // 403≡404：同一可见说法（逐字）；六别名按序命中 generated_at → 正常上屏
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACES_BODY);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ generated_at: "2026-11-19T06:30:00Z", items: [] });
      return fail(403, "没有查看这项数据的权限。", "rid-knm-denied");
    });
    await render("/knowledge?tab=spaces&space=sp_hr"); // 新渲染默认回到收起（store 仍记着上次的展开态——展开态在模块不在 URL）
    await act(async () => {});
    if (byTestid("knM-source-table") === null) await click("knM-source-toggle");
    expect((byTestid("knM-source-status-space-docs")?.textContent ?? "").trim()).toBe("读口未接入");
    expect(
      (byTestid("knM-source-status-space-docs")?.textContent ?? "").trim() +
        (byTestid("knM-source-reason-space-docs")?.textContent ?? "").trim(),
    ).toBe(unwiredVisible);
    expect((byTestid("knM-source-asof-doc-search")?.textContent ?? "")).toBe("2026-11-19 14:30");
    expect((byTestid("knM-source-asof-doc-search")?.getAttribute("title") ?? "")).toContain("字段：generated_at");
    expect(attr("knM-source-row-doc-search", "data-knm-status")).toBe("ok");
    const urlsLast = fetchMock.mock.calls.length;
    await click("knM-source-toggle");
    expect(fetchMock.mock.calls.length).toBe(urlsLast); // 台账最后一次也不发请求

    resetKnwSources();
  });

  it("copies a working permalink from the drawer (knO-*): paste-and-refresh opens the same doc, no-id rows refuse, fallback honest", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const LIST = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d1", fileName: "员工手册.pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" },
        { fileName: "没有标识的草稿.txt", sizeBytes: 128, updatedAt: "2026-11-19T06:00:00Z" },
      ],
    };
    const stub = (writeText: ReturnType<typeof vi.fn>) =>
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-o-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d1");
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    const urlsOpen = fetchMock.mock.calls.length;

    // ---------- A. 可链接行：复制的是 origin + 现有深链参数（git grep 实证 tab/panel/space/doc） ----------
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub(writeText);
    await click("knO-permalink");
    expect(writeText).toHaveBeenCalledTimes(1);
    const pasted = String(writeText.mock.calls[0][0]);
    expect(pasted.startsWith(window.location.origin)).toBe(true);
    const params = new URLSearchParams(pasted.slice(window.location.origin.length).split("?")[1] ?? "");
    expect(params.get("space")).toBe("sp_hr");
    expect(params.get("doc")).toBe("d1");
    expect(pasted).toContain("tab=spaces");
    expect(pasted).toContain("panel=spaces");
    expect((byDocTestid("knO-permalink-status")?.textContent ?? "").trim()).toBe("链接已复制");
    const urlSpan = byDocTestid("knO-permalink-url") as HTMLElement;
    expect(urlSpan.getAttribute("title")).toContain("doc=d1"); // 全文在 title
    expect(fetchMock.mock.calls.length).toBe(urlsOpen); // 复制零新请求

    // ---------- B. 粘贴链接 + 刷新直达同一文档抽屉，标识同值 ----------
    await render(pasted.slice(window.location.origin.length));
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy(); // 深链直接开抽屉（缺口不存在：设计本就支持）
    expect((byTestid("loc")?.textContent ?? "")).toContain("doc=d1");
    expect(byDocTestid("kn3-docs-detail")?.getAttribute("title")).toBe("d1"); // 抽屉里的文档标识 = 参数值
    expect((byDocTestid("kn7-preview-title")?.textContent ?? "")).toContain("员工手册.pdf");

    // ---------- C. 无标识行：disabled + 逐字 title，不拿位置键冒充链接 ----------
    await render("/knowledge?tab=spaces&space=sp_hr");
    await clickNth("kn3-docs-name", 1); // 无 id 行：页面内部键是 row-1，位置不是标识
    await act(async () => {});
    const oBtn = byDocTestid("knO-permalink") as HTMLButtonElement;
    expect(oBtn.disabled).toBe(true);
    expect(oBtn.getAttribute("title")).toBe("该文档没有可用的固定标识");
    const writeGhost = vi.fn().mockResolvedValue(undefined);
    stub(writeGhost);
    await click("knO-permalink");
    expect(writeGhost).toHaveBeenCalledTimes(0); // 守卫：也不写任何东西
    expect((byDocTestid("knO-permalink-status")?.textContent ?? "").trim()).toBe("");

    // ---------- D. 拒绝/不可用：只读 textarea，内容逐字同绝对地址 ----------
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d1");
    await act(async () => {});
    const writeFail = vi.fn().mockRejectedValue(new Error("denied"));
    stub(writeFail);
    await click("knO-permalink");
    expect((byDocTestid("knO-permalink-status")?.textContent ?? "")).toContain("复制失败");
    const fallback = byDocTestid("knO-permalink-fallback") as HTMLTextAreaElement | null;
    expect(fallback).toBeTruthy();
    expect(fallback?.readOnly).toBe(true);
    expect(fallback?.value).toBe(pasted); // 与成功路径写入的绝对地址逐字一致（参数顺序同源）
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await click("knO-permalink");
    expect(byDocTestid("knO-permalink-fallback")).toBeTruthy();
    const writeOk = vi.fn().mockResolvedValue(undefined);
    stub(writeOk);
    await click("knO-permalink");
    expect((byDocTestid("knO-permalink-status")?.textContent ?? "").trim()).toBe("链接已复制");
    expect(byDocTestid("knO-permalink-fallback")).toBeNull();

    // 全程无额外请求：列表读=四次渲染 × 两个列表面（space 列表 + 全库搜索面）；d1 详情读=打开抽屉的 A/B/D 各一次。
    expect(fetchMock.mock.calls.filter((u: unknown[]) => String(u[0]).includes("/api/documents?"))).toHaveLength(8);
    expect(fetchMock.mock.calls.filter((u: unknown[]) => String(u[0]).endsWith("/api/documents/d1"))).toHaveLength(3);
  });

  it("couples copy notices to real usability (OBS-6 fix): disabled says 当前不可复制 with reason and never leaves a fallback anchor", async () => {
    const LOADED = {
      asOf: "2026-11-19T08:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" },
        { spaceId: "sp_ops", name: "运维手册空间", docCount: 1, status: "synced" },
      ],
    };
    const iStatus = () => (byTestid("knI-copy-status")?.textContent ?? "").trim();
    const gStatus = () => (byTestid("knG-copy-status")?.textContent ?? "").trim();

    // ---------- A. loading：改前状态句为逐字空串；改后一律「当前不可复制：<原因>」，兜底不渲染 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES || url === DOCUMENTS_PLAIN) return new Promise(() => {}); // 永挂：稳定停在 loading
      return fail(404, "这个数据接口还没有接入。", "rid-p-x");
    });
    await render("/knowledge?tab=spaces");
    expect(iStatus()).toBe("当前不可复制：列表还在读取");
    expect(gStatus()).toBe("当前不可复制：列表还在读取");
    expect(byTestid("knI-copy-fallback")).toBeNull();
    expect(byTestid("knG-copy-fallback")).toBeNull();

    // ---------- B. 读口未接入 / 无权限：同一句原因；title 旧口径不动 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(LOADED);
      return fail(404, "这个数据接口还没有接入。", "rid-p-gone");
    });
    await render("/knowledge?tab=spaces");
    expect(iStatus()).toBe(""); // spaces 面正常：没有可复制断言
    expect(gStatus()).toBe("当前不可复制：读口未接入或没有权限");
    expect((byTestid("knG-copy")?.getAttribute("title") ?? "")).toContain("没有可复制的结果");
    await act(async () => {});

    // ---------- C. 真空集与筛空：状态句分两种；ready-empty 的逐字 title 保持不动 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [] });
      return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [] });
    });
    await render("/knowledge?tab=spaces");
    expect(iStatus()).toBe("当前不可复制：这份回答里没有空间");
    expect((byTestid("knI-copy")?.getAttribute("title") ?? "")).toBe("当前没有可复制的空间");
    expect(gStatus()).toBe("当前不可复制：这份回答里没有文档");

    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(LOADED);
      return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [] });
    });
    await render("/knowledge?tab=spaces");
    await type("kn8-global-input", "查无此空间");
    expect(iStatus()).toBe("当前不可复制：筛选后没有留下的空间");

    // ---------- D. 正常路径零改动：能复制时成功句/失败句与兜底照旧成对 ----------
    const writeOk = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: writeOk }, configurable: true });
    await type("kn8-global-input", "");
    await click("knI-copy");
    expect(iStatus()).toBe("已复制 2 行");
    const writeFail = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText: writeFail }, configurable: true });
    await click("knI-copy");
    expect(iStatus()).toBe("复制失败，已展开可选文本，可手动复制");
    expect(byTestid("knI-copy-fallback")).toBeTruthy(); // 失败句与兜底锚必然同现

    // ---------- E. knF（详情面）：loading 与失败两种禁用句；筛空第三种 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] });
      if (url.includes("spaceId=sp_hr")) return new Promise(() => {}); // 永挂：详情文档面停在 loading
      return fail(404, "这个数据接口还没有接入。", "rid-p-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect((byTestid("knF-copy-status")?.textContent ?? "").trim()).toBe("当前不可复制：列表还在读取");
    expect(byTestid("knF-fallback")).toBeNull();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] });
      if (url.includes("spaceId=sp_hr")) return fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-p-500");
      return fail(404, "这个数据接口还没有接入。", "rid-p-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect((byTestid("knF-copy-status")?.textContent ?? "").trim()).toBe("当前不可复制：这次读取没有成功");
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] });
      if (url.includes("spaceId=sp_hr"))
        return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [{ documentId: "d1", fileName: "员工手册.pdf" }] });
      return fail(404, "这个数据接口还没有接入。", "rid-p-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await type("kn3-docs-filter-input", "查无此词");
    expect((byTestid("knF-copy-status")?.textContent ?? "").trim()).toBe("当前不可复制：筛选后没有留下的文档");

    // ---------- F. knL：ghost（行不在列表）状态句直说，兜底不渲染 ----------
    await render("/knowledge?tab=spaces&space=sp_hr&doc=zz9");
    await act(async () => {});
    expect((byDocTestid("knL-copy-meta-status")?.textContent ?? "").trim()).toBe("当前不可复制：这条文档不在已加载的列表里");
    expect(byDocTestid("knL-copy-meta-fallback")).toBeNull();

    // ---------- G. 空间行：title 声明抽屉范围；点空间行不打开抽屉（设计口径，非故障） ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(LOADED);
      return fail(404, "这个数据接口还没有接入。", "rid-p-x");
    });
    await render("/knowledge?tab=spaces");
    const spaceLinkNode = byTestid("kn-space-open") as HTMLAnchorElement;
    expect(spaceLinkNode.getAttribute("title")).toContain("请进入空间后预览文档");
    await click("kn-space-open");
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeNull(); // 空间行下钻的是空间详情，不是文档抽屉
    expect((byTestid("loc")?.textContent ?? "")).toContain("space=sp_hr");
  });

  it("derives every copy/export/retry entry from one gate table (copyGates): six cells per face, markers honest, zero extra reads", async () => {
    const find = (testid: string) =>
      (byTestid(testid) ?? document.querySelector(`[data-testid="${testid}"]`)) as HTMLElement | null;
    const MARK = (id: string) => find(`kn-gates-${id}`)?.getAttribute("data-enabled");
    const REASON = (id: string) => find(`kn-gates-${id}`)?.getAttribute("data-reason") ?? "";
    const RETRY_ON = (id: string) => find(`kn-gates-${id}`)?.getAttribute("data-retry-enabled");
    const TITLE = (id: string) =>
      find(id === "knL" ? "knL-copy-meta" : `${id}-copy`)?.getAttribute("title") ?? "";
    const STATUS = (id: string) =>
      (find(id === "knL" ? "knL-copy-meta-status" : `${id}-copy-status`)?.textContent ?? "").trim();
    const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" }] };
    const SD = {
      asOf: "2026-11-19T08:00:00Z",
      documents: [
        { documentId: "d1", fileName: "员工手册.pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" },
        { documentId: "d2", fileName: "考勤表.xlsx", sizeBytes: 4096, updatedAt: "2026-11-19T06:00:00Z" },
      ],
    };
    const stub = (writeText: ReturnType<typeof vi.fn>) =>
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    // ---------- 1. loading：三面全 disabled、状态句同源、计数「—」、兜底不渲染、export absent ----------
    fetchMock.mockImplementation(() => new Promise(() => {})); // 全永挂
    await render("/knowledge?tab=spaces");
    for (const id of ["knI", "knG"]) {
      expect(MARK(id)).toBe("false");
      expect(REASON(id)).toBe("列表还在读取");
      expect(STATUS(id)).toBe("当前不可复制：列表还在读取");
      expect(TITLE(id)).toContain("还在读取");
      expect(byTestid(`${id}-copy-fallback`)).toBeNull();
      expect(RETRY_ON(id)).toBe("false"); // 还没结束，不摆重试
      expect(find(`kn-gates-${id}`)?.getAttribute("data-export")).toBe("absent");
    }
    expect((byTestid("knI-lines")?.textContent ?? "").trim()).toBe("—");
    expect((byTestid("knG-lines")?.textContent ?? "").trim()).toBe("—");

    // ---------- 2. ready 六格对照（spaces 面）：能复制才写可复制句，计数恢复 N 行 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(SD);
      return fail(404, "这个数据接口还没有接入。", "rid-g-x");
    });
    await render("/knowledge?tab=spaces");
    expect(MARK("knI")).toBe("true");
    expect(REASON("knI")).toBe("");
    expect(STATUS("knI")).toBe("");
    expect(TITLE("knI")).toContain("复制当前屏上的可见行");
    expect((byTestid("knI-lines")?.textContent ?? "")).toBe("1 行");
    expect((byTestid("knG-lines")?.textContent ?? "")).toBe("2 条");
    expect(MARK("knG")).toBe("true");

    // ---------- 3. empty-真空集（200+0）：disabled + 面句式 title + 状态句同源 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", items: [] });
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents: [] });
      return fail(404, "x", "rid-g-x");
    });
    await render("/knowledge?tab=spaces");
    expect(MARK("knI")).toBe("false");
    expect(REASON("knI")).toBe("这份回答里没有空间");
    expect(STATUS("knI")).toBe("当前不可复制：这份回答里没有空间");
    expect(TITLE("knI")).toBe("当前没有可复制的空间"); // 面句式保留在 title，由 gates 表出
    expect(STATUS("knG")).toBe("当前不可复制：这份回答里没有文档");
    expect(TITLE("knG")).toBe("当前没有可复制的结果");

    // ---------- 4. empty-筛选无匹配：第三句同源；两入口一起灭，绝无「一处可点」 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(SD);
      return fail(404, "x", "rid-g-x");
    });
    await render("/knowledge?tab=spaces");
    await type("kn8-global-input", "查无此空间");
    expect(MARK("knI")).toBe("false");
    expect(STATUS("knI")).toBe("当前不可复制：筛选后没有留下的空间");
    expect(byTestid("knI-copy-fallback")).toBeNull();

    // ---------- 5. denied（403）：原因句与 404 同权；重试 enabled 且 title 同源 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return fail(403, "没有查看这项数据的权限。", "rid-g-403");
      return fail(404, "这个数据接口还没有接入。", "rid-g-404");
    });
    await render("/knowledge?tab=spaces");
    expect(MARK("knI")).toBe("false");
    expect(REASON("knI")).toBe("读口未接入或没有权限");
    expect(STATUS("knI")).toBe("当前不可复制：读口未接入或没有权限");
    expect(TITLE("knI")).toBe("空间列表没读到（读口未接入或没有权限），没有可复制的内容。");
    expect(TITLE("knG")).toBe("文档列表没读到（读口未接入或没有权限），没有可复制的结果。"); // 403/404 同句同权
    expect(RETRY_ON("knI")).toBe("true");
    expect((byTestid("knw5-spaces-retry")?.getAttribute("title") ?? "")).toBe("重试这一次读取：读口未接入或没有权限");

    // ---------- 6. error（500）：一处灭全灭；计数「—」；兜底不渲染；重试同源 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-g-500");
      return fail(500, "数据服务暂时没有响应，请稍后重试。", "rid-g-500b");
    });
    await render("/knowledge?tab=spaces");
    expect(REASON("knI")).toBe("这次读取没有成功");
    expect(STATUS("knI")).toBe("当前不可复制：这次读取没有成功");
    expect(STATUS("knG")).toBe("当前不可复制：这次读取没有成功");
    expect((byTestid("knI-lines")?.textContent ?? "")).toBe("—");
    expect((byTestid("knw5-spaces-retry")?.getAttribute("title") ?? "")).toBe("重试这一次读取：这次读取没有成功");

    // ---------- 7. knF/knL 的六格抽样（详情 ready + 抽屉 ready/ghost）+ 复制成功路径仍同源 ----------
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub(writeText);
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(SD);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(SD);
      if (url === "/agent-api/api/documents/d1") return Promise.resolve({ sourceName: "原件", status: "indexed" });
      return fail(404, "x", "rid-g-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d1");
    await act(async () => {});
    expect(MARK("knF")).toBe("true");
    expect((byTestid("knF-lines")?.textContent ?? "")).toBe("2 行");
    expect(MARK("knL")).toBe("true");
    const urlsGates = fetchMock.mock.calls.length;
    await click("knF-copy");
    expect(STATUS("knF")).toBe("已复制");
    await click("knL-copy-meta");
    expect(STATUS("knL")).toBe("已复制");
    expect(fetchMock.mock.calls.length).toBe(urlsGates); // gates 计算与复制全程 0 新请求
    const gateToggle = fetchMock.mock.calls.length;
    await click("kn-sort-name"); // 排序切换（六格之外的状态翻面）也不追加请求
    expect(fetchMock.mock.calls.length).toBe(gateToggle);
    await type("kn3-docs-filter-input", "查无此词");
    expect(MARK("knF")).toBe("false");
    expect(STATUS("knF")).toBe("当前不可复制：筛选后没有留下的文档");
    expect((byTestid("knF-copy")?.getAttribute("title") ?? "")).toContain("本地筛选没有留下行：这份列表里有 2 份文档");

    // ghost 抽屉：knL disabled 句同源，且详情 500 不妨碍已加载行被复制（gates 规则明写）
    await render("/knowledge?tab=spaces&space=sp_hr&doc=zz9");
    await act(async () => {});
    expect(MARK("knL")).toBe("false");
    expect(STATUS("knL")).toBe("当前不可复制：这条文档不在已加载的列表里");
    expect(byDocTestid("knL-copy-meta-fallback")).toBeNull();
  });

  it("groups the doc-name search hits by owning space (kn-group-*): sums equal total, collapse is view-only, one code path", async () => {
    const SPACE = { asOf: "2026-11-19T08:00:00Z", items: [] };
    const LIST = {
      asOf: "2026-11-19T08:00:00Z",
      documents: [
        { documentId: "d1", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z", spaceId: "sp_hr", spaceName: "人事制度空间" },
        { documentId: "d2", fileName: "员工考勤说明.txt", mimeType: "txt", sizeBytes: 512, updatedAt: "2026-11-19T06:00:00Z", spaceId: "sp_hr", spaceName: "人事制度空间" },
        { documentId: "d3", fileName: "员工薪酬表.xlsx", docType: "xlsx", sizeBytes: 4096, lastSyncAt: "2026-11-19T05:00:00Z", spaceId: "sp_fin" },
        { documentId: "d4", fileName: "员工名鉴.md", spaceId: "sp_it", spaceName: "IT 支持空间" },
      ],
    };
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?")) return Promise.resolve(LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-gr-x");
    });
    await render("/knowledge?tab=spaces&q=%E5%91%98%E5%B7%A5");
    await act(async () => {});
    const urlsSettled = fetchMock.mock.calls.length;
    expect(attr("kn6-search", "data-state")).toBe("ready");
    expect(attr("kn6-search", "data-len")).toBe("4");

    // 组头读数：首现序、名缺用短码标签、计数与总数同源求和相等
    const headers = () => [...container.querySelectorAll('[data-testid="kn-group-header"]')].map((n) => (n.textContent ?? "").trim());
    const counts = () => [...container.querySelectorAll('[data-testid="kn-group-count"]')].map((n) => (n.textContent ?? "").trim());
    expect(headers()).toEqual(["人事制度空间", "空间 · SPFIN", "IT 支持空间"]);
    expect(counts()).toEqual(["2 项", "1 项", "1 项"]);
    const sum = counts().reduce((acc, text) => acc + Number(text.replace(/[^\d]/g, "")), 0);
    expect(sum).toBe(4);
    expect((byTestid("kn9-count-docs")?.textContent ?? "")).toContain("4");
    // 裸 sp_ 不上屏；全 id 只进 toggle 的 title
    const panelText = (byTestid("kn6-search-panel")?.textContent ?? "").replace(/\s+/g, " ");
    expect(panelText).not.toContain("sp_hr");
    expect(panelText).not.toContain("sp_fin");
    const toggles = () => [...container.querySelectorAll('[data-testid="kn-group-toggle"]')] as HTMLButtonElement[];
    expect(toggles()[1]?.getAttribute("title")).toContain("sp_fin");

    // 组内行：真 a[href]、既有口径、首组两行保持既有序
    const firstRows = [...(container.querySelectorAll("#kn-group-rows-1 [data-testid='kn6-search-row']") ?? [])];
    expect(firstRows).toHaveLength(2);
    expect((firstRows[0]?.querySelector('[data-testid="kn6-search-name"]')?.textContent ?? "")).toContain("员工手册");
    expect((firstRows[1]?.querySelector('[data-testid="kn6-search-name"]')?.textContent ?? "")).toContain("员工考勤");
    expect((firstRows[0]?.querySelector('[data-testid="kn6-search-updated"]')?.textContent ?? "")).toContain("2026-11-19 15:00");
    const href0 = (firstRows[0]?.querySelector('[data-testid="kn6-search-name"]') as HTMLAnchorElement).getAttribute("href") ?? "";
    expect(href0).toContain("sdoc=d1");

    // ---------- 折叠只动视图：行数落、URL 不动、零新请求、aria 成对 ----------
    await clickNth("kn-group-toggle", 0);
    const locAfterCollapse = byTestid("loc")?.textContent ?? "";
    expect(locAfterCollapse).toContain("q=%E5%91%98%E5%B7%A5"); // 折叠不改 ?q=
    expect(toggles()[0]?.getAttribute("aria-expanded")).toBe("false");
    const controlsId = toggles()[0]?.getAttribute("aria-controls") ?? "";
    expect(controlsId).toBe("kn-group-rows-1");
    expect(container.querySelector(`#${controlsId}`)).toBeTruthy(); // 容器常在，aria-controls 不落空
    expect(container.querySelectorAll('[data-testid="kn6-search-row"]')).toHaveLength(2);
    expect(fetchMock.mock.calls.length).toBe(urlsSettled); // 折叠 0 新请求
    await clickNth("kn-group-toggle", 0);
    expect(toggles()[0]?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll('[data-testid="kn6-search-row"]')).toHaveLength(4);
    expect(fetchMock.mock.calls.length).toBe(urlsSettled);

    // ---------- roving 跨组仍闭环：DOM 序 = 组拼接序；同时只有一个 0 ----------
    const box = byTestid("kn6-search-input") as HTMLInputElement;
    await act(async () => {
      box.focus();
    });
    await act(async () => {
      box.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    const names = () => [...container.querySelectorAll('a[data-testid="kn6-search-name"]')] as HTMLAnchorElement[];
    expect(document.activeElement).toBe(names()[0]);
    expect(names().filter((a) => a.getAttribute("tabindex") === "0")).toHaveLength(1);
    await act(async () => {
      names()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(names()[1]);
    await act(async () => {
      names()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    expect(document.activeElement).toBe(names()[2]); // 跨出首组进第二组，DOM 序不乱
    expect(fetchMock.mock.calls.length).toBe(urlsSettled); // 键盘全程也 0 新请求

    // ---------- 空结果：走既有空态，组不出现 ----------
    await type("kn6-search-input", "查无此名");
    expect(byTestid("kn6-search-empty")?.textContent ?? "").toContain("没有匹配的文档");
    expect(container.querySelectorAll('[data-testid="kn-group-toggle"]')).toHaveLength(0);
    expect(fetchMock.mock.calls.length).toBe(urlsSettled);

    // ---------- 单一代码路径：分组只存在于页顶「按文档名搜索」面；
    // retrieval 页的检索命中面（knw5-search*）不渲染任何分组件 ----------
    await render("/knowledge?tab=retrieval&q=%E5%91%98%E5%B7%A5");
    await act(async () => {});
    const hitsSurface = container.querySelector('[data-testid="knw5-search"]');
    expect(hitsSurface).toBeTruthy();
    expect(hitsSurface?.querySelectorAll('[data-testid="kn-group-toggle"], .kn6-group')).toHaveLength(0);
    // 该面读口今天未接入：走既有「检索未接入」诚实态，没有被分组改造波及
    expect(byTestid("knw5-search-unwired")).toBeTruthy();
  });

  it("sorts the space document table by four columns with one header set in every state (kn-sort-*): three-state URL, missing-last, keyboard, disabled strip", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const LIST = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "a1", fileName: "A 手册.pdf", mimeType: "pdf", sizeBytes: 300, updatedAt: "2026-11-19T07:00:00Z" },
        { documentId: "a2", fileName: "B 手册.pdf", mimeType: "pdf", sizeBytes: 300, updatedAt: "2026-11-19T06:00:00Z" },
        { documentId: "a3", fileName: "C 表.xlsx", docType: "xlsx", sizeBytes: 100, updatedAt: "2026-11-19T05:00:00Z" },
        { documentId: "a4", fileName: "D 只有名字" },
      ],
    };
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-s-x");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    const head = (col: string) => container.querySelector(`[data-testid="kn-sort-${col}"]`) as HTMLButtonElement | null;
    const strip = () => container.querySelector('[data-testid="kn3-docs-head-strip"]');
    const order = () =>
      [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].map(
        (tr) => (tr.querySelector('[data-testid="kn3-docs-name"]')?.textContent ?? "").trim(),
      );
    const ariaSort = (col: string) =>
      container.querySelector(`[data-testid="kn-sort-${col}"]`)?.closest("th")?.getAttribute("aria-sort") ?? null;
    const loc = () => byTestid("loc")?.textContent ?? "";
    const urls = () => fetchMock.mock.calls.length;

    // 四列都是真 BUTTON[type=button]；默认口径 updated/desc；表头只有一套、口径注在表下
    for (const col of ["name", "type", "size", "updated"]) {
      expect(head(col)?.tagName).toBe("BUTTON");
      expect(head(col)?.getAttribute("type")).toBe("button");
      expect(head(col)?.disabled).toBe(false);
    }
    expect(strip()).toBeNull();
    expect(ariaSort("updated")).toBe("descending");
    expect((byTestid("kn-sort-scope-note")?.textContent ?? "")).toContain("仅在当前已加载 4 篇内排序");

    // ---------- 三态周期落 ksort/kdir：落向→翻转→清除；整周期零新请求 ----------
    const urlsBefore = urls();
    await click("kn-sort-name");
    expect(loc()).toContain("ksort=name");
    expect(loc()).toContain("kdir=asc");
    await click("kn-sort-name");
    expect(loc()).toContain("kdir=desc");
    await click("kn-sort-name");
    expect(loc()).not.toContain("ksort"); // 第三点：清除，地址不残留
    expect(loc()).not.toContain("kdir");
    expect(ariaSort("updated")).toBe("descending"); // 清除后回默认口径
    expect(urls()).toBe(urlsBefore);

    // ---------- 键盘 Enter/Space 各自显式触发（扣住原生事件，一次按键一次翻态） ----------
    const nameBtn = head("name") as HTMLButtonElement;
    await act(async () => {
      nameBtn.focus();
    });
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    await act(async () => {
      nameBtn.dispatchEvent(enter);
    });
    await act(async () => {});
    expect(enter.defaultPrevented).toBe(true);
    expect(loc()).toContain("ksort=name");
    const spaceKey = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    await act(async () => {
      nameBtn.dispatchEvent(spaceKey);
    });
    await act(async () => {});
    expect(spaceKey.defaultPrevented).toBe(true);
    expect(loc()).toContain("kdir=desc");
    expect(urls()).toBe(urlsBefore);

    // ---------- 类型列：缺类型行两种方向恒末位；同值稳定（保持读入序） ----------
    await click("kn-sort-type"); // 首点=落向（类型正序）
    const typeAsc = order();
    expect(typeAsc[typeAsc.length - 1]).toBe("D 只有名字");
    expect(typeAsc.indexOf("A 手册.pdf")).toBeLessThan(typeAsc.indexOf("B 手册.pdf"));
    await click("kn-sort-type"); // 翻转：降序
    const typeDesc = order();
    expect(typeDesc[typeDesc.length - 1]).toBe("D 只有名字"); // 降序也沉底，不当空串排前
    expect(typeDesc.indexOf("A 手册.pdf")).toBeLessThan(typeDesc.indexOf("B 手册.pdf")); // 同值仍读入序
    // 大小同值（300）两行：升/降都保持彼此相对序；缺大小不当 0
    await click("kn-sort-type"); // 清除 type
    await click("kn-sort-size"); // size 落向 desc
    const sizeDesc = order();
    expect(sizeDesc.indexOf("A 手册.pdf")).toBeLessThan(sizeDesc.indexOf("B 手册.pdf"));
    await click("kn-sort-size"); // asc
    const sizeAsc = order();
    expect(sizeAsc.indexOf("A 手册.pdf")).toBeLessThan(sizeAsc.indexOf("B 手册.pdf"));
    expect(sizeAsc[sizeAsc.length - 1]).toBe("D 只有名字");

    // ---------- 复制文本与表体同序：贴 name-asc 的首末行对照 ----------
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await click("kn-sort-size"); // size 清除（翻转态再点=清除）
    await click("kn-sort-name"); // name/asc
    await click("knF-copy");
    const lines = String(writeText.mock.calls[writeText.mock.calls.length - 1][0]).trimEnd().split("\n").slice(1);
    const table = order();
    expect(lines[0].startsWith(table[0])).toBe(true);
    expect(lines[lines.length - 1].startsWith(table[table.length - 1])).toBe(true);
    await click("kn-sort-name");
    await click("kn-sort-name"); // 清除回默认 updated/desc
    await click("knF-copy");
    const linesDefault = String(writeText.mock.calls[writeText.mock.calls.length - 1][0]).trimEnd().split("\n").slice(1);
    const tableDefault = order();
    expect(linesDefault[0].startsWith(tableDefault[0])).toBe(true);
    expect(linesDefault[linesDefault.length - 1].startsWith(tableDefault[tableDefault.length - 1])).toBe(true);

    // ---------- 非 ready：表头条四列全 disabled + 逐字原因；URL 原样、零请求；口径注不出现 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      return fail(404, "这个数据接口还没有接入。", "rid-s-gone");
    });
    await render("/knowledge?tab=spaces&space=sp_hr&ksort=name&kdir=asc&q=%E6%89%8B%E5%86%8C");
    await act(async () => {});
    expect(strip()).toBeTruthy();
    const stripHead = container.querySelector('[data-testid="kn-sort-type"]') as HTMLButtonElement;
    expect(stripHead.disabled).toBe(true);
    expect(stripHead.getAttribute("title")).toBe("这份列表没读到（读口未接入或没有权限），现在不能排序。");
    expect(byTestid("kn-sort-scope-note")).toBeNull();
    const urlsStrip = urls();
    await act(async () => {
      stripHead.click();
    });
    await act(async () => {});
    expect(loc()).toContain("ksort=name"); // 点禁用表头：URL 与 q 都原样不动
    expect(loc()).toContain("q=%E6%89%8B%E5%86%8C");
    expect(urls()).toBe(urlsStrip);
  });

  it("previews a document row inline (kn-doc-preview-*) without requests, single-open, Esc back to the toggle, exclusive with the drawer", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const LIST = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d_alpha1", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" },
        { documentId: "d_b2", fileName: "只有一行的文档.md" },
        { documentId: "d_c3", fileName: "考勤说明.docx", docType: "doc", sizeBytes: 900, updatedAt: "2026-11-19T06:00:00Z" },
      ],
    };
    const route = (url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) return Promise.resolve(LIST);
      if (url === "/agent-api/api/documents/d_alpha1" || url === "/agent-api/api/documents/d_c3")
        return fail(404, "文档详情未接入", "rid-rp-gone");
      return fail(404, "这个数据接口还没有接入。", "rid-rp-x");
    };
    fetchMock.mockClear();
    fetchMock.mockImplementation(route);
    await render("/knowledge?tab=spaces&space=sp_hr");
    const toggles = () => [...container.querySelectorAll('[data-testid="kn-doc-preview-toggle"]')] as HTMLButtonElement[];
    const previews = () => container.querySelectorAll('[data-testid="kn-doc-preview"]');
    const loc = () => byTestid("loc")?.textContent ?? "";
    const urls = () => fetchMock.mock.calls.length;
    const kd = (node: Element, key: string) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      node.dispatchEvent(event);
      return event;
    };

    // 初始：三枚 toggle 全收起、零预览容器、URL 干净
    expect(toggles()).toHaveLength(3);
    expect(toggles().every((t) => t.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(previews()).toHaveLength(0);
    expect(loc()).not.toContain("doc=");

    // ---------- 展开缺字段行：未返回字段给「该字段未返回」+title 点名；短码大写、全 id 只在 title ----------
    const urlsBefore = urls();
    await clickNth("kn-doc-preview-toggle", 2); // d_b2：只有名字——默认 updated/desc 下缺时行沉底，DOM 第三位
    expect(previews()).toHaveLength(1);
    const field = (name: string) => byTestid(`kn-doc-preview-${name}`);
    expect(field("name")?.textContent).toBe("只有一行的文档.md");
    expect(field("type")?.textContent).toBe("该字段未返回");
    expect(field("type")?.getAttribute("title") ?? "").toContain("类型");
    expect(field("size")?.textContent).toBe("该字段未返回");
    expect(field("size")?.getAttribute("title") ?? "").toContain("大小");
    expect(field("updated")?.textContent).toBe("该字段未返回");
    expect(field("code")?.textContent).toBe("DB2"); // shortId("d_b2")=尾段大写；不是裸 id
    expect(field("code")?.getAttribute("title")).toBe("d_b2"); // 全 id 只在 title
    const previewText = (byTestid("kn-doc-preview")?.textContent ?? "").replace(/\s+/g, " ");
    expect(previewText).not.toContain("doc_"); // 屏上无裸 doc_/裸标识
    expect(previewText).not.toContain("d_b2");
    expect(loc()).not.toContain("doc="); // 展开不改 URL
    expect(urls()).toBe(urlsBefore); // 零新请求
    expect(toggles()[2]?.getAttribute("aria-expanded")).toBe("true");
    expect(byTestid("kn3-docs-row")?.getAttribute("data-preview")).toBe("0");

    // ---------- 同时只一行：换行展开 = 前一行收起 ----------
    await clickNth("kn-doc-preview-toggle", 0);
    expect(previews()).toHaveLength(1);
    expect(toggles()[0]?.getAttribute("aria-expanded")).toBe("true");
    expect(toggles()[2]?.getAttribute("aria-expanded")).toBe("false");

    // ---------- Esc：收起、焦点守在本钮、不跳搜索框、URL 与请求都不动 ----------
    await act(async () => {
      toggles()[0].focus();
    });
    await act(async () => {
      expect(kd(toggles()[0], "Escape").defaultPrevented).toBe(true);
    });
    await act(async () => {});
    expect(previews()).toHaveLength(0);
    expect(document.activeElement).toBe(toggles()[0]); // 焦点回发起行（就是本钮）
    expect((document.activeElement as Element)?.getAttribute("data-testid")).toBe("kn-doc-preview-toggle");
    expect(loc()).not.toContain("doc=");
    expect(urls()).toBe(urlsBefore);

    // ---------- 刷新回收起：预览态不进 URL ----------
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(previews()).toHaveLength(0);

    // ---------- 互斥 B：抽屉开着时开预览 = 静默关抽屉（doc= 删除、焦点不抢） ----------
    fetchMock.mockImplementation(route);
    await render("/knowledge?tab=spaces&space=sp_hr&doc=d_c3");
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    const urlsDrawer = urls();
    await act(async () => {
      toggles()[2].focus(); // 真实浏览器里鼠标点击会落焦本钮；jsdom 需显式聚焦再合成点击
    });
    await clickNth("kn-doc-preview-toggle", 2);
    expect(byDocTestid("kn7-preview-panel")).toBeNull();
    expect(loc()).not.toContain("doc=");
    expect(previews()).toHaveLength(1);
    expect(document.activeElement).toBe(toggles()[2]);
    expect(urls()).toBe(urlsDrawer); // 互斥切换全程零新请求（含 detail 读也不追加）
    await act(async () => {
      toggles()[2].focus();
    });
    await act(async () => {
      toggles()[2].dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    expect(previews()).toHaveLength(0);
    expect(loc()).not.toContain("doc="); // 预览收起也不动 URL

    // ---------- 互斥 A：预览开着点行名 = 开抽屉并收预览 ----------
    await clickNth("kn-doc-preview-toggle", 0);
    expect(previews()).toHaveLength(1);
    await click("kn3-docs-name"); // 第一行名字 → 抽屉
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    expect(loc()).toContain("doc=d_alpha1");
    expect(previews()).toHaveLength(0);
    expect(toggles()[0]?.getAttribute("aria-expanded")).toBe("false");

    // ---------- roving 共存：toggle 与行名同行同权；ArrowDown 仍走行 ----------
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); // 关抽屉
    });
    await act(async () => {});
    await render("/knowledge?tab=spaces&space=sp_hr");
    const input = byTestid("kn3-docs-filter-input") as HTMLInputElement;
    const urlsRoving = urls();
    await act(async () => {
      input.focus();
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    const names = [...container.querySelectorAll('a[data-testid="kn3-docs-name"]')] as HTMLAnchorElement[];
    expect(document.activeElement).toBe(names[0]);
    expect(names[0].getAttribute("tabindex")).toBe("0");
    expect(names[1].getAttribute("tabindex")).toBe("-1");
    expect(toggles()[0]?.getAttribute("tabindex")).toBe("0"); // 同行两控件同权
    expect(toggles()[1]?.getAttribute("tabindex")).toBe("-1"); // 非活动行整体退出 tab 序
    expect(urls()).toBe(urlsRoving); // roving 走位与 tabindex 断言全程零新请求
  });

  it("previews a space row inline (kn-space-preview-*): honest fields, one-at-a-time, Esc to toggle, sdoc mutex, zero requests", async () => {
    const SPACE_LIST = {
      asOf: "2026-11-19T08:00:00Z",
      items: [
        { spaceId: "sp_hr", name: "人事制度空间", docCount: 12, lastSyncAt: "2026-11-19T06:20:00Z", status: "synced" },
        { spaceId: "sp_zero", name: "空表空间", docCount: 0, lastSyncAt: "2026-11-19T04:00:00Z", status: "ready" },
        { spaceId: "sp_fin", docCount: 3 },
        { sourceName: "无信息的角落" },
      ],
    };
    const SEARCH = {
      asOf: "2026-11-19T08:00:00Z",
      documents: [{ documentId: "d_x", fileName: "员工手册.pdf", spaceId: "sp_hr", spaceName: "人事制度空间" }],
    };
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE_LIST);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve(SEARCH);
      return fail(404, "这个数据接口还没有接入。", "rid-sp-x");
    });
    await render("/knowledge?tab=spaces");
    const toggle = (i: number) => byTestid(`kn-space-toggle-${i}`) as HTMLButtonElement | null;
    const body = (i: number) => byTestid(`kn-space-preview-${i}`) as HTMLElement | null;
    const dd = (name: string, i: number) => byTestid(`kn-space-${name}-${i}`);
    const loc = () => byTestid("loc")?.textContent ?? "";
    const urls = () => fetchMock.mock.calls.length;

    // 初始：toggle 齐、aria-expanded=false、容器常挂载但 hidden
    expect(toggle(0)?.getAttribute("aria-expanded")).toBe("false");
    expect(body(0)?.hidden).toBe(true);
    expect(body(0)).toBeTruthy(); // aria-controls 的目标始终在场
    const loc0 = loc();
    const urls0 = urls();

    // ---------- 完整行：四格逐字；真 0 给「0 篇」不当缺值 ----------
    await click("kn-space-toggle-0");
    expect(body(0)?.hidden).toBe(false);
    expect(dd("name", 0)?.textContent).toBe("人事制度空间");
    expect(dd("docs", 0)?.textContent).toBe("12 篇");
    expect(dd("at", 0)?.textContent).toBe("最近同步：2026-11-19 14:20");
    expect(dd("code", 0)?.textContent).toBe("SPHR");
    expect(dd("code", 0)?.getAttribute("title")).toBe("sp_hr"); // 全 id 只在 title
    await click("kn-space-toggle-1");
    expect(dd("docs", 1)?.textContent).toBe("0 篇"); // 真 0 保持既有真实口径
    expect(dd("docs", 1)?.getAttribute("title") ?? "").not.toContain("没给出");

    // ---------- 名缺行：短码 + title 全 id；裸 sp_ 不上屏 ----------
    await click("kn-space-toggle-2");
    expect(dd("name", 2)?.textContent).toBe("空间 · SPFIN");
    expect(dd("name", 2)?.getAttribute("title")).toBe("sp_fin");
    expect((body(2)?.textContent ?? "")).not.toContain("sp_fin");

    // ---------- 全缺行：逐格「该字段未返回」/「—」+title 点名；不编值 ----------
    await click("kn-space-toggle-3");
    expect(dd("name", 3)?.textContent).toBe("该字段未返回");
    expect(dd("name", 3)?.getAttribute("title") ?? "").toContain("空间名");
    expect(dd("docs", 3)?.textContent).toBe("—");
    expect(dd("docs", 3)?.getAttribute("title") ?? "").toContain("文档数");
    expect(dd("at", 3)?.textContent).toBe("该字段未返回");
    expect(dd("at", 3)?.getAttribute("title") ?? "").toContain("更新");
    expect(dd("code", 3)?.textContent).toBe("该字段未返回");
    expect(dd("code", 3)?.getAttribute("title") ?? "").toContain("短码");

    // ---------- 同时只一行：前三行全灭，只剩 3 ----------
    expect([0, 1, 2].every((i) => body(i)?.hidden === true)).toBe(true);
    expect([0, 1, 2].every((i) => toggle(i)?.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(toggle(3)?.getAttribute("aria-expanded")).toBe("true");

    // ---------- Esc：收起、焦点守钮、URL 逐字不变、零新请求 ----------
    await act(async () => {
      toggle(3)?.focus();
    });
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    await act(async () => {
      toggle(3)?.dispatchEvent(esc);
    });
    await act(async () => {});
    expect(esc.defaultPrevented).toBe(true);
    expect(body(3)?.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle(3));
    expect(loc()).toBe(loc0); // 全程 URL 逐字不变
    expect(urls()).toBe(urls0); // 全程零新请求

    // ---------- 刷新回收起 ----------
    await click("kn-space-toggle-0");
    await render("/knowledge?tab=spaces");
    expect(body(0)?.hidden).toBe(true);

    // ---------- 互斥 · 检索行内展开：开 sdoc 即收预览；开预览即静默删 sdoc；全程零请求 ----------
    await click("kn6-search-name"); // sdoc 打开（内联展开，本就不发详情请求）
    expect(loc()).toContain("sdoc=d_x");
    await click("kn-space-toggle-0"); // 开空间预览
    expect(loc()).not.toContain("sdoc"); // 互斥：sdoc 静默删除
    expect(body(0)?.hidden).toBe(false);
    const urlsMutex = urls();
    await click("kn6-search-name"); // 再开 sdoc
    expect(body(0)?.hidden).toBe(true); // 预览收起且不留活体
    expect(toggle(0)?.getAttribute("aria-expanded")).toBe("false");
    expect(urls()).toBe(urlsMutex);

    // ---------- 互斥 · 与文档行预览/抽屉：路由结构互斥（进详情即卸载列表） ----------
    await click("kn-space-open");
    await act(async () => {});
    expect(container.querySelectorAll('[data-testid^="kn-space-toggle-"]')).toHaveLength(0);
    expect(byTestid("kn3-docs-table") ?? container.querySelector('[data-testid="kn3-docs-head-strip"]')).toBeTruthy();
    expect(loc()).toContain("space=sp_hr"); // 下钻是加法：不清与本次无关的面参数（sdoc 仍在页顶搜索面）
  });

  it("gives the document row and the drawer one identical permalink (kn-doc-permalink): paste-refresh opens the same doc, no-id rows refuse, fallback byte-equal", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const LIST = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d_p", fileName: "同值文档.pdf", mimeType: "pdf", sizeBytes: 100, updatedAt: "2026-11-19T07:00:00Z" },
        { fileName: "缺标识文档.md", sizeBytes: 200 },
      ],
    };
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?")) return Promise.resolve(LIST);
      return fail(404, "这个数据接口还没有接入。", "rid-pl-x");
    });
    const inDrawer = (testid: string) => document.querySelector(`.kn7-preview [data-testid="${testid}"]`);
    const clickByEl = async (el: Element) => {
      await act(async () => {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {});
    };
    // 深链参数在场：q + ksort/kdir（ksort=size asc：d_p 在前、缺大小行恒末）
    await render("/knowledge?tab=spaces&space=sp_hr&q=%E5%90%8C%E5%80%BC&ksort=size&kdir=asc");
    await act(async () => {});
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const rowBtns = () => [...document.querySelectorAll('[data-testid="kn-doc-permalink"]')] as HTMLButtonElement[];
    const urlsBefore = fetchMock.mock.calls.length;

    // ---------- 行上入口：抽屉未开也一次可复制；缺标识行 disabled + 逐字 title ----------
    expect(rowBtns()).toHaveLength(2);
    expect(rowBtns()[0]?.disabled).toBe(false);
    expect(rowBtns()[1]?.disabled).toBe(true);
    expect(rowBtns()[1]?.getAttribute("title")).toBe("该文档没有可用的固定标识");
    await clickNth("kn-doc-permalink", 0);
    expect(writeText).toHaveBeenCalledTimes(1);
    const rowUrl = String(writeText.mock.calls[0][0]);
    expect(rowUrl.startsWith(window.location.origin)).toBe(true);
    const params = new URLSearchParams(rowUrl.slice(rowUrl.indexOf("?") + 1));
    expect(params.get("space")).toBe("sp_hr");
    expect(params.get("doc")).toBe("d_p");
    expect(params.get("q")).toBe("同值"); // 现有检索参数原样带上
    expect(params.get("ksort")).toBe("size"); // 排序参数原样带上
    expect(params.get("kdir")).toBe("asc");
    expect((byTestid("kn-doc-permalink-status")?.textContent ?? "").trim()).toBe("链接已复制");
    expect(byTestid("kn-doc-permalink-fallback")).toBeNull(); // 成功无兜底
    await clickNth("kn-doc-permalink", 1);
    expect(writeText).toHaveBeenCalledTimes(1); // 守卫：无标识不写
    expect(fetchMock.mock.calls.length).toBe(urlsBefore); // 复制全程零新请求

    // ---------- 复现读数：粘贴 URL → 刷新 → 抽屉 testid 命中 → 文档标识同值 ----------
    await render(rowUrl.slice(window.location.origin.length));
    await act(async () => {});
    expect(byDocTestid("kn7-preview-panel")).toBeTruthy();
    expect((byTestid("loc")?.textContent ?? "")).toContain("doc=d_p");
    expect(byDocTestid("kn3-docs-detail")?.getAttribute("title")).toBe("d_p");
    expect((byTestid("loc")?.textContent ?? "")).toContain("ksort=size");

    // ---------- 抽屉侧：新族入口与 knO 老入口同串（一个字符串、两处入口，knO 保留） ----------
    const drawerBtn = () => rowBtns().find((b) => b.closest(".kn7-preview") !== null) as HTMLButtonElement;
    expect(drawerBtn()).toBeTruthy();
    const urlsRepro = fetchMock.mock.calls.length;
    await clickByEl(drawerBtn());
    expect(String(writeText.mock.calls[writeText.mock.calls.length - 1][0])).toBe(rowUrl); // 抽屉=行，逐字节
    expect((inDrawer("kn-doc-permalink-status")?.textContent ?? "").trim()).toBe("链接已复制");
    await clickByEl(byDocTestid("knO-permalink") as HTMLElement);
    expect(String(writeText.mock.calls[writeText.mock.calls.length - 1][0])).toBe(rowUrl); // knO 同串
    // 掩码不变量：屏上可见 URL 只给 doc=…，全串在 title/剪贴板
    const visibleUrl = byDocTestid("knO-permalink-url")?.textContent ?? "";
    expect(visibleUrl).not.toContain("doc=d_p");
    expect(visibleUrl).toContain("doc=…");
    expect(fetchMock.mock.calls.length).toBe(urlsRepro);

    // ---------- 拒绝路径：两侧兜底 textarea 与写入串逐字一致 ----------
    const writeFail = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText: writeFail }, configurable: true });
    await clickByEl(drawerBtn());
    const drawerFallback = inDrawer("kn-doc-permalink-fallback") as HTMLTextAreaElement | null;
    expect(drawerFallback).toBeTruthy();
    expect(drawerFallback?.readOnly).toBe(true);
    expect(drawerFallback?.value).toBe(rowUrl);
    expect((inDrawer("kn-doc-permalink-status")?.textContent ?? "")).toContain("复制失败");
    const rowBtn = () => rowBtns().find((b) => b.closest(".kn7-preview") === null) as HTMLButtonElement;
    await clickByEl(rowBtn());
    const rowFallback = byTestid("kn-doc-permalink-fallback") as HTMLTextAreaElement | null;
    expect(rowFallback).toBeTruthy();
    expect(rowFallback?.value).toBe(rowUrl);
    expect((container.querySelector('[data-testid="kn-doc-permalink-status"]')?.textContent ?? "")).toContain("复制失败");
    expect(fetchMock.mock.calls.length).toBe(urlsRepro);
  });

  it("maps the live BFF document contract honestly into buckets (ktype, numeric type, snake time): no invented labels", async () => {
    // 活体实测（BFF b3b0f16 / space_id=1）原样夹具：type/kind 为数字 0、无 size、
    // 时间 updated_at/updatedAt 带 +08:00、信封是 count/hasMore/cursor（无 nextCursor 别名）。
    const SPACE = { asOf: "2026-11-20T07:05:58Z", asOfSource: "bff-read-time", spaces: [
      { space_id: "1", name: "seakoi-p0-8-probe", kind: "normal", document_count: 1, last_sync_at: "2026-11-14T06:33:18+08:00" },
    ], items: [
      { space_id: "1", name: "seakoi-p0-8-probe", kind: "normal", document_count: 1, last_sync_at: "2026-11-14T06:33:18+08:00" },
    ] };
    const LIVE_DOCS = {
      asOf: "2026-11-20T07:05:58Z",
      asOfSource: "bff-read-time",
      count: 2,
      hasMore: false,
      cursor: null,
      documents: [
        { id: "2", document_id: "2", name: "seakoi-p08-doc-1.txt", description: "P0-8 测试文档", type: 0, kind: 0, state: null, status: null, is_released: false, collection_name: null, updated_at: "2026-11-14T06:33:18+08:00", updatedAt: "2026-11-14T06:33:18+08:00", created_at: "2026-11-14T06:33:18+08:00" },
        { id: "3", document_id: "3", name: "只有名字的文档", description: null, state: null },
      ],
    };
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=1")) return Promise.resolve(LIVE_DOCS);
      return fail(404, "这个数据接口还没有接入。", "rid-l2-x");
    });
    await render("/knowledge?tab=spaces&space=1");
    await act(async () => {});
    const btns = () => [...container.querySelectorAll("button")].filter((b) => (b.getAttribute("data-testid") ?? "").startsWith("kn-type-"));
    const cell = (i: number, t: string) => [...container.querySelectorAll('[data-testid="kn3-docs-row"]')][i]?.querySelector(`[data-testid="${t}"]`);
    const loc = () => byTestid("loc")?.textContent ?? "";
    const params = () => new URLSearchParams(loc().slice(loc().indexOf("?") + 1));

    // 数字 type=0：人话映射查不到 → 「其他类型」，原始值只进 title；禁猜 0=txt
    expect((cell(0, "kn3-docs-type")?.textContent ?? "")).toBe("其他类型");
    expect(cell(0, "kn3-docs-type")?.getAttribute("title")).toBe("0");
    // 无 size/无时间字段：缺就是缺，不编 0、不编时刻
    expect((cell(1, "kn3-docs-size")?.textContent ?? "")).toBe("—");
    expect((cell(1, "kn3-docs-updated")?.textContent ?? "")).toBe("—");
    // updated_at +08:00 → BJT 到分（同一时刻原样）
    expect((cell(0, "kn3-docs-updated")?.textContent ?? "")).toContain("2026-11-14 06:33");
    // 桶：全部(2)、其他类型(1)、未标注类型(1)；Σ=行数=data-len
    console.log("BTNS", btns().map((b) => b.getAttribute("data-testid")+"|"+b.textContent).join(" ;; "));
    expect((btns()[1]?.textContent ?? "")).toContain("其他类型");
    expect((btns()[2]?.textContent ?? "")).toContain("未标注类型");
    expect(byTestid("kn-type-all-count")?.textContent).toBe("2");
    expect(attr("kn3-docs", "data-len")).toBe("2");

    const urlsBase = fetchMock.mock.calls.length;
    // 点「其他类型」：写 ktype，URL 无旧 type；q/排序不在场也不误写
    await clickNth("kn-type-1", 0);
    expect(params().get("ktype")).toBe("其他类型");
    expect(params().has("type")).toBe(false);
    expect(attr("kn3-docs", "data-len")).toBe("1");
    // 信封键名与前端不同（count/hasMore/cursor 而非 nextCursor/total）→ 分页诚实显示无游标，不猜页数
    expect((byTestid("knE-page-more")?.textContent ?? "")).toContain("无分页游标");
    expect(fetchMock.mock.calls.length).toBe(urlsBase); // 切桶 0 新请求

    // 组合不清除：带 q+ksort 的粘链 → 换桶/清桶全程 q/ksort/kdir 不动
    const uCombo = fetchMock.mock.calls.length;
    await render("/knowledge?tab=spaces&space=1&q=%E6%96%87%E6%A1%A3&ksort=name&kdir=desc&ktype=%E5%85%B6%E4%BB%96%E7%B1%BB%E5%9E%8B");
    await act(async () => {});
    const uComboAfterRender = fetchMock.mock.calls.length; // render 自带既有读取
    void uCombo;
    expect(params().get("q")).toBe("文档");
    expect(btns()[1]?.getAttribute("aria-pressed")).toBe("true");
    await clickNth("kn-type-2", 0);
    expect(params().get("q")).toBe("文档");
    expect(params().get("ksort")).toBe("name");
    expect(params().get("kdir")).toBe("desc");
    expect(params().get("ktype")).toBe("未标注类型");
    // 同桶再点清除：ktype 删干净、无 type 残留、其余参数原样
    await clickNth("kn-type-2", 0);
    expect(params().has("ktype")).toBe(false);
    expect(params().has("type")).toBe(false);
    expect(params().get("q")).toBe("文档");
    expect(params().get("ksort")).toBe("name");
    expect(fetchMock.mock.calls.length).toBe(uComboAfterRender); // 换桶/清桶 0 新请求

    // 旧链 type= 兜底：选中态生效；清桶把 type 一并删（旧参数不复活）
    await render("/knowledge?tab=spaces&space=1&type=%E6%9C%AA%E6%A0%87%E6%B3%A8%E7%B1%BB%E5%9E%8B");
    await act(async () => {});
    expect(btns()[2]?.getAttribute("aria-pressed")).toBe("true");
    console.log("PROBE2", "btns=", btns().map((b) => b.textContent).join("/"), "loc=", loc(), "gap=", (byTestid("kn-type-empty")?.textContent ?? "").slice(0, 40), "rows=", container.querySelectorAll('[data-testid="kn3-docs-row"]').length);
    expect(attr("kn3-docs", "data-len")).toBe("1");
    const uOld = fetchMock.mock.calls.length;
    await clickNth("kn-type-2", 0); // 同桶再点 = 清除（兜底读的旧 type 一并删，不复活）
    expect(loc()).not.toContain("type");
    expect(fetchMock.mock.calls.length).toBe(uOld); // 清桶 0 新请求

    // 该类型无文档：文案含「该类型下没有文档」+已加载 N，非真空句
    await render("/knowledge?tab=spaces&space=1&ktype=%E5%8E%8B%E7%BC%A9%E5%8C%85");
    await act(async () => {});
    const gap = byTestid("kn-type-empty")?.textContent ?? "";
    expect(gap).toContain("该类型下没有文档");
    expect(gap).toContain("已加载的 2 份文档里没有「压缩包」类型"); // 队列#2：量词与裸 0 口径（原「当前已加载 2 条里没有」）
    expect(gap).not.toContain("该空间暂无文档");
  });

  it("filters the space document list by type buckets (kn-type-*): counts, aria-pressed, URL, cursor reset, honest states", async () => {
    const SPACE = { asOf: "2026-11-19T07:00:00Z", items: [{ spaceId: "sp_hr", name: "人事制度空间" }] };
    const P1 = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d1", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 100, updatedAt: "2026-11-19T07:00:00Z" },
        { documentId: "d2", fileName: "薪酬表.xlsx", docType: "xlsx", sizeBytes: 200, updatedAt: "2026-11-19T06:00:00Z" },
      ],
      nextCursor: "c2",
    };
    const P2 = {
      asOf: "2026-11-19T07:00:00Z",
      documents: [
        { documentId: "d3", fileName: "考勤制度.doc", docType: "doc", sizeBytes: 300, updatedAt: "2026-11-19T05:00:00Z" },
        { documentId: "d4", fileName: "无类型文件", sizeBytes: 400, updatedAt: "2026-11-19T04:00:00Z" },
      ],
      nextCursor: null,
    };
    const routes = (url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      if (url.startsWith("/agent-api/api/documents?") && url.includes("spaceId=sp_hr")) {
        if (url.includes("cursor=c2")) return Promise.resolve(P2);
        return Promise.resolve(P1);
      }
      return fail(404, "这个数据接口还没有接入。", "rid-t-x");
    };
    fetchMock.mockClear();
    fetchMock.mockImplementation(routes);
    await render("/knowledge?tab=spaces&space=sp_hr");
    await act(async () => {});
    const bucketOf = (i: number) => byTestid(`kn-type-${i}`) as HTMLButtonElement | null;
    const allBtn = () => byTestid("kn-type-all") as HTMLButtonElement | null;
    const loc = () => (byTestid("loc")?.textContent ?? "");
    const urls = () => fetchMock.mock.calls.length;

    // ---------- 桶读数：名+计数、Σ=行数、all 选中 ----------
    expect(allBtn()?.getAttribute("aria-pressed")).toBe("true");
    expect((allBtn()?.textContent ?? "")).toContain("全部");
    expect((byTestid("kn-type-all-count")?.textContent ?? "")).toBe("2");
    expect(bucketOf(1)?.textContent ?? "").toContain("PDF");
    expect((byTestid("kn-type-count-1")?.textContent ?? "")).toBe("1");
    expect((byTestid("kn-type-count-2")?.textContent ?? "")).toBe("1"); // 表格
    expect(allBtn()?.disabled).toBe(false);
    expect([...[bucketOf(1)!, bucketOf(2)!].map((b) => b.getAttribute("tabindex"))].every((t) => t === null || t === "0" || t === "-1")).toBe(true); // 无正数 tabindex

    const urlsBefore = urls();

    // ---------- 点选：本地过滤；?type= 进 URL；与 q/ksort/kdir 组合互不清除 ----------
    await type("kn3-docs-filter-input", "手册"); // 本地筛选，不进 URL（与 R55 一致）
    await click("kn-sort-size"); // ksort=size&kdir=desc 进地址
    const withSort = loc();
    expect(withSort).toContain("ksort=size");
    await click("kn-type-1"); // 点 PDF 桶 → ?type= 进 URL
    expect(loc()).toContain("type=PDF");
    expect(loc()).toContain("ksort=size"); // 类型切换不动排序参数
    expect(attr("kn3-docs", "data-len")).toBe("1"); // 计数与列表同源
    expect(urls()).toBe(urlsBefore); // 全程零新请求

    // ---------- 同桶再点 = 回全部（type 清除） ----------
    await click("kn-type-1");
    expect(loc()).not.toContain("type=");
    expect(allBtn()?.getAttribute("aria-pressed")).toBe("true");

    // ---------- 切类型重置游标分页：先清筛选，翻第二页，切类型回第一页 ----------
    await type("kn3-docs-filter-input", "");
    await click("knE-page-more");
    const rowsAfterMore = [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].length;
    expect(rowsAfterMore).toBe(4);
    await click("kn-type-2"); // 表格桶
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]')).toHaveLength(1);
    expect(byTestid("knE-page-count")?.textContent ?? "").toContain("已显示 2 篇"); // 累加页已清、回第一页，baseRows
    expect(urls()).toBe(urlsBefore + 1); // 点页本身读一次 P2（R54 既有设计）；切桶重置游标不再追加

    // ---------- 粘链 + 刷新复现选中态与行数 ----------
    await render("/knowledge?tab=spaces&space=sp_hr&type=表格");
    await act(async () => {});
    expect(bucketOf(2)?.getAttribute("aria-pressed")).toBe("true");
    expect(attr("kn3-docs", "data-len")).toBe("1");
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]')).toHaveLength(1);

    // ---------- 缺类型行归「未归类」桶 ----------
    await render("/knowledge?tab=spaces&space=sp_hr");
    await act(async () => {});
    await click("knE-page-more");
    const bucket4 = bucketOf(4);
    expect(bucket4?.textContent ?? "").toContain("未标注类型");

    // ---------- 筛无匹配：kn-type-empty 文案 + 清类型出口，与「该空间暂无文档」可分 ----------
    await render("/knowledge?tab=spaces&space=sp_hr&type=%E5%8E%8B%E7%BC%A9%E5%8C%85"); // 压缩包
    await act(async () => {});
    expect(byTestid("kn-type-empty")).toBeTruthy();
    expect(byTestid("kn-type-empty")?.textContent ?? "").not.toContain("该空间暂无文档");
    expect(byTestid("kn-type-clear")).toBeTruthy();
    await click("kn-type-clear");
    expect(loc()).not.toContain("type=");
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]')).toHaveLength(2);

    // ---------- 类型 + 名字两层筛选叠空：必须一钮回全量，且无裸 0 ----------
    await render("/knowledge?tab=spaces&space=sp_hr&type=%E5%8E%8B%E7%BC%A9%E5%8C%85"); // 压缩包
    await act(async () => {});
    await type("kn3-docs-filter-input", "周报");
    await act(async () => {});
    const stacked = byTestid("kn-type-empty")?.textContent ?? "";
    expect(stacked).toContain("这两个筛选叠起来没有留下文档");
    expect(stacked).not.toMatch(/(^|[^0-9.])0\s*(条|篇|个)/); // 裸 0 不上屏
    expect(byTestid("kn-type-clear")).toBeFalsy(); // 单清类型会留名字筛选，故此处不给半截出口
    const clearAll = byTestid("kn-type-clear-all") as HTMLElement;
    expect(clearAll).toBeTruthy();
    await click("kn-type-clear-all");
    expect(loc()).not.toContain("type=");
    expect((container.querySelector("#kn3-input") as HTMLInputElement | null)?.value ?? "").toBe("");
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]')).toHaveLength(2);

    // ---------- 非 ready：整排 disabled + 原因句（读自 copyGates 同表）+ 计数不显示数字 ----------
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SPACE);
      return fail(404, "这个数据接口还没有接入。", "rid-t-404");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await act(async () => {});
    // 未接入聚合不到类型：只剩「全部」桶按钮且 disabled；原因句读自 copyGates 同表；计数「—」
    const bucketBtns = () =>
      [...container.querySelectorAll("button")].filter((b) => (b.getAttribute("data-testid") ?? "").startsWith("kn-type-"));
    expect(bucketBtns()).toHaveLength(1);
    const allOnly = allBtn() as HTMLButtonElement;
    expect(allOnly?.disabled).toBe(true);
    expect((allOnly.getAttribute("title") ?? "")).toContain("当前不可筛选：");
    expect((allOnly.getAttribute("title") ?? "")).toContain("没有权限");
    expect((byTestid("kn-type-all-count")?.textContent ?? "")).toBe("—");
    const urls404 = urls();
    await click("kn-type-all");
    expect(loc()).not.toContain("type=");
    expect(urls()).toBe(urls404); // 禁用态被触发也不改 URL、不发请求
  });
});

// ---------- R102：空间行 → 空间详情的真锚点（deep link）、预览互斥、无标识行只给文本 ----------
describe("R102 — space row deep link (kn-space-open / kn-space-nolink)", () => {
  const R102_SPACES = {
    asOf: "2026-11-19T08:00:00Z",
    items: [
      { spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" },
      { spaceId: "sp_ops", name: "运维手册空间", docCount: 1, status: "synced" },
      { name: "没给标识的空间", documentCount: 3, status: "synced" },
    ],
  };
  const R102_DOCS = {
    asOf: "2026-11-19T08:00:00Z",
    documents: [
      { documentId: "d1", fileName: "员工手册.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" },
    ],
  };
  const wire = () =>
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(R102_SPACES);
      if (url === DOCS_SPACE || url === docsUrlFor("sp_ops")) return Promise.resolve(R102_DOCS);
      return fail(404, "这个数据接口还没有接入。", "rid-r102");
    });

  it("renders one real anchor per identified row: href lands on the query-state detail slot, focusable, one link only", async () => {
    wire();
    await render("/knowledge?tab=spaces");
    const anchors = [...container.querySelectorAll('a[data-testid="kn-space-open"]')] as HTMLAnchorElement[];
    // 两条有标识的行各一个真锚点；无标识行没有链接（一行不双链）
    expect(anchors).toHaveLength(2);
    const rows = [...container.querySelectorAll('[data-testid="knw5-spaces-row"]')];
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.querySelectorAll('a[data-testid="kn-space-open"]').length).toBeLessThanOrEqual(1);
    // href 是查询态落点（本模块无 /knowledge/:spaceId 路由——space= 即详情槽位）
    const href0 = anchors[0].getAttribute("href") ?? "";
    expect(href0).toBe("/knowledge?tab=spaces&panel=spaces&space=sp_hr");
    expect(anchors[0].tagName).toBe("A");
    expect(href0).toContain("/knowledge?");
    expect(href0).toContain("tab=spaces");
    expect(href0).toContain("panel=spaces");
    expect(href0).toContain("space=sp_hr");
    // 可聚焦：roving 至少一条 tabindex=0，其余 -1（键盘 Tab 落链条不碎）
    const tabs = anchors.map((a) => a.getAttribute("tabindex"));
    expect(tabs).toContain("0");
    expect(tabs.every((t) => t === "0" || t === "-1")).toBe(true);
    // Enter 走的就是这个真 a[href]（jsdom 不模拟原生回车激活；href 在场即原生可开，
    // 与下方 click 断言同源——click 命中的正是 Enter 要走的落点）
    const locBefore = byTestid("loc")?.textContent ?? "";
    await click("kn-space-open");
    const after = byTestid("loc")?.textContent ?? "";
    expect(locBefore).not.toContain("space=sp_hr"); // 改前不在详情
    expect(after).toContain("space=sp_hr"); // 点链进详情
    expect(after).toContain("panel=spaces");
  });

  it("link click never opens the inline preview, in either order (mutual exclusion)", async () => {
    wire();
    // 方向一：先展开预览，再点链接 → 预览随列表面卸载而消失，详情槽位在场
    await render("/knowledge?tab=spaces");
    await click("kn-space-toggle-0");
    expect(byTestid("kn-space-preview-0")).toBeTruthy(); // 预览确实开着
    await click("kn-space-open");
    expect((byTestid("loc")?.textContent ?? "")).toContain("space=sp_hr");
    expect(container.querySelectorAll('[data-testid^="kn-space-preview"]').length).toBe(0);
    expect(document.querySelectorAll('[data-testid^="kn-space-preview"]').length).toBe(0); // 含 portal
    // 方向二：直接点链接 → 列表面与预览从未挂载，详情文档表在场
    await render("/knowledge?tab=spaces");
    await click("kn-space-open");
    expect(document.querySelectorAll('[data-testid^="kn-space-preview"]').length).toBe(0);
    expect(byTestid("kn3-docs-row")).toBeTruthy(); // 进的是空间详情
  });

  it("nameless row: no link, only kn-space-nolink text with the exact title; no clipboard write, no fabricated id", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire();
    await render("/knowledge?tab=spaces");
    const rows = [...container.querySelectorAll('[data-testid="knw5-spaces-row"]')];
    const nameless = rows[2];
    expect(nameless?.querySelector('a[data-testid="kn-space-open"]')).toBeNull();
    const nolink = nameless?.querySelector('[data-testid="kn-space-nolink"]');
    expect(nolink).toBeTruthy();
    expect(nolink?.getAttribute("title")).toBe("该空间没有可用标识");
    expect(nolink?.tagName).toBe("SPAN");
    expect((nolink?.textContent ?? "")).toContain("点不进");
    // 点了也不写剪贴板、不造 id（页面上不出现伪造的 space= 链接）
    await act(async () => {
      nolink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(nameless?.querySelector("a[href*='space=']")).toBeNull();
    expect((byTestid("loc")?.textContent ?? "")).not.toContain("space=");
  });

  it("zero extra requests around the deep link: list reads stable through roving, preview toggles, and tab round-trips", async () => {
    wire();
    await render("/knowledge?tab=spaces");
    const u0 = urlsCalled().slice().sort().join("|");
    expect(u0).toBe([DOCUMENTS_PLAIN, SPACES].sort().join("|")); // 列表面既有两条读取（R52 预载口径），链接不增
    // 只读交互不产生任何新请求
    await click("kn-space-toggle-0");
    await click("kn-space-toggle-0");
    await type("kn8-global-input", "人事"); // 本地过滤：键入不再请求（列表面自述口径）
    expect(urlsCalled().slice().sort().join("|")).toBe(u0);
    // 点链进详情：新增的读取只是详情槽位自身的既有读取（R52 设计口径），列表面零增发
    await click("kn-space-open");
    const u1 = urlsCalled();
    // 点链后新增的读取全部是详情槽位自身的既有读取（spaces 复读给面包屑 + 该空间文档表，
    // R52/R73 口径）；未知 URL 零出现——链接本身不引入任何新请求
    expect([...new Set(u1)].sort()).toEqual([DOCUMENTS_PLAIN, DOCS_SPACE, SPACES].sort());
    expect(u1.filter((x) => x === DOCS_SPACE)).toHaveLength(1);
  });
});

// ---------- R108：空间详情文档列表的单页上限诚实化（kn3-page-cap 常驻句） ----------
describe("R108 — space docs page cap (kn3-page-cap / -more)", () => {
  const N = 50; // 与 DOCUMENTS_LIMIT 同源的字面值：若常量漂移，本用例与句内数字一起红
  const mkDocs = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      documentId: `d${i}`,
      fileName: `封顶文档 ${String(i + 1).padStart(2, "0")}.pdf`,
      mimeType: "pdf",
      sizeBytes: 10,
      updatedAt: "2026-11-19T07:00:00Z",
    }));
  const SP = {
    asOf: "2026-11-19T08:00:00Z",
    items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" }],
  };
  const wireDocs = (body: unknown) =>
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCS_SPACE) return Promise.resolve(body);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-r108");
    });
  const capText = () => (byTestid("kn3-page-cap")?.textContent ?? "").replace(/\s+/g, " ");

  it("renders the standing cap sentence with N from the limit constant and M from the visible rows; title states limit and the honest cursor verdict", async () => {
    wireDocs({ asOf: "2026-11-19T08:00:00Z", documents: mkDocs(2) });
    await render("/knowledge?tab=spaces&space=sp_hr");
    const cap = byTestid("kn3-page-cap");
    expect(cap).toBeTruthy();
    expect(capText()).toContain(`本页最多显示 ${N} 篇（当前已加载 2 篇；复制清单也只含这些篇）`);
    // M 与屏上同一集合：可见行数、表体 data-len、常驻句里的数字三者一致
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]').length).toBe(2);
    expect(attr("kn3-docs", "data-len")).toBe("2");
    // 行数 < N：不渲染追加句
    expect(byTestid("kn3-page-cap-more")).toBeNull();
    // title：limit 写清；这份信封没给游标 → 「暂不支持翻页」，不编造翻页能力
    expect(attr("kn3-page-cap", "title")).toBe(
      `limit=${N}；上游回答没给可用的分页游标：暂不支持翻页，本页上限句不假装还有下一页。`,
    );
  });

  it("appends the maybe-more sentence exactly at the cap (M == N) and not below it", async () => {
    wireDocs({ asOf: "2026-11-19T08:00:00Z", documents: mkDocs(N) });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("kn3-page-cap-more")).toBeTruthy();
    expect((byTestid("kn3-page-cap-more")?.textContent ?? "")).toContain("可能还有更多，改用全库检索或收窄类型筛选");
    expect(capText()).toContain(`当前已加载 ${N} 篇`);
    wireDocs({ asOf: "2026-11-19T08:00:00Z", documents: mkDocs(N - 1) });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("kn3-page-cap-more")).toBeNull();
    expect(capText()).toContain(`当前已加载 ${N - 1} 篇`);
  });

  it("copy list row count == M == data-len == visible rows (one row set, three readings)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wireDocs({ asOf: "2026-11-19T08:00:00Z", documents: mkDocs(3) });
    await render("/knowledge?tab=spaces&space=sp_hr");
    await click("knF-copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    const lines = String(writeText.mock.calls[0][0]).split("\n");
    const dataLines = lines.length - 2; // 头行 + 尾换行
    expect(dataLines).toBe(3);
    expect(attr("kn3-docs", "data-len")).toBe(String(dataLines));
    expect(capText()).toContain(`当前已加载 ${dataLines} 篇`);
    expect(container.querySelectorAll('[data-testid="kn3-docs-row"]').length).toBe(dataLines);
  });

  it("empty / error / denied states render neither the cap nor the maybe-more sentence, and the cap adds zero requests", async () => {
    // 空集（ready 但 0 行）
    wireDocs({ asOf: "2026-11-19T08:00:00Z", documents: [] });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("kn3-page-cap")).toBeNull();
    expect(byTestid("kn3-page-cap-more")).toBeNull();
    // error（500）
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCS_SPACE) return fail(500, "上游读取失败。", "rid-r108-err");
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-r108");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("kn3-page-cap")).toBeNull();
    expect(byTestid("kn3-page-cap-more")).toBeNull();
    // denied（403≡404 口径）
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP);
      if (url === DOCS_SPACE) return fail(403, "没有权限读取这个空间。", "rid-r108-deny");
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ documents: [] });
      return fail(404, "这个数据接口还没有接入。", "rid-r108");
    });
    await render("/knowledge?tab=spaces&space=sp_hr");
    expect(byTestid("kn3-page-cap")).toBeNull();
    expect(byTestid("kn3-page-cap-more")).toBeNull();
    // 零额外请求：ready 态渲染后读口计数只 +1（详情自身的既有读取），后续只读动作零增量
    const beforeCap = urlsCalled().filter((x) => x === DOCS_SPACE).length;
    wireDocs({ asOf: "2026-11-19T08:00:00Z", documents: mkDocs(2) });
    await render("/knowledge?tab=spaces&space=sp_hr");
    const u = urlsCalled().slice().sort();
    expect(u.filter((x) => x === DOCS_SPACE)).toHaveLength(beforeCap + 1);
    expect(byTestid("kn3-page-cap")).toBeTruthy();
    await click("kn3-page-cap");
    expect(urlsCalled().slice().sort()).toEqual(u); // 上限句是纯文字：点它不发请求
  });
});

// ---------- R114：预览/命中展开块内的行复制（kn-doc-copy-*，单 helper 复用） ----------
describe("R114 — per-document row copy in preview surfaces (kn-doc-copy)", () => {
  const SP1 = {
    asOf: "2026-11-19T08:00:00Z",
    items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 1, status: "synced" }],
  };
  const wireList = (documents: unknown[]) =>
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(SP1);
      if (url === DOCS_SPACE || url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: "2026-11-19T08:00:00Z", documents });
      return fail(404, "这个数据接口还没有接入。", "rid-r114");
    });
  const expectCopyFlow = async (open: () => Promise<void>) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await open();
    await click("kn-doc-copy");
    expect(writeText).toHaveBeenCalledTimes(1);
    return String(writeText.mock.calls[0][0]);
  };

  it("the same document copies byte-identical text on both surfaces, equal to DOC_LINE_HEADER + docLine direct output", async () => {
    const RAW = { documentId: "d_manual", fileName: "员工手册.pdf", mimeType: "application/pdf", sizeBytes: 2516582, updatedAt: "2026-11-19T07:10:00Z" };
    wireList([RAW]);
    // 落点①：检索命中展开块（kn6-search-detail）
    await render("/knowledge?tab=spaces");
    await click("kn6-search-name");
    expect(byTestid("kn6-search-detail")).toBeTruthy();
    const fromSearch = await expectCopyFlow(async () => {});
    expect((byTestid("kn-doc-copy-status")?.textContent ?? "")).toBe("已复制");
    // 落点②：文档行内预览（kn-doc-preview）
    await render("/knowledge?tab=spaces&space=sp_hr");
    await click("kn-doc-preview-toggle");
    expect(byTestid("kn-doc-preview")).toBeTruthy();
    const fromPreview = await expectCopyFlow(async () => {});
    // 两处逐字相等，且等于走同一派生链（readSpaceDocuments→docSingleCopy）的直出
    expect(fromPreview).toBe(fromSearch);
    const derived = readSpaceDocuments({ asOf: "2026-11-19T08:00:00Z", documents: [RAW] });
    expect(fromSearch).toBe(docSingleCopy(derived.rows[0]));
    expect(fromSearch.split("\n")[0]).toBe(DOC_LINE_HEADER.join(" | "));
    expect(fromSearch.split("\n")[1].split(" | ")[4]).toBe(shortId("d_manual")); // 短码列同源
  });

  it("missing size / updated / type: both surfaces copy the same — columns, on-screen dd titles follow the same rules", async () => {
    const RAW = { documentId: "d_bare2", fileName: "缺项文档.pdf" };
    wireList([RAW]);
    await render("/knowledge?tab=spaces");
    await click("kn6-search-name");
    const fromSearch = await expectCopyFlow(async () => {});
    const searchCols = fromSearch.split("\n")[1].split(" | ");
    await render("/knowledge?tab=spaces&space=sp_hr");
    await click("kn-doc-preview-toggle");
    const fromPreview = await expectCopyFlow(async () => {});
    const previewCols = fromPreview.split("\n")[1].split(" | ");
    expect(fromPreview).toBe(fromSearch);
    // 名在场、类型/大小/更新三列皆「—」（缺值不补 0 不猜）
    expect(previewCols[0]).toBe("缺项文档.pdf");
    expect(previewCols.slice(1, 4)).toEqual(["—", "—", "—"]);
    expect(searchCols).toEqual(previewCols);
    // 屏上 title 同规则：两处「更新」缺值都走 previewField 同一 hint 句式（R70 口径）
    const previewUpdated = byTestid("kn-doc-preview-updated");
    expect(previewUpdated?.getAttribute("title") ?? "").toContain("上游没有给出更新时间");
  });

  it("clipboard rejection: both surfaces fall back to a read-only textarea whose value is byte-equal to the target string", async () => {
    const RAW = { documentId: "d_rej", fileName: "拒写文档.pdf", mimeType: "pdf", sizeBytes: 10, updatedAt: "2026-11-19T07:00:00Z" };
    wireList([RAW]);
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const texts: string[] = [];
    await render("/knowledge?tab=spaces");
    await click("kn6-search-name");
    await click("kn-doc-copy");
    await act(async () => {});
    const ta1 = byTestid("kn-doc-copy-fallback") as HTMLTextAreaElement | null;
    expect(ta1).toBeTruthy();
    expect(ta1?.readOnly).toBe(true);
    texts.push(ta1?.value ?? "");
    expect((byTestid("kn-doc-copy-status")?.textContent ?? "")).toContain("剪贴板没接受");
    await render("/knowledge?tab=spaces&space=sp_hr");
    await click("kn-doc-preview-toggle");
    await click("kn-doc-copy");
    await act(async () => {});
    const ta2 = byTestid("kn-doc-copy-fallback") as HTMLTextAreaElement | null;
    expect(ta2).toBeTruthy();
    texts.push(ta2?.value ?? "");
    expect(texts[0]).toBe(texts[1]); // 两处兜底逐字同
    expect(texts[0].split("\n")).toHaveLength(3); // 表头 + 行 + 尾换行
  });

  it("empty row (no name, no id): copy is disabled with an honest title; and the whole flow adds zero requests", async () => {
    wireList([{ mimeType: "pdf", sizeBytes: 10 }]);
    await render("/knowledge?tab=spaces");
    const c0 = fetchMock.mock.calls.length;
    const u0 = urlsCalled().slice().sort().join("|");
    await click("kn6-search-name");
    const btn = byTestid("kn-doc-copy") as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.disabled).toBe(true);
    expect(btn?.getAttribute("title")).toBe("这一行没有可复制的文档内容：文档名与标识都没给出。");
    await click("kn6-search-input"); // 点到无关处也不发请求（输入框自身只读本地）
    expect(fetchMock.mock.calls.length).toBe(c0);
    expect(urlsCalled().slice().sort().join("|")).toBe(u0);
  });
});

// ---------- R132：两张文档表的行末复制（列表级，kn-row-copy*） ----------
describe("R132 — list row copy (kn-row-copy / kn-row-copy-space)", () => {
  const R132_SP = {
    asOf: "2026-11-19T08:00:00Z",
    items: [{ spaceId: "sp_hr", name: "人事制度空间", docCount: 2, status: "synced" }],
  };
  const D1 = { documentId: "d_a", fileName: "A 手册.pdf", mimeType: "application/pdf", sizeBytes: 2048, updatedAt: "2026-11-19T07:00:00Z" };
  const D2 = { documentId: "d_b", fileName: "B 表.xlsx", mimeType: "xlsx", sizeBytes: 1024, updatedAt: "2026-11-19T06:00:00Z" };
  const EMPTY = { mimeType: "pdf", sizeBytes: 9 }; // 无名无标识：不可复制行
  const wire132 = () =>
    fetchMock.mockImplementation((url: string) => {
      if (url === SPACES) return Promise.resolve(R132_SP);
      if (url === DOCUMENTS_PLAIN) return Promise.resolve({ asOf: R132_SP.asOf, documents: [D1, D2, EMPTY] });
      if (url === docsUrlFor("sp_hr")) return Promise.resolve({ asOf: R132_SP.asOf, documents: [D1, D2, EMPTY] });
      return fail(404, "这个数据接口还没有接入。", "rid-r132");
    });
  const clickNode = async (node: Element | null, label: string) => {
    expect(node, label).toBeTruthy();
    await act(async () => {
      node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
  };
  const qd = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);

  it("row copy text is byte-identical to the preview/expand kn-doc-copy for the same document, both tables", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire132();
    const DETAIL = "/knowledge?tab=spaces&space=sp_hr";
    await render(DETAIL);
    // 检索表首行（主 tab 原名 id）
    await clickNode(container.querySelector('[data-testid="kn-row-copy-0"]'), "kn-row-copy-0");
    expect(writeText).toHaveBeenCalledTimes(1);
    const searchLine = String(writeText.mock.calls[0][0]);
    // 同文档在命中展开块里经 kn-doc-copy 复制：逐字等
    await click("kn6-search-name");
    await click("kn-doc-copy");
    expect(String(writeText.mock.calls[1][0])).toBe(searchLine);
    // 详情表首行（-space- 后缀）与行内预览 kn-doc-copy 对同文档逐字等
    const rowA = [...container.querySelectorAll('[data-testid="kn3-docs-row"]')].find((r) => (r.textContent ?? "").includes("A 手册.pdf"))!;
    await clickNode(rowA.querySelector('[data-testid="kn-row-copy-space-0"]') ?? rowA.querySelector('button[data-testid^="kn-row-copy-space-"]'), "space row copy A");
    const detailLine = String(writeText.mock.calls[2][0]);
    await clickNode(rowA.querySelector('[data-testid="kn-doc-preview-toggle"]'), "preview open");
    await click("kn-doc-copy");
    expect(String(writeText.mock.calls[3][0])).toBe(detailLine);
    // 表头 + 单行 + 尾换行的骨架
    expect(searchLine.split("\n")).toHaveLength(3);
    expect(searchLine.split("\n")[0]).toBe("文档名 | 类型 | 大小 | 更新 | 短码");
    expect(detailLine.split("\n")[1]).toContain("A 手册.pdf");
  });

  it("index follows the sorted/filtered visible order; both surfaces coexist same-screen with distinct ids", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire132();
    await render("/knowledge?tab=spaces&space=sp_hr");
    // 同屏共存：检索表 kn-row-copy-0 与详情表 kn-row-copy-space-* 互不吞并
    expect(qd("kn-row-copy-0")).toBeTruthy(); // 检索表在主 tab 顶部同屏在场
    expect(container.querySelector('[data-testid^="kn-row-copy-space-"]')).toBeTruthy();
    // 排序切换（updated 三态两击换向）：首行换了人，0 号按钮的文本跟着新首行走
    const tr0 = () =>
      (container.querySelector('button[data-testid="kn-row-copy-space-0"]')?.closest("tr")?.textContent ?? "").slice(0, 12);
    const firstBefore = tr0();
    expect(firstBefore).toContain("A 手册"); // 默认 updated/desc：07:00 在前
    // 一击换 asc：06:00 在前、缺时仍垫底（missing-last）；0 号按钮的文本跟着新首行走
    await click("kn-sort-updated");
    expect(tr0()).toContain("B 表");
    await clickNode(container.querySelector('button[data-testid="kn-row-copy-space-0"]'), "copy first in asc");
    const lineAsc = String(writeText.mock.calls.at(-1)?.[0] ?? "");
    expect(lineAsc.split("\n")).toHaveLength(3); // 表头 + 单行 + 尾换行
    expect(lineAsc.split("\n")[1].startsWith("B 表.xlsx")).toBe(true);
    // 二击回 desc：0 号又指向另一文档（编号随可见行序重排，不钉死文档）
    await click("kn-sort-updated");
    expect(tr0()).toContain("A 手册");
    await clickNode(container.querySelector('button[data-testid="kn-row-copy-space-0"]'), "copy first in desc");
    expect(String(writeText.mock.calls.at(-1)?.[0] ?? "").split("\n")[1].startsWith("A 手册.pdf")).toBe(true);
  });

  it("clipboard rejection: fallback textarea is byte-equal to the target and read-only; empty rows disabled with honest title; zero requests throughout", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wire132();
    await render("/knowledge?tab=spaces&space=sp_hr");
    const c0 = fetchMock.mock.calls.length;
    const u0 = urlsCalled().slice().sort().join("|");
    await clickNode(container.querySelector('[data-testid="kn-row-copy-1"]'), "search row 1"); // d_b：可复制
    await act(async () => {});
    const status = container.querySelector('[data-testid="kn-row-copy-status"]');
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect((status?.textContent ?? "")).toContain("剪贴板没接受");
    const ta = container.querySelector('[data-testid="kn-row-copy-fallback"]') as HTMLTextAreaElement | null;
    expect(ta).toBeTruthy();
    expect(ta?.readOnly).toBe(true);
    expect(ta?.value.split("\n")[1]).toContain("B 表.xlsx");
    // 空行（无名无标识）：两表都 disabled + 具体 title
    const emptyBtnSearch = [...container.querySelectorAll('button[data-testid^="kn-row-copy-"]')].find(
      (b) => b.getAttribute("data-testid") === "kn-row-copy-2",
    ) as HTMLButtonElement | undefined;
    expect(emptyBtnSearch?.disabled).toBe(true);
    expect(emptyBtnSearch?.getAttribute("title")).toBe("这一行没有可复制的文档内容：文档名与标识都没给出。");
    const emptyBtnSpace = [...container.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')].find(
      (b) => (b as HTMLButtonElement).disabled,
    ) as HTMLButtonElement | undefined;
    expect(emptyBtnSpace?.getAttribute("title")).toBe("这一行没有可复制的文档内容：文档名与标识都没给出。");
    // 全程零请求：复制、拒写、fallback 在场，fetch 计数与 urls 快照逐字不变
    expect(fetchMock.mock.calls.length).toBe(c0);
    expect(urlsCalled().slice().sort().join("|")).toBe(u0);
  });
});
