// @vitest-environment jsdom
// R250 — 导出×窗口×详情×分页的三值收敛：坏掉的第二页不许留下半页文件，恢复后的文件必须是整页。
//
// 已覆盖、这里不重写（只回证据）：
// - 工单①（第 2 页开详情再导出：行数==表体==读数行、字段逐字、rid 位置序）整体归
//   `audit.export.paging.detail.test.tsx` 的 「counts one number in three places, keeps each
//   row's copy its own, and refuses the error face」（R249，:326）；
// - 工单②（详情开态换窗：换代无旧行、行数==新窗表体）归 R245 「keeps the open reading,
//   re-asks the list once, and drops the old row from the file」（:298）与 R247 的窄换宽拼接。
//   口径登记照旧：工单「列表腿不重取」≠现状——换窗是服务端问题，恰重取一次（R245/R243① 持有）；
// - 工单③的主体：翻页失败的整页替换现状（第二页 500 ⇒ 表体清空，而不是工单承诺的「保旧行」——
//   保旧行属于不可达的追加腿，R161 ⑤ 在文件头已登记）+ 面板句+可复制 rid+重试恰 +1+三问账本，
//   归 `audit.paging.test.tsx` 第 500 页那一例（:338-380）；错误态导出门 disabled+title+零请求+
//   未建 Blob 的首屏语境归 `audit.error.test.tsx` ④（R213）；重试后复制行归 R244③。
//
// 本文件只钉两条从没被拼过的：
// ① 分页失败【进行中】点导出：门是关的、url 账本一字不动、连 Blob 都不曾生成；
// ② 失败页恢复【之后】导出：整页、每行满列、rid 按屏上顺序、三值收敛，且不产半页空行。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { ApiError } from "@/lib/api-error";
import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const WHO = "李思 · 6d7e8f90";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
const BASE = `/audit?window=custom&from=${FROM}&to=${TO}&limit=25`;

