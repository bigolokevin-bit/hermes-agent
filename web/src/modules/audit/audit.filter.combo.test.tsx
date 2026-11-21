// @vitest-environment jsdom
// R270 — 筛选叠加与导出三值、非法动作的「不建文件、地址不改」：把Owners各自的一半拼成一面。
//
// 已覆盖、这里不重写（只回证据）：
// - 工单①「请求带全部四参且无 cursor」：`audit.filters.test.tsx`（R133）② :202-220 ——
//   custom 窗 + type + actor + resource + limit 全叠加时，线路逐参 action/actorId/resourceId/
//   from/to/limit 同值同源、cursor 为 null；地址逐字由 R133① :177-201 持有。本波不再复钉线路，
//   只补「四参叠加（含 resource 本地再筛）下 表体 == aud01-status == CSV 数据行」的三角：
//   R214①（audit.filter.counts.test.tsx :270-288）只叠到三参（档位+actor+action），
//   R205④ 同样不含 resource，R133⑥ :321-329 有 resource 但只数到「将导出 N 条」没有文件行。
// - 工单②「移除 action chip 后恰 1 次重取、三值同步重算」：`audit.chips.test.tsx`（R224）
//   ② :267-293 —— removeChipOneAsk 钉恰一次取数，三枚数一起落到新答案；操作者 chip 归
//   R214② :289-313，地址逐字归 audT/R224①；「行序稳定」的排序保持归
//   `audit.sort.filter.test.tsx`（R190）③ :205-222。本波零重写。
// - 工单③ 的页面可读性：R224④ :313-345 —— 非法 type=__nope__：chip 原样、恰 1 次问、
//   空态句「这个筛选条件里没有审计事件」、两枚导出 disabled + 题句逐字、点击零新增请求。
//   本波只补它自己让出去的两枚：R224④ 注释「Blob 计数腿由 R205⑤/R214④ 持有」——那两枚的
//   语境是【有效筛选打到空集】；【非法动作值语境下强点两门 createObjectURL 计数为 0、
//   Blob 零枚】没有数过；「点击后地址一字不改」也只钉过挂载时（R133①）与空 actor（R224③），
//   点击后门没有差分过。
// - 「序号」概念在列表不存在（行复制=开抽屉后的 aud-detail-copy 一枚；audC-copy 仅详情独立页
//   `AuditDetailModulePage.test.tsx` :319-344）—— 家族既有登记，不复述。
//
// 现状口径：resource 线路发 resourceId 且页面本地再筛（服务端效果未单独实测，
// AuditEventsModulePage :344/:356/:906/:1502；R133⑥ 以本地口径为准）；档位不上线只 from/to 对；
// 导出=当前已装载的行（最坏形状按服务承诺登记，R243② 先例）；地址里的动作键是 type、
// 线路才是 action（R224 头部既有口径），工单写 action=__nope__ 按现场走 type=__nope__。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const ACTION = "task.created";
const RESOURCE = "ap_1122334455667788";
const OTHER_RES = "ap_9988776655443322";
const NOPE = "__nope__";

const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, minute: number, resourceId: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: `2026-11-19T01:${String(minute).padStart(2, "0")}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: resourceId },
    requestId: `req-${eventId}`,
  };
}

const ROW_R1 = rowOf("evt_r270_one_00000001", 20, RESOURCE);
const ROW_R2 = rowOf("evt_r270_two_00000001", 21, RESOURCE);
const ROW_X = rowOf("evt_r270_xray_0000001", 22, OTHER_RES);

// 服务端线路带 resourceId 也照发（R133② 已钉），回答里混一条别家资源——
// 页面本地再筛把它滤掉，这正是现状：计数三角必须数在筛后。
function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) return { audit: ROW_R1 };
    if (target.includes(NOPE)) return { items: [], nextCursor: null };
    return { items: [ROW_R1, ROW_R2, ROW_X], nextCursor: null };
  });
}

function Probe(): ReactNode {
  const location = useLocation();
  return <div data-testid="probe-location" data-search={location.search} />;
}

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
  root = null;
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <Probe />
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
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

/** 地址逐字（解码、不排序 —— 比较时两边一起 sort）。 */
function pairs(): string[] {
  const search = node("probe-location")?.getAttribute("data-search") ?? "";
  return Array.from(new URLSearchParams(search).entries()).map(
    ([key, value]) => `${key}=${value}`,
  );
}

async function clickNodeSync(testId: string, label = testId): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

// ── 文件：Blob → 文本 → 逐行；createObjectURL 计数是本波的两枚净新增之一 ──
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured = { name: "", text: "" };

function watchBlobs(): void {
  blobs.clear();
  made.urls = 0;
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r270-${blobs.size + 1}`;
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

/** RFC4180 回解析：带引号的字段里可以有一逗号和翻倍的双引号。 */
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
  const bom = String.fromCharCode(0xfeff);
  const text = captured.text.startsWith(bom) ? captured.text.slice(1) : captured.text;
  return text
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
  rid: CSV_HEADER.indexOf("请求编号"),
};

beforeEach(() => {
  api.fetchJSON.mockReset();
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

describe("R270 - the stacked question and the file it hands over", () => {
  it("counts the filtered rows in the table, the readout and the file as one number", async () => {
    const address =
      `/audit?window=custom&from=${FROM}&to=${TO}` +
      `&actor=${ACTOR}&type=${ACTION}&resource=${RESOURCE}&limit=25`;
    await render(address);
    expect(listReads()).toBe(1);
    // 线路四参+无 cursor 本体归 R133② :202-220，这里只认这一枚「初始问没有 cursor」的现场复跑，
    // 不复钉参数值（禁重复用例）：
    expect(paramOf(lastListRead(), "cursor")).toBeNull();
    // 现状：resource 是本地再筛——应答里那条别家资源不该上桌（R133⑥ 同口径）。
    expect(paintedRows()).toEqual([
      "evt_r270_one_00000001",
      "evt_r270_two_00000001",
    ]);
    expect(shownCount()).toBe(paintedRows().length);
    const records = await exportRecords();
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);
    // 行序与屏上一致（默认序=服务应答序，R236② 口径）；每行带着自己的请求编号。
    expect(records.map((cells) => cells[COL.rid])).toEqual([
      "req-evt_r270_one_00000001",
      "req-evt_r270_two_00000001",
    ]);
    // 三参三角归 R214①，此处只证明加上 resource 后三角依然同一枚数：
    expect(made.urls).toBe(1);
    // 导出这一击不产生任何新的列表问。
    expect(listReads()).toBe(1);
  });

  it("an unknown action leaves the address byte-for-byte alone and never builds a file", async () => {
    await render(`/audit?type=${NOPE}&limit=25`);
    await waitFor(() => node("aud01-status") !== null, "the readout line painted");
    // chip/空态句/disabled+题句/恰 1 次问/点击零请求 全部归 R224④ :313-345，不复钉；
    // 这里只补它让出去的两枚：Blob 计数与点击后的地址差分。
    expect(paintedRows()).toEqual([]);
    const before = [...pairs()].sort();
    expect(before).toContain(`type=${NOPE}`);
    const ledger = urls();
    const asks = listReads();
    await clickNodeSync("aud01-export", "aud01-export");
    await clickNodeSync("aud5-export", "aud5-export");
    expect(made.urls).toBe(0);
    expect(blobs.size).toBe(0);
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(asks);
    // 强点两扇门之后，地址没有多一枚、没有少一枚、没有一个字节改动：
    expect([...pairs()].sort()).toEqual(before);
  });
});
