// R267 — knE-page-stale / knE-page-reload × 导出一致性（纯测试单：零产品改动，未造控件）。
// 查重（派工必做第一步，实测）：R266 `knowledge.stale.reload.test.tsx` 已锁——
//   ① 回放首页=stale：面板 + -more disabled「游标已过期」+ 行数不增 + 三值 50 + cap「已加载 50 篇」(:125-142)；
//   ② 点 knE-page-reload：增量恰 1、URL==P1 无 cursor=、stale 消、恢复可用、行仍 50、三值 50==50==50、blob spy 0(:144-163)；
//   ③ reload 整表重读 500=换错误帧：行 0/钮 0/cap null/rid 逐字/knF disabled/重试恰 +1/导出 toBe 失败前快照(:165-210)。
// 本单只补 R266 未锁的角落，三条腿各自点名新增维：
//   腿① 换代零残留：R266② 只测「reload 仍回同一集」；本腿夹具让 reload 的第 1 页返回**另一代集合**
//     （旧代 50 行→新代 30 行），断言旧代名/id/码在屏上、导出链、钮串三处 0 出现 + 新集逐行同源 +
//     cap/分页钮随新集如实 + cursor 不入 URL。实测产品 reload=整表替换（baseRows 随 state.value 换代，
//     累加页/游标/stale 由 :2336-2345 效果清零）→ 零残留成立，按实写死（不是「回同一集」的复述）。
//     检索面读口另给一枚「基准卷」中立行，使「旧代」串只可能来自重载窗残留，屏上残留扫描才有判据力。
//   腿② 重载进行中帧：产品**无 knE-page-loading 锚**（git grep 0 命中，派工前提属实）；实测中间帧
//     knF 非 0 节点——复制条四态常在（:2730 起）——而是 disabled + loading 逐字句；同帧表体面在
//     Surface(:411) 下换成骨架 kn3-docs-loading、kn3-docs[data-state=loading][data-len=0]、
//     分页条/上限句/stale 面板整体出局（render 仅 ready 才挂 :471）；表头条禁用逐字句
//     「空间文档列表还在读取，行读到了才能排。」与 knF loading 逐字句、data-retry-enabled=false
//     均**全库 0 锁**（grep 实测）→ 本腿捕获成功（用挂起 Promise 造在飞帧），非「不可捕获」降级声明。
//   腿③ 失败帧裁决：本轮实测与 R266③ **完全一致**（行 0/钮 0/cap null/disabled/rid/重试 +1），
//     该些维度按派工 (a) 记引用——knowledge.stale.reload.test.tsx:165-210，不重写；
//     新增维 (b)：失败帧内 knF **gate 逐字三件套**从未锁——R266③:188 只断 disabled，
//     title「这次没有读到文档列表，没有可复制的内容。」虽在别面错帧锁过
//     （knowledge.space.export.test.tsx:229），但 stale→reload 组合帧内的
//     title/knF-lines「—」+其 title/状态句「当前不可复制：这次读取没有成功」/marker
//     data-enabled·data-reason·data-retry-enabled·data-export/兜底不渲染/表头条错帧逐字句
//     在此组合帧 0 锁 → 本腿只钉这一角落。禁把「保旧行」写进 reload 窗（那是 P2 窗语义
//     R131③:141-163/R239③ knowledge.export.detail.paging.test.tsx:180-222，导出侧并置亦已被
//     R239③ 锁死 textWin toBe 窗前 + 逐行==屏上，本单不重复）。
// 红线合规：无 ?source=/?preview=；「导出」=knF 数据行（docCopyText 5 列），源级 createObjectURL/
// text/csv/a.download/new Blob 0、仅 absent 标记，blob spy 全程 0；行钮详情面 kn-row-copy-space-<i>；
// kn3-page-cap=50 常量槽 + 「已加载 M 篇」可变位，error 帧 null（非 0）；cursor 只在组件态、
// 一律从请求 URL 断言；涉整页用 50 行夹具（DOCUMENTS_LIMIT=50）+ 30 行新代集；缺值两套口径不统一
// （表/复制行「—」）；短码=大写尾段、全 id 仅 title（残留扫描同查）；clip 桩
// vi.fn().mockResolvedValue(undefined) + afterEach vi.unstubAllGlobals()（R214 教训，Errors 0）。
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
const P1URL = "/agent-api/api/documents?limit=50&spaceId=sp_x";
const P2URL = `${P1URL}&cursor=cpg2`;
const BASE = "/knowledge?tab=spaces&panel=spaces&space=sp_x";

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
const attr = (testid: string, name: string) => q(testid)?.getAttribute(name) ?? null;
const urls = () => fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
const rowNodes = () => [...document.querySelectorAll('[data-testid="kn3-docs-row"]')];
const rowNames = () => rowNodes().map((r) => txt(r.querySelector('[data-testid="kn3-docs-name"]')));
const rowIds = () => rowNodes().map((r) => String(r.getAttribute("title") ?? ""));
const copyBtns = () => [...document.querySelectorAll('button[data-testid^="kn-row-copy-space-"]')];
const btnCount = () => copyBtns().length;
const btnIds = () => copyBtns().map((b) => String(b.getAttribute("data-testid")));
const dataLines = (text: string) => text.split("\n").slice(1, -1);
const nameCol = (line: string) => line.split(" | ")[0];
const clipStub = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(window.URL, "createObjectURL", { value: vi.fn(), configurable: true, writable: true });
  return writeText;
};
const blobSpy = () => window.URL.createObjectURL as unknown as ReturnType<typeof vi.fn>;

