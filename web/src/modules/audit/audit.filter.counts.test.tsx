// @vitest-environment jsdom
// R214 — 筛选组合与计数同源：问句每改一次，屏幕上那几个数必须一起改，谁也不许停在旧答案上。
//
// 已覆盖、这里不重写（只回证据）：
// - R205④（audit.export.columns.test.tsx）钉过【自定义窗】+ actor + action 下
//   「CSV 行数 == 表体 == aud01-status」三值；它没有把「将导出 N 条」那枚计数拉进来；
// - R141（audit.export.test.tsx）钉过「文件行数==表体==将导出 N 条」三角，但都在
//   window=custom 单参场景，没有叠 actor/action；
// - audT chips 族（AuditEventsModulePage.test.tsx :5293-5450）钉过 chip 的存在与措辞、
//   移除操作者 chip 的地址/线路/游标账（恰一次重取）、from-to 是一枚 chip、资源 chip
//   移除后「行集与导出计数」两值同改；它没有把 aud01-status 那枚读数行放进任何三角；
// - R181（audit.empty.test.tsx）钉过空态句子、两枚导出 disabled+title、「将导出 0 条」
//   与零新增请求；R205⑤ 钉过空集时 createObjectURL 调用数为 0。本波的差异是【叠加筛选】
//   下的空集，并把三枚零值放在一起对账；
// - R161/R208 钉过档位窗上线是 from/to 对、window 参不上线；R203 钉过 customInvalid。
//
// 本波真正的新拼接：
// ① 档位窗（非 custom）+ actor + action 三参叠加时，四面同数：表体行数 == 读数行
//    「已显示 N 条」== 「将导出 N 条」== CSV 数据行数；
// ② 移除操作者 chip 之后，三枚计数同步重算到新数（audT 钉的是地址与线路，这里钉数）；
// ③ 互斥现场裁决：地址同时写了档位 window 与 from/to 时，按产品现状档位说了算 ——
//    from/to 被静默忽略、不拼进问句、不触发 customInvalid、chip 条里只有时间窗那一枚；
//    同一对 from/to 换个 window=custom 就逐字上线。此前没有任何用例钉过这个裁决；
// ④ 叠加筛选打到空集：行不渲、读数行是句子而不是数字（工单说「三值同为 0」，现状是
//    句子无数字 —— 按现状钉并登记）、「将导出 0 条」、两枚导出 disabled+title、
//    点击零新增请求且从未生成过文件。
//
// 时间口径维持现状：屏上到秒、文件到分钟（R153 持有），本波只数数，不重钉格式。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { customBounds } from "@/modules/audit/window";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const ACTION = "task.created";
const ID_ONE = "evt_r214_one_000001";
const ID_TWO = "evt_r214_two_00001";
const FROM_TXT = "2026-11-01T00:00";
const TO_TXT = "2026-11-02T00:00";
const DAY_MS = 24 * 3600 * 1000;

let root: Root | null = null;

// 夹具开关：actorNarrow=带 actorId 的回答只给一行；empty=叠加问句回答空集。
const mode = { actorNarrow: false, empty: false };

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
const listReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";

function paramOf(url: string, key: string): string | null {
  return new URL(url, "http://console.test").searchParams.get(key);
}

/** 两次上线之间的毫秒跨度：档位窗由时钟算出，只能这样对账（R161 手法）。 */
function spanOf(url: string): number {
  const from = paramOf(url, "from");
  const to = paramOf(url, "to");
  if (!from || !to) return NaN;
  return new Date(to).getTime() - new Date(from).getTime();
}

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

/** 读数行「已显示 N 条审计事件」里的 N；空态/错误态是句子，没有数字，记 -1。 */
function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

/** 「将导出 N 条」里的 N。 */
function exportCountDigits(): number {
  const digits = /(\d+)/.exec(textOf("aud5-export-count"));
  return digits ? Number(digits[1]) : -1;
}

