// @vitest-environment jsdom
// R192 — 导出的转义与列序（纯测试）。
//
// 四件事，都是从屏上那一行与文件里那一行对出来的，不看产品内部：
// ① 操作者显示名里带逗号和双引号时，文件按 RFC4180 转义后【回解析】必须逐字等于屏上
//    那个名字 — 引号不能吞字，逗号不能把一格劈成两格；
// ② 列头与列序按现状锁定：文件里那六列的顺序，就是这一行六个面值的顺序；
// ③ 服务没带回 resource / actor 的行，文件里写的是【这一层的原话】，与屏上逐字一致；
//    真正留空的是时间格与请求编号格（见下方登记的口径差）；
// ④ 导出跟随当前 ?window / ?actor / ?action 的答案，且点导出不新增任何请求。
//
// 已覆盖、此处不重复（只回证据）：csv.test.ts :73/:104/:120/:136/:151/:174/:189 单元级
// 逐格转义、表头、BOM、行数与读回；R141 audit.export.test.tsx 的「文件行数==表体行数==
// 屏上计数」「资源本地筛选后文件跟着收窄」「空集 disabled+title 且点击零请求」「点导出不发
// 请求」；R153 audit.time.test.tsx 的四处时间与文件到分钟/屏上到秒的精度差；R177
// audit.actor.test.tsx 的四处操作者逐字与「未指派」口径；R133/R161/R170 的地址、游标与
// ConsoleSelect 形制。本文件补的是：把带逗号与引号的真名走一遍【写出→解析回】的闭环，
// 以及六列顺序与六个面值的一次性锁定 — 这两件事此前只在单元层出现，没在页面层钉过。
//
// 必须写明的口径差（test-only 波，不改产品）：工单写「缺 resource/actor 行写空字段」，
// 而 shipped 的 csvText 对这两列取的是模型自己的【人话标签】：完全没有对象时标签是「—」，
// 没有操作者时是「未指派」，两者都会原样写进文件，与屏上逐字相同；真正写空的只有
// occurredAt 与 requestId 两列（cell() 对空值返回 ""，「never 0, never a placeholder」）。
// 所以这里钉的是「两处各自逐字」+「该空的两列确实为空」，把「全部写空」留给单独工单。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

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

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const lastListRead = (): string =>
  [...urls()].reverse().find((url) => url.startsWith("/agent-api/api/audit?")) ?? "";
const paramOf = (url: string, key: string): string | null =>
  new URL(url, "http://console.test").searchParams.get(key);

const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? null;
/** A Field prints its label then its value; only the `dd` may be compared. */
const fieldValue = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}'] dd`)?.textContent?.trim() ?? null;
const markValue = (mark: string): string | null =>
  document.querySelector(`[data-testid='${mark}']`)?.getAttribute("data-audj-value") ?? null;
/** The printable half of a CopyValue: its own span, not the sibling copy button. */
const valueOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}'] > span`)?.textContent?.trim() ?? null;
const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map(
    (node) => node.getAttribute("data-testid")?.replace("aud01-row-", "") ?? "",
  );

interface PageBody {
  items: Record<string, unknown>[];
  nextCursor?: string | null;
}

/** The name the ticket demands: a comma and a double quote inside one display name. */
const NASTY = '李"思, 主管"';
const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";
const ID = "evt_escape_00000001";

function rowOf(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId: ID,
    action: "task.created",
    occurredAt: "2026-11-19T01:20:00Z",
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: NASTY },
    resource: { type: "approval", id: RESOURCE },
    requestId: "req-20261119-0a7b3c",
    ...over,
  };
}

function answer(body: PageBody): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail")
      ? { audit: body.items[0] }
      : { items: body.items, nextCursor: body.nextCursor ?? null },
  );
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

// ---------------------------------------------------------------------------
// The download, read back the way a spreadsheet reads it.

const captured: { name: string; csv: string } = { name: "", csv: "" };

function captureDownloads(): void {
  captured.name = "";
  captured.csv = "";
  const blobs: Record<string, Blob> = {};
  let seq = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      seq += 1;
      const url = `blob:escape-${seq}`;
      blobs[url] = blob;
      return url;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => undefined });
  const original = HTMLAnchorElement.prototype.click;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (this.download && this.href.startsWith("blob:escape-")) {
      const blob = blobs[this.href];
      captured.name = this.download;
      void blob?.text().then((text) => {
        captured.csv = text;
      });
      return;
    }
    original.call(this);
  });
}

/** RFC4180: a quoted field doubles its own quotes; CRLF ends a record. */
function parseRecord(line: string): string[] {
  const cells: string[] = [];
  let index = 0;
  while (index <= line.length) {
    if (line[index] === '"') {
      let cursor = index + 1;
      let text = "";
      while (cursor < line.length) {
        if (line[cursor] === '"') {
          if (line[cursor + 1] === '"') {
            text += '"';
            cursor += 2;
            continue;
          }
          break;
        }
        text += line[cursor];
        cursor += 1;
      }
      cells.push(text);
      // step over the closing quote and the comma (or the end of the line)
      index = line[cursor] === '"' ? cursor + 2 : cursor + 1;
    } else {
      const next = line.indexOf(",", index);
      if (next === -1) {
        cells.push(line.slice(index));
        break;
      }
      cells.push(line.slice(index, next));
      index = next + 1;
    }
  }
  return cells;
}

function dataLines(csv: string): string[] {
  return csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "");
}

