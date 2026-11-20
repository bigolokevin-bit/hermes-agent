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
import { shortId } from "./knowledge";

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
    const link = rows[0]?.querySelector('[data-testid="knw5-space-link"]') as HTMLAnchorElement | null;
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
      const sel = id === "knw5-space-name" ? "[data-testid='knw5-space-link'],[data-testid='knw5-space-name']" : `[data-testid="${id}"]`;
      return (rows[i]?.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
    };

    // 来源人话：直给的名字、认得出的工具、只有链接时给主机名
    expect(cell(0, "knw5-space-name")).toContain("人事制度空间");
    // 有标识的空间行是真实可聚焦链接，点进去就是这个空间的文档列表
    const link0 = rows[0]?.querySelector('[data-testid="knw5-space-link"]') as HTMLAnchorElement | null;
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
    const nameless = rows[5]?.querySelector('[data-testid="knw5-space-link"]');
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
    expect(bodyOf(gone)).toContain("证据与引用");
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
    expect(r1.querySelector('[data-testid="kn6-search-updated"]')?.getAttribute("title")).toBeNull();
    expect(r2.querySelector('[data-testid="kn6-search-updated"]')?.getAttribute("title")).toBe("上游没有给出更新时间");

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
    expect(bare.querySelector('[data-testid="kn3-docs-updated"]')?.getAttribute("title")).toBe("上游没有给出更新时间");
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
    const link0 = rows[0]?.querySelector('[data-testid="knw5-space-link"]');
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
    const anchors = [...container.querySelectorAll('a[data-testid="knw5-space-link"]')] as HTMLAnchorElement[];
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
    const all = [...container.querySelectorAll('a[data-testid="knw5-space-link"]')] as HTMLAnchorElement[];
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
    await click("knw5-space-link");
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
});