const pad = (i: number) => String(i + 1).padStart(2, "0");
// 旧代=重载前第 1 页（满页 50，DOCUMENTS_LIMIT）；新代=reload 后的第 1 页（30，末页）。
// 名/id 前缀逐代互斥：旧代专有名「旧代卷」、标识「r267a-」、码尾「A01」不得出现在屏上/导出链/钮串。
const GEN_OLD = Array.from({ length: 50 }, (_, i) => ({
  documentId: `r267a-${pad(i)}`,
  fileName: `旧代卷 ${pad(i)}.pdf`,
  mimeType: "pdf",
  sizeBytes: 100 + i,
  updatedAt: `2026-11-1${(i % 9) + 1}T07:00:00Z`,
}));
const GEN_NEW = Array.from({ length: 30 }, (_, i) => ({
  documentId: `r267b-${pad(i)}`,
  fileName: `新代卷 ${pad(i)}.pdf`,
  mimeType: "pdf",
  sizeBytes: 500 + i,
  updatedAt: `2026-11-2${(i % 9) + 1}T07:00:00Z`,
}));
const SP = { asOf: "2026-11-19T08:00:00Z", items: [{ spaceId: "sp_x", name: "测试空间", docCount: 120, status: "synced" }] };

// 第 1 次 P1=旧代 + 游标 cpg2；P2 回放旧代 50 行（全命中 seen）→ 产品判 stale；
// 第 2 次 P1（=点 knE-page-reload 的整表重读）按 mode 换代：new=新代 30 行末页 / hold=在飞挂起 / boom=500。
function wireMode(mode: "new" | "hold" | "boom", onHold?: (release: () => void) => void) {
  let p1 = 0;
  fetchMock.mockImplementation((url: string) => {
    if (url === SPACES) return Promise.resolve(SP);
    // 检索面（文档名搜索读口）给独立的基准行：名/标识与两代集合互斥，
    // 这样「旧代」串只可能来自重载窗的换代残留，屏上残留扫描才有判据力。
    if (url === DOCUMENTS_PLAIN)
      return Promise.resolve({
        asOf: SP.asOf,
        documents: [{ documentId: "r267z-01", fileName: "基准卷 01.pdf", mimeType: "pdf", sizeBytes: 9, updatedAt: "2026-11-10T07:00:00Z" }],
      });
    if (url === P1URL) {
      p1 += 1;
      if (p1 === 1) return Promise.resolve({ asOf: SP.asOf, documents: GEN_OLD, nextCursor: "cpg2" });
      if (mode === "boom") return fail(500, "上游读取失败，请稍后重试。", "rid-r267-p1");
      const page = Promise.resolve({ asOf: SP.asOf, documents: GEN_NEW, nextCursor: null });
      if (mode === "hold") {
        return new Promise<unknown>((resolve) => {
          onHold?.(() => resolve({ asOf: SP.asOf, documents: GEN_NEW, nextCursor: null }));
        });
      }
      return page;
    }
    if (url === P2URL) return Promise.resolve({ asOf: SP.asOf, documents: GEN_OLD, nextCursor: "cpg3" });
    return fail(404, "这个数据接口还没有接入。", "rid-r267-x");
  });
}

