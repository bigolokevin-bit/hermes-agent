// R236 — 抽屉开合三帧导出等值 × 怪名三载体原样 × 空集文案两分支（纯测试单：零产品改动）。
// 名实换算（产品定版，禁造控件/禁改产品）：
// · 无真 CSV（源级 createObjectURL/text/csv/download=/new Blob( 全 0 + absent 标记——
//   R190①:113-119 源码级不变量）→「导出」= knF（详情面 5 列）/knG（检索面 6 列，
//   所属空间@2）复制器数据行；createObjectURL 全程 spy 0。
// · 「详情打开态」= kn7 抽屉（?doc=，无独立路由）；开**恰 +1 既存详情读**、关 0
//   （R49/R196/R233②）——腿①不宣称全零：列表请求集合逐字 + 详情读增量如实写出。
// · 腿②「RFC4180 往返」**不可兑现**：产品无 CSV 序列化、纯文本拼接——按实断言
//   含逗号/引号/换行的文档名在 列表格×行钮串×knF 行×knG 行 **原样逐字**（无引号
//   翻倍、无截断），并锁换行致物理行数 +1 的后果事实（R190①:136-138 先例）；
//   **将来落 CSV 转义时本组断言应转红**（哨兵声明，文件头+证据双记）。
// · 腿③「cap 显 0」按实 **null**（true-0：R108/R157/R187/R231②；本轮新锁：文案两
//   分支判别——服务端空集走「接口回答里没有文档」句、名筛清零走「本地筛选没有留下行」
//   句（copyGates :127-130 三元两翼），各帧各书 + 各自 cap null + 零写；两串互异即
//   「不编原因」的判别锁）。禁假 0 与裸「0 条/0 篇/0 个」（R215②:111 同法）。
// 缺值两口径不涉本轮；行钮分面 -space-/检索面（R132/R169）；clip 桩 mockResolvedValue
// + unstubAllGlobals（R214 教训，Errors 0）。
// 查重（引用不重写）：R190①:113-142（怪名**行钮单载体**原样+无翻倍+行数后果——三面
// 互等与检索面未锁）、R230①/②（开帧三值/换档 +1）、R233②（开→关双帧——**重开第三帧
// 未锁**）、R190④/R231②（空集门 with 「没有可复制」共同尾——**两翼判别句未分锁**）、
// R234③/R235③（筛空门与 cap null——叠加态位）、R200②/R209/R223/R214②/R232。
// 新增维（点名）：A 开→关→**重开**三帧导出全文逐字等值 + 详情读总数恰 2（每次开 +1）
//   + 列表读集合全程逐字；B 怪名**三载体互等**（格/行钮/knF）+ **检索面 knG 原样与
//   物理行数后果**（R190 详情面地盘外首次跨面）；C 空集**文案两分支判别**（接口句 vs
//   筛句互不冒充 + 各自 cap null + 零写零请求）。
// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchMock = vi.fn();
vi.mock("@/modules/models/fetchJson", () => ({
  fetchJsonStrict: (url: string) => fetchMock(url),
}));

import KnowledgeModulePage from "./KnowledgeModulePage";

const SPACES = "/agent-api/api/knowledge/spaces?limit=20";
const DOCUMENTS_PLAIN = "/agent-api/api/documents?limit=50";
const docsUrlFor = (id: string) => `/agent-api/api/documents?limit=50&spaceId=${id}`;
const P1URL = docsUrlFor("sp_x");
const DETAIL = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

function fail(status: number, message: string, requestId?: string): Promise<never> {
  return Promise.reject(new ApiError(message, { status, body: "", url: "/agent-api/api/test", requestId }));
}

function LocationProbe(): ReactNode {
  return createElement("div", { "data-testid": "loc" }, useLocation().search);
}

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(path = "/knowledge") {
  act(() => root.unmount());
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(KnowledgeModulePage),
        createElement(LocationProbe),
      ),
    );
  });
  await act(async () => {});
}

