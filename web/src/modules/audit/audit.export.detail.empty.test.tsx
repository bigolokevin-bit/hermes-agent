// @vitest-environment jsdom
// R254 — 导出×详情×空态三链：开着的抽屉不改导出域，坏掉的详情也不改导出域。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.export.dims.test.tsx` :356（R248③）钉住空站两枚导出 disabled+逐字 title、
//   点击后 urls 逐字、createObjectURL 调用数 0、页级锚在；
// - `audit.export.columns.test.tsx` :382（R205⑤）、`audit.error.test.tsx` :348（R213④）、
//   `audit.empty.export.test.tsx` :215 同族持有【零 Blob】与 doors 口径；
// - 「行复制列不渲」形制归 `audit.empty.test.tsx`（R181⑤）：cell 族整族缺席，
//   抽屉那枚 `aud-detail-copy` 是【可见但禁用】，不是消失——现状口径，不在本波统一；
// - 工单④（窗口+actor 叠加三值同步、导出零问）归 R205④/R214①/R248①；
// - 时间【文件到分钟、屏上到秒】的前缀梯归 R153。
//
// 本文件只补真正没拼过的两处：
// ① 裸 `?window=7d` 开着抽屉：复制句的每一段，就是文件里那一行的格；
//    再挂一站 `?actor=`，同一事件的句与行仍是同一串，且两站的文件互不掺对方的行；
// ② 详情 404 坏着：文件仍只按列表的账交付、读数行逐字不动，
//    而这个语境没有换档 —— 关闭【实测零问】（对照 R247：开着抽屉按档位钮换窗，
//    关闭会补问一次旧档列表，那是 navigate(-1) 的现状，两边不许混）。

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
const ACTOR_B = "user:cafe1234beef5678";
const ACTION = "task.created";
const ACTION_WORDS = "创建任务";
const RESOURCE = "ap_1122334455667788";
const OBJECT = "审批单 · 55667788";
const ZONE = "北京时间（UTC+8）";

const ROW_A = "evt_r254_nova_000001";
const ROW_B = "evt_r254_mike_00000001";
const TIME_A = "2026-11-19 09:20:00";
const TIME_A_FILE = "2026-11-19 09:20";
const RID_404 = "rid-r254-d404";

const STATION_A = "/audit?window=7d&limit=25";
const STATION_B = `/audit?window=7d&actor=${encodeURIComponent(ACTOR)}&limit=25`;

let root: Root | null = null;
const mode = { failDetail404: false };

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, occurredAt: string, handle: string, name: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: handle, displayName: name },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const A = rowOf(ROW_A, "2026-11-19T01:20:00Z", ACTOR, "李思");
const B = rowOf(ROW_B, "2026-11-19T01:21:00Z", ACTOR_B, "王五");

function notFound(url: string): ApiError {
  return new ApiError("not found", {
    status: 404,
    body: JSON.stringify({ code: "console.not_found" }),
    url,
    requestId: RID_404,
  });
}

function answer(): void {
  api.fetchJSON.mockImplementation(async (path) => {
    const target = String(path);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      if (mode.failDetail404) throw notFound(target);
      const id = new URL(target, "http://console.test").searchParams.get("id");
      return { audit: (id === ROW_B ? B : A) };
    }
    const actorId = new URL(target, "http://console.test").searchParams.get("actorId");
    if (actorId === ACTOR) return { items: [A], nextCursor: null };
    return { items: [A, B], nextCursor: null };
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

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const detailReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function openRecord(eventId: string): Promise<void> {
  await clickNodeSync(`aud01-cell-${eventId}-type`, `row ${eventId}`);
  await waitFor(() => node("aud02-detail") !== null, "the detail opened");
}

async function closeRecord(): Promise<void> {
  await clickNodeSync("aud8-back-to-list", "back to the list");
  await waitFor(() => node("aud02-detail") === null, "the detail folded away");
}

// 复制件：投递的那一句话本身就是账。
const clip = { calls: [] as string[] };

function stubClipboard(): void {
  clip.calls = [];
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        clip.calls.push(text);
        return Promise.resolve();
      },
    },
  });
}

async function copiedLine(): Promise<string> {
  const before = clip.calls.length;
  await clickNodeSync("aud-detail-copy", "aud-detail-copy");
  await waitFor(() => clip.calls.length > before, "the line reached the clipboard");
  return clip.calls[clip.calls.length - 1] ?? "";
}