async function exportFile(): Promise<{
  name: string;
  head: string;
  raw: string[];
  lines: string[][];
}> {
  const button = document.querySelector<HTMLButtonElement>("[data-testid='aud01-export']");
  await act(async () => {
    button?.click();
  });
  await waitFor(() => captured.csv !== "", "the file was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  const all = dataLines(captured.csv);
  const body = all.slice(1);
  // `raw` keeps the file's own bytes, so a claim about the quoting can be read
  // without the parser undoing it first.
  return { name: captured.name, head: all[0] ?? "", raw: body, lines: body.map(parseRecord) };
}

// ---------------------------------------------------------------------------

describe("R192 - a name with a comma and a quote survives the round trip", () => {
  beforeEach(() => {
    captureDownloads();
    answer({ items: [rowOf()] });
  });

  it("escapes it, parses it back, and gets the screen's own words", async () => {
    await render("/audit?window=7d");
    const onScreen = markValue(`audJ-actor-list-${ID}`);
    // The name is what the face prints, and it really does carry both characters —
    // a fixture that quietly lost them would make the next two claims worthless.
    expect(onScreen).toContain(NASTY);
    expect(onScreen).toContain(",");
    expect(onScreen).toContain('"');

    const file = await exportFile();
    const index = CSV_HEADER.indexOf("操作者");
    const cell = file.lines[0]?.[index] ?? null;
    // The raw line shows the quoting the parser undid, so a reader can see both.
    expect(file.lines[0]?.[index]).toBe(onScreen);
    expect(cell).not.toContain('""');
    // The raw record shows both escapes: the field is quoted, its inner quote is
    // doubled, and the comma inside the name did NOT split the column.
    const raw = file.raw[0] ?? "";
    expect(raw).toContain('""');
    expect(raw.split(",").length).toBeGreaterThan(CSV_HEADER.length);
  });

  it("keeps all six columns six columns, not seven because a name had a comma", async () => {
    await render("/audit?window=7d");
    const file = await exportFile();
    for (const line of file.lines) expect(line).toHaveLength(CSV_HEADER.length);
    expect(file.head).toBe(CSV_HEADER.join(","));
  });
});

describe("R192 - the header and the column order, as they ship today", () => {
  beforeEach(() => {
    captureDownloads();
    answer({ items: [rowOf()] });
  });

  it("locks the six names in the six positions the row prints them", async () => {
    await render("/audit?window=7d");
    const file = await exportFile();
    const [line] = file.lines;
    expect(file.head).toBe("时间,类型,结果,操作者,对象,请求编号");
    expect(line).toBeDefined();
    // 类型 / 操作者 / 对象 / 请求编号 are one and the same string on both sides.
    expect(line[1]).toBe("创建任务");
    expect(line[3]).toBe(markValue(`audJ-actor-list-${ID}`));
    expect(line[4]).toBe(fieldValue(`aud01-cell-${ID}-object`));
    expect(line[5]).toBe(valueOf(`aud01-cell-${ID}-request-value`));
    // 结果 is the badge's word; 时间 is the same reading one precision coarser
    // (the file goes to the minute, the screen to the second — R153 owns that).
    expect(line[2]).toBe((textOf(`aud01-cell-${ID}-result`) ?? "").trim());
    expect(String(markValue(`audJ-time-list-${ID}`)).startsWith(line[0])).toBe(true);
  });
});

describe("R192 - a row the service left blank", () => {
  beforeEach(() => {
    captureDownloads();
  });

  it("writes each layer's own word for a missing object and operator", async () => {
    answer({
      items: [
        rowOf({
          resource: {},
          actor: {},
        }),
      ],
    });
    await render("/audit?window=7d");
    const file = await exportFile();
    const [line] = file.lines;
    expect(line).toBeDefined();
    // Shipped: the label columns carry the model's human word, and the file says
    // exactly what the face says. Absence has a voice, it is not silence.
    expect(line[4]).toBe("—");
    expect(line[4]).toBe(fieldValue(`aud01-cell-${ID}-object`));
    expect(line[3]).toBe("未指派");
    expect(line[3]).toBe(markValue(`aud01-cell-${ID}-actor`) ?? fieldValue(`aud01-cell-${ID}-actor`));
  });

  it("leaves a missing instant and request number genuinely empty, never a placeholder", async () => {
    answer({ items: [rowOf({ occurredAt: null, requestId: null })] });
    await render("/audit?window=7d");
    const file = await exportFile();
    const [line] = file.lines;
    expect(line).toBeDefined();
    expect(line[0]).toBe("");
    expect(line[5]).toBe("");
    // …while the screen's own word for that absent instant is the missing-field one.
    expect(markValue(`audJ-time-list-${ID}`)).toBe("该字段未返回");
    for (const cell of line) expect(cell).not.toBe("0");
  });
});

describe("R192 - the file follows the question, and costs nothing to make", () => {
  beforeEach(() => {
    captureDownloads();
    answer({ items: [rowOf()] });
  });

  it("carries the stated window, the operator and the action, and asks for nothing", async () => {
    const entry =
      "/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z" +
      `&type=task.created&actor=${encodeURIComponent(ACTOR)}&limit=25`;
    await render(entry);
    const read = lastListRead();
    expect(paramOf(read, "action")).toBe("task.created");
    expect(paramOf(read, "actorId")).toBe(ACTOR);
    expect(paramOf(read, "limit")).toBe("25");
    expect(paramOf(read, "to")).toContain("2026-11-19T02:00:00");
    expect(listReads()).toBe(1);

    const before = urls();
    const file = await exportFile();
    expect(file.lines).toHaveLength(paintedRows().length);
    expect(file.lines[0]?.[3]).toBe(markValue(`audJ-actor-list-${ID}`));
    expect(file.name).toContain("自定义");
    // Making the file is arithmetic on rows already on screen: no new question.
    expect(urls()).toEqual(before);
    expect(listReads()).toBe(1);
  });
});