async function clickNode(node: Element | null | undefined, label: string) {
  expect(node, label).toBeTruthy();
  await act(async () => {
    (node as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const q = (testid: string) => document.querySelector(`[data-testid="${testid}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const loc = () => txt(q("loc"));
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const listUrls = () => urls().filter((u) => !u.startsWith("/agent-api/api/documents/d_")).join("|");
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const openDrawer = async (label: string) => {
  await clickNode(
    rowNodes().find((r) => (r.textContent ?? "").includes(label))?.querySelector('[data-testid="kn3-docs-name"]'),
    `open drawer ${label}`,
  );
};
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  const createObjectUrl = vi.fn();
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true, writable: true });
  return { writeText, createObjectUrl };
};

const N1 = { documentId: "d_n1", fileName: "正常甲.pdf", mimeType: "pdf", sizeBytes: 1024, updatedAt: "2026-11-19T07:00:00Z" };
const N2 = { documentId: "d_n2", fileName: "正常乙.pdf", mimeType: "pdf", sizeBytes: 2048, updatedAt: "2026-11-19T06:00:00Z" };
const WEIRD_NAME = '报,告"怪名"\n第二行.pdf';
const W = { documentId: "d_w", fileName: WEIRD_NAME, mimeType: "pdf", sizeBytes: 4096, updatedAt: "2026-11-19T08:00:00Z" };
const SP = { asOf: "2026-11-19T09:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 2, status: "synced" }] };
const wire = (docs: unknown[]) =>
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    if (url === DOCUMENTS_PLAIN || url === P1URL) return Promise.resolve({ asOf: SP.asOf, documents: docs });
    if (url.startsWith("/agent-api/api/documents/d_")) return Promise.resolve({ sourceName: "原件", status: "indexed" });
    return fail(404, "这个数据接口还没有接入。", "rid-r236-x");
  });

describe("knowledge export open/detail guards (R236)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("① 开→关→重开三帧：导出全文逐字等值 + 详情读总数恰 2、列表读集合全程逐字（新增维A；开帧三值引 R233②不复写）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire([N1, N2]);
    const detail1 = "/agent-api/api/documents/d_n1";
    await render(DETAIL);
    const list0 = listUrls();
    await openDrawer("正常甲.pdf");
    expect(loc()).toContain("doc=d_n1");
    await clickNode(q("knF-copy"), "knF frame-open");
    const textOpen = String(writeText.mock.calls[0][0]);
    await clickNode(q("kn7-preview-close"), "close");
    expect(loc()).not.toContain("doc=");
    await clickNode(q("knF-copy"), "knF frame-closed");
    const textClosed = String(writeText.mock.calls[1][0]);
    // 重开（第三帧，R233② 未测位）：再恰 +1 详情读
    await openDrawer("正常甲.pdf");
    await clickNode(q("knF-copy"), "knF frame-reopen");
    const textReopen = String(writeText.mock.calls[2][0]);
    expect(textClosed).toBe(textOpen);
    expect(textReopen).toBe(textOpen); // 三帧导出逐字等值
    expect(urls().filter((u) => u === detail1)).toHaveLength(2); // 每次开恰 1，关 0
    expect(listUrls()).toBe(list0); // 列表读集合全程逐字（不宣称全零——详情读 +2 如实）
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("② 怪名三载体互等（新增维B）：格/行钮/knF/knG 原样逐字、无翻倍无截断、检索面物理行数后果入锁（R190① 单载体面跨三面）", async () => {
    const { writeText, createObjectUrl } = clipStub();
    wire([W, N1]);
    await render(DETAIL);
    // 载体1：列表格（文本折叠空白但内容不丢——R190①:140 同法）
    expect(txt(container)).toContain("报,告");
    expect(txt(container)).toContain("第二行.pdf");
    // 载体2：详情面行钮串
    await clickNode(q("kn-row-copy-space-0"), "row btn weird");
    const btnText = String(writeText.mock.calls[0][0]);
    expect(btnText).toContain(WEIRD_NAME); // 含真实换行的原名逐字
    expect(btnText).not.toContain('""'); // 无 RFC4180 引号翻倍（无转义的事实；将来落 CSV 此组转红）
    // 载体3：knF 清单行
    await clickNode(q("knF-copy"), "knF weird");
    const fText = String(writeText.mock.calls[1][0]);
    expect(fText).toContain(WEIRD_NAME);
    expect(fText).not.toContain('""');
    // 载体4（跨面新位）：检索面 knG 6 列同样原样 + 物理行数后果（表头1+怪名2+正常1+尾空1=5）
    await clickNode(q("knG-copy"), "knG weird");
    const gText = String(writeText.mock.calls[2][0]);
    expect(gText).toContain(WEIRD_NAME);
    expect(gText).not.toContain('""');
    expect(gText.split("\n")).toHaveLength(5); // 换行不折叠的构造事实（R190①:137 详情版跨到检索面）
    expect(gText.split("\n").filter((l) => l.includes(" | ")).length).toBeLessThan(5); // 被换行打散的行如实存在
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("③ 空集文案两分支判别（新增维C）：服务端空=「接口回答里没有文档」句 × 名筛空=「本地筛选没有留下行」句，各帧 cap null+零写零请求+两翼互不冒充", async () => {
    const { writeText, createObjectUrl } = clipStub();
    // (a) 服务端空集帧（R190④/R231② 锁过共同尾「没有可复制」与门——本例锁**判别句头**）
    wire([]);
    await render(DETAIL);
    const a = q("knF-copy") as HTMLButtonElement | null;
    expect(a?.disabled).toBe(true);
    const ta = a?.getAttribute("title") ?? "";
    expect(ta).toContain("接口回答里没有文档");
    expect(ta).not.toContain("本地筛选没有留下行"); // 不冒充筛因
    expect(q("kn3-page-cap")).toBeNull(); // true-0 不渲染（引 R108/R157/R187/R231②）
    const u0 = urls().length;
    await clickNode(a, "click server-empty");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(u0);
    // (b) 名筛清零帧（叠加版引 R234③/R235③——本例纯名筛判别位）
    wire([N1, N2]);
    await render(DETAIL);
    const box = q("kn3-docs-filter-input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(box, "火星不存在");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {});
    const b = q("knF-copy") as HTMLButtonElement | null;
    expect(b?.disabled).toBe(true);
    const tb = b?.getAttribute("title") ?? "";
    expect(tb).toContain("本地筛选没有留下行");
    expect(tb).not.toContain("接口回答里没有文档"); // 不冒充服务端空
    expect(q("kn3-page-cap")).toBeNull(); // 纯名筛空帧 cap 现状（与 R235 叠加版同向，帧型独立入锁）
    expect(container.textContent ?? "").not.toMatch(/(^|[^0-9.])0\s*(条|篇|个)/); // 禁假 0
    const u1 = urls().length;
    await clickNode(b, "click filter-empty");
    expect(writeText).not.toHaveBeenCalled();
    expect(urls().length).toBe(u1);
    expect(createObjectUrl).not.toHaveBeenCalled(); // 全轮 blob 零调用（R190① 不变量收口）
  });
});
