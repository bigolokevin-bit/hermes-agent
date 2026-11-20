// @vitest-environment jsdom
// R161 — 分页与筛选的组合护栏（纯测试，产品码零改动）。
//
// 先说清楚这里钉的是「已经发出去的行为」，因为工单的两条口径与现场不同，
// 如实记账比写一条好看的断言有用：
//
// ①「第二页与首页重叠按事件 id 去重，屏上行数 == 并集」——现场不是这套。
//    `useAuditData.ts` 的取数效应每一次换问题（asked / limit / startCursor /
//    enabled）都先把 rows 清成 INITIAL 再整页替换；`goNext` 先
//    `resetPagingAndFolds`（删 cursor）再 `append("cursor", list.next)`，
//    所以地址里的游标栈最多一枚，屏上永远是「这一页」的行，不并集。
//    跨页重复的事件 id 因此不可能同屏出现两次（本文件就钉这条：重叠 id
//    只出现一次，前一页独有的行不再出现）。真正的追加路径是
//    `list.loadMore` → `rows: [...prev.rows, ...page.rows]`，它**没有**按 id
//    去重；而那条路径在现有界面上够不到——唯一调用点是
//    `aud01-page-failure` 里的重试，而那块只在追加失败后才渲染。要让
//    「按 id 去重」成为可依赖的产品承诺，需要另开工单。
//
// ④「第 2 页 500 保旧行」——同理，那是追加腿的承诺。走 `aud01-load-more`
//    （下一页）时失败是非追加失败：rows 被清、面板上屏。本文件钉这条现场
//    事实，并把「保旧行」缺腿记在下面，不假装它成立。
//
// ③「末页如实禁用 + title」——`aud01-load-more` 确实按 `!list.next` 禁用，
//    但它没有 `title`；末页的说法是一句看得见的「这一页就这些了。」。
//    所以这里钉：禁用为真 + 那句可见文案在场 + title 缺位如实断言。
//
// ⑤`audit-export` 这个 testid 不存在；发出去的两枚是 `aud01-export`
//    （中文表头 CSV，downloadCsv/listedRows）与 `aud5-export`
//    （R43 英文筛选快照）。三角校验读的是前者。
//
// 零额外请求、`aud01-*` 与导出族零破、三档（结构类名，未量像素）。
//
// 操作者与事件类型在这套基线上是 ConsoleSelect（合入的自定义下拉那一项改动），
// 所以本文件用地址把操作者带进来，不去点那个控件——要验的是「问题变了游标怎么
// 走」，控件本身是另一条车道的护栏。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

/** Every `cursor=` the request carries — the stack is the address's, so count it. */
function cursorsOf(url: string): string[] {
  return [...new URL(url, "http://console.test").searchParams.getAll("cursor")];
}

const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? null;

/** The rows actually on the table, in DOM order, as their event ids. */
function paintedRows(): string[] {
  return Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((node) =>
    (node.getAttribute("data-testid") ?? "").replace("aud01-row-", ""),
  );
}

function screenCount(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count") ?? "");
  return digits ? Number(digits[1]) : -1;
}

const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";
/** Overlap by design: this id is in BOTH pages, so a same-screen repeat is possible. */
const SHARED = "evt_p1_2";