async function clickNode(target: Element | null | undefined, label: string): Promise<void> {
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, index: number): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt: `2026-11-19T01:2${index}:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: "ap_1122334455667788" },
    requestId: `req-${eventId}`,
  };
}

const TWO: Row[] = [rowOf(ID_ONE, 0), rowOf(ID_TWO, 1)];
const ONE: Row[] = [rowOf(ID_ONE, 0)];

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      return { audit: TWO[0] };
    }
    if (mode.empty) return { items: [], nextCursor: null };
    // 问句里还有 actorId 就只答一行 —— 让「移除 chip」真能改答案。
    const narrowed = mode.actorNarrow && paramOf(target, "actorId") !== null;
    return { items: narrowed ? ONE : TWO, nextCursor: null };
  });
}

// ── 文件怎么到手：与 R205/R213 同一套捕获，没生成就看得见 ────────────────
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured = { text: "" };

function captureDownloads(): void {
  blobs.clear();
  captured.text = "";
  made.urls = 0;
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:filter-counts-${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return;
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
  return captured.text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
}

async function exportRowCount(): Promise<number> {
  captured.text = "";
  await clickNode(node("aud01-export"), "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines().map(parseRecord).length;
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  mode.actorNarrow = false;
  mode.empty = false;
  answer();
  captureDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R214 ① - a stacked question, one number in four places", () => {
  it("keeps rows, the readout line, the export count and the file at one number", async () => {
    const address = `/audit?window=30d&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`;
    await render(address);
    // 问句确实三参叠加（线路形状由 R161/R208 持有，这里只认参数在不在）
    const read = lastListRead();
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "action")).toBe(ACTION);
    expect(spanOf(read)).toBe(30 * DAY_MS);
    expect(listReads()).toBe(1);

    expect(shownCount()).toBe(paintedRows().length);
    expect(exportCountDigits()).toBe(shownCount());
    const fileRows = await exportRowCount();
    expect(fileRows).toBe(paintedRows().length);
    expect(fileRows).toBe(shownCount());
  });
});

describe("R214 ② - removing a chip recomputes every count, once", () => {
  it("drops the operator chip at exactly one ask and all three counts move together", async () => {
    mode.actorNarrow = true;
    const address = `/audit?window=30d&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`;
    await render(address);
    expect(paintedRows()).toEqual([ID_ONE]);
    expect(shownCount()).toBe(1);
    expect(exportCountDigits()).toBe(1);

    await clickNode(node("aud-chip-actor-clear"), "aud-chip-actor-clear");
    await waitFor(() => listReads() === 2 && paintedRows().length === 2, "the widened answer");

    // 恰一次重取：账上只多这一条（地址/线路去 actorId 的逐字账由 audT 持有）
    expect(listReads()).toBe(2);
    expect(urls().length).toBe(2);
    expect(paramOf(lastListRead(), "actorId")).toBeNull();

    // 三枚数一起落到新答案上，谁也没停在旧数
    expect(shownCount()).toBe(paintedRows().length);
    expect(exportCountDigits()).toBe(shownCount());
    const fileRows = await exportRowCount();
    expect(fileRows).toBe(shownCount());
    expect(node("aud-chip-actor")).toBeNull();
  });
});

describe("R214 ③ - the address may carry one window, and the tier wins", () => {
  it("answers a tier-plus-pair address with the tier, and the same pair with custom means custom", async () => {
    // 现场裁决（产品现状）：windowChoice 不是 custom 时，from/to 根本不进问句 ——
    // 档位说了算，不合并、不报错、不多问。
    const stray = `/audit?window=24h&from=${encodeURIComponent(FROM_TXT)}&to=${encodeURIComponent(TO_TXT)}`;
    await render(stray);
    expect(listReads()).toBe(1);
    const read = lastListRead();
    expect(spanOf(read)).toBe(DAY_MS);
    // 那对 Beijing 墙钟被忽略：上线的是时钟算出的档位边界，不是它的 ISO
    const pair = customBounds(FROM_TXT, TO_TXT);
    expect(pair, "the pair is a usable range on its own").not.toBeNull();
    expect(paramOf(read, "from")).not.toBe(pair?.from);
    expect(paramOf(read, "to")).not.toBe(pair?.to);
    // 不假装 custom：没有半截区间门可触发，面板正常有行
    expect(paintedRows().length).toBe(2);
    expect(node("aud-chip-window")).not.toBeNull();
    expect(node("aud-chip-from-to")).toBeNull();

    // 同一对值，window=custom 就逐字上线 —— 模式由 window 键说了算，二者互斥
    await render(`/audit?window=custom&from=${encodeURIComponent(FROM_TXT)}&to=${encodeURIComponent(TO_TXT)}`);
    const customRead = lastListRead();
    expect(paramOf(customRead, "from")).toBe(pair?.from);
    expect(paramOf(customRead, "to")).toBe(pair?.to);
    expect(node("aud-chip-window")).toBeNull();
    expect(node("aud-chip-from-to")).not.toBeNull();
  });
});

describe("R214 ④ - a stacked question with no answer", () => {
  it("paints no rows, says the sentence not a zero, and never builds a file", async () => {
    mode.empty = true;
    const address = `/audit?window=30d&actor=${encodeURIComponent(ACTOR)}&type=${ACTION}&limit=25`;
    await render(address);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([]);

    // 工单说「三值同为 0」；现状是读数行给句子、不带数字 —— 按现状钉并登记差异。
    expect(shownCount()).toBe(-1);
    expect(textOf("aud01-status")).toBe("这个筛选条件里没有审计事件");
    // 另外两枚确实是零：屏上预告与（不可达的）文件
    expect(exportCountDigits()).toBe(0);

    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");

    const before = urls();
    await clickNode(csv, "aud01-export");
    await clickNode(filtered, "aud5-export");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    // 零新增请求（R181 钉过账目，这里在叠加问句下再对一次），且从未生成过一个空文件
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
    expect(made.urls).toBe(0);
    expect(captured.text).toBe("");
  });
});