const NEW_NAMES = GEN_NEW.map((d) => d.fileName);

describe("knowledge stale reload export consistency (R267)", () => {
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

  it("① 换代零残留（新增维：R266② 只锁同集合 reload；本腿 reload 回**另一代 30 行集**）：旧代名/id/码在屏上·导出链·钮串三处 0 出现 + 新集逐行同源 + 三值 30==30==30 + cap/分页钮随新集如实 + cursor 不入 URL + blob spy 0", async () => {
    const writeText = clipStub();
    wireMode("new");
    await render(BASE);
    await clickNode(q("knE-page-more"), "P2 replay -> stale");
    expect(q("knE-page-stale")).toBeTruthy();
    expect(rowNames().every((n) => n.startsWith("旧代卷"))).toBe(true);
    const u0 = urls().length;
    await clickNode(q("knE-page-reload"), "reload -> new generation");
    // 整表重读走 P1（URL 实检 cursor），增量恰 1（引 R266② 同式，本腿只作换代前置）
    expect(urls().length).toBe(u0 + 1);
    expect(urls().at(-1)).toBe(P1URL);
    expect(urls().at(-1)).not.toContain("cursor");
    expect(q("knE-page-stale")).toBeNull();
    // —— 零残留（屏上）：旧代专有名不落任何文字角落，旧代标识不落行 title（全 id 仅 title 口径）。
    // 屏上序=默认排序口径，本身由 R256/R263 锁；本腿锁「集合=新集 + 逐行同源」（换代维与序无关）。
    expect([...rowNames()].sort()).toEqual([...NEW_NAMES].sort());
    expect(rowNames()).toHaveLength(30);
    expect(document.body.textContent ?? "").not.toContain("旧代");
    expect(rowIds().filter((t) => t.includes("r267a-"))).toHaveLength(0);
    expect(rowIds().every((t) => t.startsWith("r267b-"))).toBe(true);
    // —— 零残留（钮串）：行钮恰 0..29 一枚一行，不残留旧代序号位
    expect(btnIds()).toEqual(GEN_NEW.map((_, i) => `kn-row-copy-space-${i}`));
    // —— 零残留（导出链）：数据行逐行==屏上名序，旧代名/标识/码尾 0 出现
    await clickNode(q("knF-copy"), "export after generation swap");
    const text = String(writeText.mock.calls.at(-1)![0]);
    const lines = dataLines(text);
    expect(lines.map(nameCol)).toEqual(rowNames());
    expect(text).not.toContain("旧代");
    expect(text).not.toContain("r267a");
    expect(text).not.toContain("A01"); // 短码=大写尾段（旧代号尾不得在）
    // —— 三值同源随新集：表体行数==行钮数==导出行数（R266② 锁 50，本腿锁 30 换代值）
    expect([rowNodes().length, btnCount(), lines.length]).toEqual([30, 30, 30]);
    // —— cap 如实：可变位=新集 30，未达 50 上限即不挂「可能还有更多」
    expect(txt(q("kn3-page-cap"))).toContain("当前已加载 30 篇");
    expect(q("kn3-page-cap-more")).toBeNull();
    expect(txt(q("knE-page-count"))).toContain("30");
    // —— 分页钮随新集改口：新信封 nextCursor=null 且游标字段在场=真末页（非 stale 禁用句残留）
    const more = q("knE-page-more") as HTMLButtonElement | null;
    expect(more?.disabled).toBe(true);
    expect(txt(more)).toBe("已到末页");
    expect(q("knE-page-end")).toBeTruthy();
    // —— 导出可用且 enabledTitle 读数随新集
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(false);
    expect(attr("knF-copy", "title")).toContain("当前已加载 30 条");
    expect(blobSpy()).not.toHaveBeenCalled();
  });

  it("② 重载在飞帧（现场实测：无 knE-page-loading 锚；knF **非 0 节点**=复制条常在而 disabled）：中间帧逐字 loading 句 + lines「—」+ marker 三态 + 骨架 data-state=loading + 表体/分页条/上限句/stale 面板出局 → 释放后完成瞬间恢复可用且内容=新集零残留", async () => {
    const writeText = clipStub();
    let release: (() => void) | null = null;
    wireMode("hold", (rel) => {
      release = rel;
    });
    await render(BASE);
    await clickNode(q("knE-page-more"), "make stale");
    expect(q("knE-page-stale")).toBeTruthy();
    const u0 = urls().length;
    // 只派发点击、不等回答：在飞帧可捕获（挂起 Promise），无需降级为「不可捕获」声明
    await act(async () => {
      (q("knE-page-reload") as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(urls().length).toBe(u0 + 1);
    expect(urls().at(-1)).toBe(P1URL);
    // —— knF 裁决：中间帧在场（四态常在），是 disabled 不是未挂载
    const knf = q("knF-copy") as HTMLButtonElement | null;
    expect(knf).toBeTruthy();
    expect(knf?.disabled).toBe(true);
    expect(knf?.getAttribute("title")).toBe("文档列表还在读取，还没有可复制的内容。"); // loading 逐字句（全库首锁）
    expect(txt(q("knF-lines"))).toBe("—");
    expect(attr("knF-lines", "title")).toBe("没有可数条目时给「—」，不写 0 冒充空集。");
    expect(txt(q("knF-copy-status"))).toBe("当前不可复制：列表还在读取");
    expect(attr("kn-gates-knF", "data-enabled")).toBe("false");
    expect(attr("kn-gates-knF", "data-reason")).toBe("列表还在读取");
    expect(attr("kn-gates-knF", "data-retry-enabled")).toBe("false"); // loading 窗内重试也禁（逐字句首锁）
    expect(attr("kn-gates-knF", "data-export")).toBe("absent");
    expect(q("knF-fallback")).toBeNull();
    // —— 列表面：骨架在位，行数 0，data-state 实检；表体面/分页条/上限句/stale 面板整体出局
    expect(attr("kn3-docs", "data-state")).toBe("loading");
    expect(attr("kn3-docs", "data-len")).toBe("0");
    expect(q("kn3-docs-loading")).toBeTruthy();
    expect(q("kn3-docs-loading")?.getAttribute("aria-busy")).toBe("true");
    expect(rowNodes()).toHaveLength(0);
    expect(q("knE-page-bar")).toBeNull();
    expect(q("knE-page-stale")).toBeNull(); // stale 面板随代次即刻作废，不等成功帧
    expect(q("kn3-page-cap")).toBeNull();
    // —— 表头条禁用逐字句（loading 分支全库 0 锁 → 本腿钉死）
    expect(q("kn3-docs-head-strip")).toBeTruthy();
    expect((q("kn-sort-name") as HTMLButtonElement | null)?.disabled).toBe(true);
    expect(attr("kn-sort-name", "title")).toBe("空间文档列表还在读取，行读到了才能排。");
    expect(blobSpy()).not.toHaveBeenCalled();
    // —— 释放：完成瞬间 knF 恢复可用且内容=新集（本腿的完成面断言与腿①互补：同帧捕获下换代）
    await act(async () => {
      release?.();
    });
    await act(async () => {});
    expect(q("kn3-docs-loading")).toBeNull();
    expect((q("knF-copy") as HTMLButtonElement | null)?.disabled).toBe(false);
    expect([...rowNames()].sort()).toEqual([...NEW_NAMES].sort());
    expect(document.body.textContent ?? "").not.toContain("旧代");
    writeText.mockClear();
    await clickNode(q("knF-copy"), "export at completion");
    expect(dataLines(String(writeText.mock.calls.at(-1)![0])).map(nameCol)).toEqual(rowNames()); // 逐行==屏上（同源）
    expect(blobSpy()).not.toHaveBeenCalled();
  });

  it("③ 失败帧 gate 逐字三件套（新增维=b：R266③:165-210 已锁行 0/钮 0/cap null/rid/disabled/重试 +1/导出 toBe——本腿实测与彼**完全一致**，故该些维度只作引用帧前置；新锁=stale→reload 错帧内 knF title/lines/状态句/marker 四读数 + 表头条错帧逐字句 + 兜底不渲染）", async () => {
    const writeText = clipStub();
    wireMode("boom");
    await render(BASE);
    await clickNode(q("knE-page-more"), "make stale");
    expect(q("knE-page-stale")).toBeTruthy();
    await clickNode(q("knE-page-reload"), "reload -> 500");
    // 引用帧前置（不重写 R266③ 结论）：错误接管、行钮清零、cap null——实测一致
    expect(q("kn3-docs-error")).toBeTruthy();
    expect(q("knE-page-stale")).toBeNull();
    expect(rowNodes()).toHaveLength(0); // 引 knowledge.stale.reload.test.tsx:192
    expect(btnCount()).toBe(0); // 引 :193
    expect(q("kn3-page-cap")).toBeNull(); // 引 :187
    expect(urls().at(-1)).toBe(P1URL); // 引 :180
    // —— 本腿新增维：knF gate 在 stale→reload 错帧的逐字读数（R266③:188 只断 disabled）
    const knf = q("knF-copy") as HTMLButtonElement | null;
    expect(knf?.disabled).toBe(true);
    expect(knf?.getAttribute("title")).toBe("这次没有读到文档列表，没有可复制的内容。"); // 组合帧逐字（别面错帧句引 space.export:229）
    expect(txt(q("knF-lines"))).toBe("—");
    expect(attr("knF-lines", "title")).toBe("没有可数条目时给「—」，不写 0 冒充空集。");
    expect(txt(q("knF-copy-status"))).toBe("当前不可复制：这次读取没有成功");
    expect(attr("kn-gates-knF", "data-enabled")).toBe("false");
    expect(attr("kn-gates-knF", "data-reason")).toBe("这次读取没有成功");
    expect(attr("kn-gates-knF", "data-retry-enabled")).toBe("true"); // 错帧重试侧解禁（与在飞帧 data-retry-enabled=false 成对）
    expect(attr("kn-gates-knF", "data-export")).toBe("absent");
    expect(q("knF-fallback")).toBeNull(); // 兜底只在 enabled+failed 渲染，错帧必不挂
    // —— 表头条错帧逐字句在 stale→reload 组合帧（plain 错帧引 error.isolation:199/preview.requests2:279）
    expect((q("kn-sort-name") as HTMLButtonElement | null)?.disabled).toBe(true);
    expect(attr("kn-sort-name", "title")).toBe("这次没有读到这份列表，现在不能排序。");
    // —— 分页条出局（render 仅 ready 挂载）：错帧不残留「游标已过期」禁用句，防 stale 文案穿透
    expect(q("knE-page-bar")).toBeNull();
    expect(txt(document.body)).not.toContain("游标已过期");
    // rid 投递与一键恢复全程由 R266③ 锁死（:184-186 rid 逐字、:196-205 重试 +1 与导出 toBe），本腿不复测；
    // 「P2 load-more 500 保旧行 + 导出含旧集」并置已由 R239③ 锁死（export.detail.paging:180-222），不重复。
    expect(writeText).not.toHaveBeenCalled(); // 全程未点复制：错帧侧无投递面（blob/clip 双 0）
    expect(blobSpy()).not.toHaveBeenCalled();
  });
});