const P1_A = "evt_r250_alpha_00000001";
const P1_B = "evt_r250_bravo_000000001";
const P2_C = "evt_r250_charlie_000001";
const P2_D = "evt_r250_delta_00000001";
const CUR2 = "cur_r250_page2";
const RID_FAIL = "rid-r250-page2-500";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, minute: number): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: `2026-11-19T01:${minute}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const PAGE_ONE = [rowOf(P1_A, 20), rowOf(P1_B, 21)];
const PAGE_TWO = [rowOf(P2_C, 22), rowOf(P2_D, 23)];

let root: Root | null = null;
const mode = { failPageTwo: false };
let page2Tries = 0;

function errorFor(url: string): ApiError {
  return new ApiError("service down", {
    status: 500,
    body: "{}",
    url,
    requestId: RID_FAIL,
  });
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (path) => {
    const target = String(path);
    const params = new URL(target, "http://console.test").searchParams;
    if (params.get("cursor") === CUR2) {
      page2Tries += 1;
      // 现状（R161 ⑤）：第二页 500 走整页替换，表体清空，而不是工单说的「保旧行」。
      if (mode.failPageTwo && page2Tries === 1) throw errorFor(target);
      return { items: PAGE_TWO, nextCursor: null };
    }
    return { items: PAGE_ONE, nextCursor: CUR2 };
  });
}

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
  root = null;
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

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function textOf(testId: string): string {
  return node(testId)?.textContent?.trim() ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function loadMore(asksBefore: number): Promise<void> {
  await clickNodeSync("aud01-load-more", "load more");
  await waitFor(() => listReads() === asksBefore + 1, "the next page was asked for");
}

async function retryInPanel(): Promise<void> {
  const panel = node("aud01-error");
  expect(panel, "the failure panel").not.toBeNull();
  const retry = Array.from(panel!.querySelectorAll("button")).find(
    (element) => (element.textContent ?? "").includes("重试"),
  );
  expect(retry, "the retry button").toBeDefined();
  await act(async () => {
    (retry as HTMLElement).click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

// ── 文件怎么到手：Blob 计数 + 锚点点击捕获 ──────────────────────────────────
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  made.urls = 0;
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r250-${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return;
    captured.name = this.download;
    const blob = blobs.get(this.href);
    if (blob) void blob.text().then((text) => (captured.text = text));
  });
}

function parseRecord(line: string): string[] {
  const cells: string[] = [];
  let index = 0;
  while (index <= line.length) {
    if (line[index] === '"') {
      let value = "";
      index += 1;
      while (index < line.length) {
        if (line[index] === '"') {
          if (line[index + 1] === '"') {
            value += '"';
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        value += line[index];
        index += 1;
      }
      cells.push(value);
      if (line[index] === ",") index += 1;
      continue;
    }
    const next = line.indexOf(",", index);
    if (next === -1) {
      cells.push(line.slice(index));
      break;
    }
    cells.push(line.slice(index, next));
    index = next + 1;
  }
  return cells;
}

function dataLines(): string[] {
  return captured.text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
}

async function exportRecords(): Promise<string[][]> {
  captured.text = "";
  await clickNodeSync("aud01-export", "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines().map(parseRecord);
}

const COL = {
  actor: CSV_HEADER.indexOf("操作者"),
  type: CSV_HEADER.indexOf("类型"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

beforeEach(() => {
  api.fetchJSON.mockReset();
  mode.failPageTwo = false;
  page2Tries = 0;
  answer();
  watchBlobs();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R250 - a failed page leaves no door open and no file behind", () => {
  it("keeps both export doors shut through the paging failure, asks nothing, builds nothing", async () => {
    mode.failPageTwo = true;
    await render(BASE);
    expect(listReads()).toBe(1);
    await loadMore(1);
    await waitFor(() => node("aud01-error") !== null, "the failure panel");
    // 现状登记：工单③「保旧行」≠现状——整页替换让失败页清空表体（追加腿不可达，R161 ⑤ 持有）。
    expect(paintedRows()).toHaveLength(0);
    expect(textOf("aud01-error")).toContain("审计事件没能加载出来");
    expect(textOf("aud01-error-request-id")).toContain(RID_FAIL);
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    // 净新增（分页失败语境首钉；首屏错误的同一账归 R213④）：两扇门都点不动，也不生成文件。
    const calls = urls();
    await clickNodeSync("aud01-export", "aud01-export");
    await clickNodeSync("aud5-export", "aud5-export");
    expect(urls()).toEqual(calls);
    expect(made.urls).toBe(0);
    expect(captured.text).toBe("");
  });
});

describe("R250 - the recovered page reaches the file whole", () => {
  it("hands over every recovered row with full columns, in screen order, at one number", async () => {
    mode.failPageTwo = true;
    await render(BASE);
    await loadMore(1);
    await waitFor(() => node("aud01-error") !== null, "the failure panel");
    const before = urls().length;
    await retryInPanel();
    await waitFor(() => node("aud01-error") === null, "the retry answered");
    expect(urls().length).toBe(before + 1);
    // 账本归 R161⑤：首问、坏页、重试共三问，不多不少；这里只复跑现状。
    expect(listReads()).toBe(3);
    expect(paintedRows()).toEqual([P2_C, P2_D]);
    // 净新增：恢复之后再导出——整页、每行满列、按屏上顺序，且没有半页空行混进来。
    const records = await exportRecords();
    expect(records).toHaveLength(paintedRows().length);
    for (const cells of records) expect(cells).toHaveLength(CSV_HEADER.length);
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${P2_C}`, `req-${P2_D}`]);
    for (const cells of records) {
      expect(cells[COL.actor]).toBe(WHO);
      expect(cells[COL.type]).toBe(ACTION_WORDS);
    }
    expect(shownCount()).toBe(records.length);
    expect(captured.text).not.toContain(RID_FAIL);
    expect(captured.text).not.toContain("undefined");
  });
});