// 文件怎么到手：锚点点击被截住，Blob 文本进 captured。
const blobs = new Map<string, Blob>();
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    const url = `blob:r254-${blobs.size + 1}`;
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
  time: CSV_HEADER.indexOf("时间"),
  type: CSV_HEADER.indexOf("类型"),
  actor: CSV_HEADER.indexOf("操作者"),
  object: CSV_HEADER.indexOf("对象"),
  rid: CSV_HEADER.indexOf("请求编号"),
};

beforeEach(() => {
  api.fetchJSON.mockReset();
  mode.failDetail404 = false;
  answer();
  stubClipboard();
  watchBlobs();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R254 - the open drawer and the file are the same words", () => {
  it("copies the open record and the file repeats the same cells, at both stations", async () => {
    await render(STATION_A);
    expect(paintedRows()).toEqual([ROW_A, ROW_B]);
    await openRecord(ROW_A);
    const line = await copiedLine();
    // 屏上口径：复制句到秒并带时区；文件到分钟 —— 前缀一致，不伪造逐字相等（R153 持有）。
    expect(line.startsWith(`${TIME_A} ${ZONE}`)).toBe(true);
    expect(line).toContain(WHO);
    expect(line).toContain(ACTION_WORDS);
    expect(line).toContain(OBJECT);
    expect(line).not.toContain(ACTOR);
    expect(line).not.toContain(RESOURCE);
    await closeRecord();
    const fileA = await exportRecords();
    const indexA = fileA.findIndex((cells) => cells[COL.rid] === `req-${ROW_A}`);
    expect(indexA, "the open record reached the file").toBeGreaterThan(-1);
    const rowA1 = fileA[indexA];
    expect(rowA1[COL.time]).toBe(TIME_A_FILE);
    expect(TIME_A.startsWith(rowA1[COL.time])).toBe(true);
    expect(rowA1[COL.actor]).toBe(WHO);
    expect(rowA1[COL.type]).toBe(ACTION_WORDS);
    expect(rowA1[COL.object]).toBe(OBJECT);
    expect(line).toContain(rowA1[COL.actor]);

    // 第二站：只带 actor 的挂载，服务按现状只回这一行。
    await render(STATION_B);
    expect(paintedRows()).toEqual([ROW_A]);
    await openRecord(ROW_A);
    const line2 = await copiedLine();
    expect(line2).toBe(line); // 跨站逐字：抽屉不认站，只认这条事件。
    await closeRecord();
    const fileB = await exportRecords();
    expect(fileB).toHaveLength(1);
    expect(fileB[0]).toEqual(rowA1); // 同一行、同样的格，逐字。
    const capturedB = captured.text;
    expect(capturedB).toContain(`req-${ROW_A}`);
    expect(capturedB).not.toContain(`req-${ROW_B}`); // 他站的行不掺进来。
  });
});

describe("R254 - a broken detail still hands over the list's own file", () => {
  it("keeps rows, the readout and the ledger untouched while the panel is 404", async () => {
    mode.failDetail404 = true;
    await render(STATION_A);
    expect(listReads()).toBe(1);
    const statusBefore = textOf("aud01-status");
    await clickNodeSync(`aud01-cell-${ROW_A}-type`, `row ${ROW_A}`);
    // 现状（R227③ 同规）：坏掉的详情给的是【某一枚失败面】，不假定一定是 error 还是 denied。
    const faces = Array.from(document.querySelectorAll("[data-testid]"))
      .map((element) => String(element.getAttribute("data-testid")))
      .filter((name) => name.startsWith("aud02-detail-") && name !== "aud02-detail");
    expect(faces.length, "a readable failure face").toBeGreaterThan(0);
    const body = faces
      .map((name) => textOf(name))
      .join(" ");
    expect(body).toContain(RID_404); // rid 在面上读得到（可复制控件本体归 R222④/R227③）。

    const calls = urls();
    const asks = listReads();
    const records = await exportRecords();
    // 文件仍只按列表的账交付：两行、按屏上次序、读数行逐字不动。
    expect(records.map((cells) => cells[COL.rid])).toEqual([`req-${ROW_A}`, `req-${ROW_B}`]);
    expect(shownCount()).toBe(records.length);
    expect(textOf("aud01-status")).toBe(statusBefore);
    expect(listReads()).toBe(asks);
    expect(urls()).toEqual(calls);

    // 本语境没有换档：关闭实测零问（对照 R247 —— 开着抽屉按档位钮换窗，关闭才补问旧档一枚）。
    const ledger = urls().length;
    await closeRecord();
    expect(urls().length).toBe(ledger);
    expect(detailReads()).toBe(1);
  });
});