function rowOf(index: string): Record<string, unknown> {
  return {
    eventId: `evt_${index}`,
    action: "task.created",
    occurredAt: "2026-11-19T01:20:00Z",
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-export-${index}`,
  };
}

const PAGE1 = [rowOf("p1_1"), rowOf("p1_2")];
const PAGE2 = [rowOf("p1_2"), rowOf("p2_3")];

/**
 * The answer follows the cursor it was asked with; `failPage2` only breaks the
 * second leg, so the first page is always read from the ledger.
 */
let failPage2 = false;

function answerPaged(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const cursor = paramOf(String(url), "cursor");
    if (cursor === "cur_page2" && failPage2) {
      throw new ApiError("down", {
        status: 500,
        body: '{"code":"console.unavailable","rid":"rid-audP"}',
        url: String(url),
        requestId: "rid-audP",
      });
    }
    const items = cursor ? PAGE2 : PAGE1;
    return { items, nextCursor: cursor ? null : "cur_page2" };
  });
}

// ── the file the page hands over, captured the way the browser would ────────
const store = new Map<string, Blob>();
let blobSeq = 0;
const captured: { name: string; csv: string } = { name: "", csv: "" };

function captureDownloads(): void {
  const original = HTMLAnchorElement.prototype.click;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (this.download) {
      captured.name = this.download;
      const blob = store.get(this.href);
      if (blob) void blob.text().then((text) => (captured.csv = text));
      return;
    }
    original.call(this);
  });
}

function dataLines(csv: string): string[][] {
  return csv
    .replace(/^/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1)
    .map((line) => line.split(","));
}

async function exportFile(): Promise<{ name: string; lines: string[][] }> {
  captured.name = "";
  captured.csv = "";
  const button = document.querySelector<HTMLButtonElement>("[data-testid='aud01-export']");
  await act(async () => {
    button?.click();
  });
  await waitFor(() => captured.csv !== "", "the file came back");
  return { name: captured.name, lines: dataLines(captured.csv) };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  failPage2 = false;
  captured.name = "";
  captured.csv = "";
  store.clear();
  blobSeq = 0;
  URL.createObjectURL = (blob: Blob) => {
    const id = `blob:paging-${++blobSeq}`;
    store.set(id, blob);
    return id;
  };
  URL.revokeObjectURL = () => {};
  captureDownloads();
  answerPaged();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
});

describe("R161 ① - a page is a page: overlap cannot double up on one screen", () => {
  it("shows this page's rows, with the overlapping id once", async () => {
    await render("/audit?window=7d");
    expect(paintedRows()).toEqual(["evt_p1_1", SHARED]);
    // page 1 really carries the shared id, and nothing else was on the wire
    expect(paintedRows()).toHaveLength(2);
    const before = urls().length;
    expect(cursorsOf(lastListRead())).toEqual([]);

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-load-more']")?.click();
    });
    await waitFor(() => paintedRows()[0] === SHARED, "page two painted");

    // No duplicates: the ids on screen are unique, and the shared one shows once.
    expect(new Set(paintedRows()).size).toBe(paintedRows().length);
    expect(paintedRows().filter((id) => id === SHARED)).toHaveLength(1);
    // …and this is NOT a union: page one's own row is gone, exactly as shipped.
    expect(paintedRows()).not.toContain("evt_p1_1");
    expect(paintedRows()).toEqual([SHARED, "evt_p2_3"]);
    expect(textOf("aud2-page")).toContain("第 2 页");
    // one cursor key, because 下一页 rebuilds the stack instead of growing it
    expect(cursorsOf(lastListRead())).toEqual(["cur_page2"]);
    expect(urls().length).toBe(before + 1);
  });

  it("a cold address that names a cursor reads that page only, once", async () => {
    await render("/audit?window=7d&cursor=cur_page2");
    expect(listReads()).toBe(1);
    expect(cursorsOf(lastListRead())).toEqual(["cur_page2"]);
    expect(paintedRows()).toEqual([SHARED, "evt_p2_3"]);
    expect(new Set(paintedRows()).size).toBe(2);
    expect(textOf("aud2-page")).toContain("第 2 页 · 已加载 2 条");
  });
});

describe("R161 ② - a new question drops the cursor and keeps every other answer", () => {
  it("changing the window off page two asks once, with no cursor and the rest verbatim", async () => {
    await render("/audit?window=24h&type=task.created&actor=user%3A2f3a4b5c6d7e8f90&cursor=cur_page2");
    expect(cursorsOf(lastListRead())).toEqual(["cur_page2"]);
    const before = urls().length;

    await act(async () => {
      document
        .querySelector<HTMLButtonElement>("[data-testid='aud01-filter-window-30d']")
        ?.click();
    });
    await waitFor(() => urls().length === before + 1, "one new read");

    const url = lastListRead();
    // the cursor is gone from the request AND from the address
    expect(cursorsOf(url)).toEqual([]);
    expect(paramOf(url, "window")).toBeNull();
    // the question it did keep: same action, same operator, a wider window
    expect(paramOf(url, "action")).toBe("task.created");
    expect(paramOf(url, "actorId")).toBe(ACTOR);
    const from = Date.parse(paramOf(url, "from") ?? "");
    const to = Date.parse(paramOf(url, "to") ?? "");
    expect(to - from).toBe(30 * 24 * 60 * 60 * 1000);
    expect(listReads()).toBe(2);
    expect(textOf("aud2-page")).toContain("第 1 页");
  });

  it("changing the question on page two drops the cursor and keeps actor and resource verbatim", async () => {
    // The 操作者 picker is a ConsoleSelect at this baseline (the merged custom-selects
    // change), so this leg brings the operator in through the address instead of a
    // click. The claim is what a changed question does to the cursor stack and to the
    // other answers — the widget itself is another lane's guard.
    await render(`/audit?window=24h&actor=${encodeURIComponent(ACTOR)}&resource=${RESOURCE}&cursor=cur_page2`);
    expect(cursorsOf(lastListRead())).toEqual(["cur_page2"]);
    const before = urls().length;

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-filter-window-30d']")?.click();
    });
    await waitFor(() => urls().length === before + 1, "one new read");

    const url = lastListRead();
    expect(cursorsOf(url)).toEqual([]);
    expect(paramOf(url, "actorId")).toBe(ACTOR);
    expect(paramOf(url, "resourceId")).toBe(RESOURCE);
    expect(textOf("aud2-page")).toContain("第 1 页");
  });
});

describe("R161 ③ - the last page is said, not promised", () => {
  it("turns 下一页 off with no cursor left and one honest sentence on screen", async () => {
    await render("/audit?window=7d");
    const next = document.querySelector<HTMLButtonElement>("[data-testid='aud01-load-more']");
    expect(next?.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>("[data-testid='aud2-prev'] button")?.disabled).toBe(
      true,
    );

    await act(async () => {
      next?.click();
    });
    await waitFor(() => paramOf(lastListRead(), "cursor") === "cur_page2", "page two asked");

    const off = document.querySelector<HTMLButtonElement>("[data-testid='aud01-load-more']");
    expect(off?.disabled).toBe(true);
    // the shipped way of saying it is a visible line, not a hover title
    expect(document.body.textContent).toContain("这一页就这些了。");
    expect(off?.getAttribute("title")).toBeNull();
    // and going back is live from here
    expect(document.querySelector<HTMLButtonElement>("[data-testid='aud2-prev'] button")?.disabled).toBe(
      false,
    );
  });

  it("counts loaded rows on the page, and never invents a total", async () => {
    await render("/audit?window=7d");
    expect(textOf("aud2-total")).toBe("总数不可用");
    // the reason travels in the control's own title, which is not text content
    expect(document.querySelector("[data-testid='aud2-total']")?.getAttribute("title")).toContain(
      "服务没有给出总数",
    );
    expect(textOf("aud2-page")).toBe("第 1 页 · 已加载 2 条");
  });
});

describe("R161 ④ - a page that answers 500 is a whole-page failure", () => {
  it("clears the rows, shows the reason with a copyable rid, and retries exactly once", async () => {
    await render("/audit?window=7d");
    expect(paintedRows()).toHaveLength(2);
    failPage2 = true;

    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-load-more']")?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud01-error']") !== null, "error panel");

    // What ships: the failed page leaves nothing painted above the panel.
    expect(paintedRows()).toHaveLength(0);
    expect(textOf("aud01-error")).toContain("审计事件没能加载出来");
    // the four-state label the surface carries is an attribute of the state mark
    expect(
      document.querySelector("[data-testid='audF-state-list-error']")?.getAttribute("data-audf-label"),
    ).toBe("读取没有完成");
    // the rid the body carried reaches the surface, and it is a copy control
    const ridLine = document.querySelector("[data-testid='aud01-error-request-id']");
    expect(ridLine?.textContent).toContain("rid-audP");
    expect(ridLine?.querySelector("button")).not.toBeNull();
    // the append leg (the one that would keep rows) is not what ran here
    expect(document.querySelector("[data-testid='aud01-page-failure']")).toBeNull();

    failPage2 = false;
    const before = urls().length;
    // the panel carries a copy control and a disclosure too, so find 重试 by its words
    const retry = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-testid='aud01-error'] button"),
    ).find((node) => (node.textContent ?? "").includes("重试"));
    expect(retry).toBeDefined();
    await act(async () => {
      retry?.click();
    });
    await waitFor(() => urls().length === before + 1, "one retry read");
    // page one, the failed page two, and the retry that answered it: three reads, no more
    expect(listReads()).toBe(3);
    await waitFor(() => document.querySelector("[data-testid='aud01-error']") === null, "panel gone");
    expect(paintedRows()).toEqual([SHARED, "evt_p2_3"]);
    expect(urls().length).toBe(before + 1);
  });
});

describe("R161 ⑤ - the export triangle holds after paging", () => {
  it("file rows, table body and the count line are the same number on page two", async () => {
    await render("/audit?window=7d");
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='aud01-load-more']")?.click();
    });
    await waitFor(() => paintedRows()[0] === SHARED, "page two painted");

    const rows = paintedRows();
    expect(rows).toHaveLength(2);
    expect(screenCount()).toBe(rows.length);

    const before = urls().length;
    const file = await exportFile();
    expect(file.lines).toHaveLength(rows.length);
    expect(file.lines.map((columns) => columns[5])).toEqual(["req-export-p1_2", "req-export-p2_3"]);
    expect(file.name).toMatch(/^audit-.+-\d{8}-\d{4}\.csv$/);
    // handing over a file asks for nothing
    expect(urls()).toEqual([...urls().slice(0, before), ...urls().slice(before)]);
    expect(urls().length).toBe(before);
    expect(listReads()).toBe(2);
  });

  it("the count line follows the table when a local resource filter narrows it", async () => {
    await render(`/audit?window=7d&resource=${RESOURCE}`);
    expect(paintedRows()).toHaveLength(2);
    expect(screenCount()).toBe(paintedRows().length);
    const file = await exportFile();
    expect(file.lines).toHaveLength(paintedRows().length);
    expect(listReads()).toBe(1);
  });
});
