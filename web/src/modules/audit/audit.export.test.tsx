// @vitest-environment jsdom
// R141 — 导出与筛选同源（纯测试）。
//
// 护栏：① CSV 数据行数 == 表体行数 == 屏上计数；② 导出跟随当前筛选（同一组地址参数
// 就是同一组请求参数，窗口写进文件名）；③ 服务没带回的字段在文件里是空单元格，不是
// 「0」也不是占位句；④ 空集导出 disabled + title，点它不多问一次。
//
// 已覆盖、此处不重复（只回证据）：csv.test.ts 逐格转义/表头/BOM/行数（含 :189
// 「counts the rows it wrote back」）；AuditEventsModulePage.test.tsx :425 导出按钮存在、
// :1371/:1382 本地资源筛选后「将导出 1 条」+文件含该资源短码、:2242 空集导出 off、
// :3136/:3180/:4126 导出集合与顺序 == 表体行、:4345/:4425 R43 筛选快照的列与文件名；
// auditFilterParity.test.tsx :94 地址 pair-set；R133 audit.filters.test.tsx guard ④
// 行数==导出数（无 CSV 内容断言）。本文件补的是：屏上那个数字与文件行数与表体行数
// 三者同源一句、缺值单元格在文件里为空而屏上同字段是缺位句、点导出不发新请求。
//
// 一处必须写明的口径差：csv.ts 头部注释自己声明「Times are Beijing wall clock to the
// minute」，而屏上的时间走 auditTimeView 到秒。所以「时间格式与屏上同源」今天成立的是
// 「同一个读法的两种精度」，不是逐字相等。本波是 test(...) 波，不改产品文案；这里钉住
// shipped 行为（文件到分钟、屏上到秒、文件前缀==屏上前 16 字），把精度并轨留给单独工单。

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
  await waitFor(() => !document.querySelector(".animate-pulse"), "skeleton gone");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const paramOf = (url: string, key: string): string | null =>
  new URL(url, "http://console.test").searchParams.get(key);
const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? null;

/** The list page's answer shape: rows plus the next-page cursor. */
interface PageBody {
  items: Record<string, unknown>[];
  nextCursor?: string | null;
}

function answer(body: PageBody): void {
  api.fetchJSON.mockImplementation(async () => body);
}

/**
 * `downloadCsv` builds a Blob, hangs it on a temporary `<a download>` and clicks it.
 * jsdom has neither an object URL store nor a download, so the file is captured at
 * the same two seams the module already uses: the URL that is made, and the anchor
 * that is clicked. Nothing here changes what the product computes.
 */
const captured: { name: string; csv: string; downloads: { name: string; csv: string }[] } = {
  name: "",
  csv: "",
  downloads: [],
};

function captureDownloads(): void {
  captured.name = "";
  captured.csv = "";
  captured.downloads = [];
  const blobs: Record<string, Blob> = {};
  let seq = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      seq += 1;
      const url = `blob:export-${seq}`;
      blobs[url] = blob;
      return url;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => undefined });
  const original = HTMLAnchorElement.prototype.click;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (this.download && this.href.startsWith("blob:export-")) {
      const blob = blobs[this.href];
      captured.name = this.download;
      captured.downloads.push({ name: this.download, csv: "" });
      const slot = captured.downloads[captured.downloads.length - 1];
      // The product reads the blob asynchronously; the test waits for it below.
      void blob?.text().then((text) => {
        slot.csv = text;
        captured.csv = text;
      });
      return;
    }
    original.call(this);
  });
}

const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-07T02:00:00Z";
const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";

function rowOf(index: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId: `evt_export_${index}`,
    action: "task.created",
    occurredAt: `2026-11-06T0${index}:00:00Z`,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: `${RESOURCE.slice(0, 3)}11223344556677${index}88` },
    requestId: `req-export-${index}`,
    ...over,
  };
}

const THREE: PageBody = {
  items: [rowOf("1"), rowOf("2"), rowOf("3")],
  nextCursor: null,
};

/** The painted rows, in DOM order, by the same key the page uses for its cards. */
const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']"))
    .map((node) => node.getAttribute("data-testid") ?? "")
    .filter((id) => id !== "");

/** The number the page writes next to the export button. */
const screenCount = (): number => {
  const raw = (textOf("aud5-export-count") ?? "").replace(/\D+/g, "");
  return raw === "" ? -1 : Number(raw);
};

/** Data lines only: the BOM is stripped and the header line dropped. */
function dataLines(csv: string): string[] {
  return csv
    .replace(/^/, "")
    .split("\r\n")
    .filter((line) => line.trim() !== "")
    .slice(1);
}

async function exportFile(): Promise<{ name: string; csv: string }> {
  const button = document.querySelector<HTMLButtonElement>("[data-testid='aud01-export']");
  await act(async () => {
    button?.click();
  });
  await waitFor(() => captured.csv !== "", "the file was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return { name: captured.name, csv: captured.csv };
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  captureDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R141 - the file, the rows and the number are one count", () => {
  it("exports exactly what the table shows and what the page says it will", async () => {
    answer(THREE);
    await render(`/audit?window=custom&from=${FROM}&to=${TO}`);
    await waitFor(() => paintedRows().length === 3, "rows painted");
    // aud2-total says 总数不可用 when the service sends no total — the honest
    // answer, and not a count. The triangle this guard owns is the file, the
    // painted rows and the number next to the button.
    expect(screenCount()).toBe(3);
    const file = await exportFile();
    expect(dataLines(file.csv)).toHaveLength(3);
    // one sentence, three places: the file's lines, the table's rows, the number
    expect(dataLines(file.csv).length).toBe(paintedRows().length);
    expect(dataLines(file.csv).length).toBe(screenCount());
    expect(file.csv.startsWith(CSV_HEADER.join(","))).toBe(true);
  });

  it("is built from the filters the address carries, in the same words", async () => {
    answer(THREE);
    await render(
      `/audit?window=custom&from=${FROM}&to=${TO}&type=task.created&actor=${encodeURIComponent(
        ACTOR,
      )}&resource=ap_11223344556677188&limit=25`,
    );
    await waitFor(() => paintedRows().length > 0, "rows painted");
    const url = urls().find((entry) => /^\/agent-api\/api\/audit\?/.test(entry)) ?? "";
    // The address says the instant, the request says the same instant through
    // the module's one bounds helper — ISO with the milliseconds that `toISOString`
    // always writes. Same reading, one spelling, no second parser.
    expect(paramOf(url, "from")).toBe(new Date(FROM).toISOString());
    expect(paramOf(url, "to")).toBe(new Date(TO).toISOString());
    expect(paramOf(url, "action")).toBe("task.created");
    // appendQuery encodes with encodeURIComponent, so ':' travels as %3A and
    // URLSearchParams hands the decoded value back.
    expect(paramOf(url, "actorId")).toBe(ACTOR);
    expect(paramOf(url, "limit")).toBe("25");
    // the window the person chose is in the file's name, not silently dropped
    const file = await exportFile();
    expect(file.name).toContain("自定义");
    expect(dataLines(file.csv)).toHaveLength(paintedRows().length);
    expect(screenCount()).toBe(paintedRows().length);
  });

  it("a resource filter narrows the file with the table, not after it", async () => {
    answer({ items: [rowOf("1"), rowOf("2")], nextCursor: null });
    await render(`/audit?window=custom&from=${FROM}&to=${TO}&resource=ap_11223344556677188`);
    await waitFor(() => textOf("aud5-export-count") !== null, "the export bar is painted");
    // The local resource match leaves one row, and the file is written FROM the
    // rows on screen — so the file carries that one row too, never the two the
    // service actually sent. This is the whole claim: the filter narrows the
    // export with the table, not after it.
    expect(paintedRows()).toHaveLength(1);
    expect(screenCount()).toBe(1);
    const file = await exportFile();
    expect(dataLines(file.csv)).toHaveLength(1);
    expect(file.csv).toContain("56677188");
    expect(file.csv).not.toContain("56677288");
  });
});

describe("R141 - what the service did not send", () => {
  it("leaves an absent value an empty cell in the file, in the column it belongs to", async () => {
    answer({
      items: [rowOf("1", { occurredAt: null, requestId: null }), rowOf("2")],
      nextCursor: null,
    });
    await render(`/audit?window=custom&from=${FROM}&to=${TO}`);
    await waitFor(() => paintedRows().length === 2, "rows painted");
    const file = await exportFile();
    const [first, second] = dataLines(file.csv);
    const columns = first.split(",");
    // 时间 and 请求编号 are the two columns read from the record itself
    expect(columns[0]).toBe("");
    expect(columns[5]).toBe("");
    expect(first).not.toContain("该字段未返回");
    expect(first).not.toContain("—");
    // rowOf("2") is 2026-11-06T02:00:00Z — Beijing 10:00, to the minute.
    expect(second.split(",")[0]).toBe("2026-11-06 10:00");
    // the screen keeps its own honest word for the same absent value
    const screenTime = document.querySelector(
      "[data-testid='aud01-cell-evt_export_1-time']",
    )?.textContent;
    expect(screenTime).toContain("该字段未返回");
  });

  it("writes the instant in the screen's own reading, to the precision the file documents", async () => {
    answer({ items: [rowOf("1")], nextCursor: null });
    await render(`/audit?window=custom&from=${FROM}&to=${TO}`);
    await waitFor(() => paintedRows().length === 1, "row painted");
    const file = await exportFile();
    const exported = dataLines(file.csv)[0].split(",")[0];
    // The Field's own text starts with its label (时间（北京时间）), so the value
    // is read from the dd — the same node every other guard in this module reads.
    const screenTime =
      document.querySelector("[data-testid='aud01-cell-evt_export_1-time'] dd")?.textContent ?? "";
    // csv.ts says 到分钟; the screen says 到秒. One reading of one instant, two
    // precisions — registered here rather than silently unified.
    expect(exported).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(exported).toBe("2026-11-06 09:00");
    expect(screenTime.startsWith(exported)).toBe(true);
    expect(screenTime).toMatch(/^2026-11-06 09:00:\d{2}$/);
  });
});

describe("R141 - an empty page hands over nothing", () => {
  it("disables the export with a reason and asks for nothing on a click", async () => {
    answer({ items: [], nextCursor: null });
    await render(`/audit?window=custom&from=${FROM}&to=${TO}`);
    await waitFor(() => textOf("aud01-empty") !== null, "the empty panel is painted");
    const button = document.querySelector<HTMLButtonElement>("[data-testid='aud01-export']");
    expect(button?.disabled).toBe(true);
    expect((button?.getAttribute("title") ?? "").length).toBeGreaterThan(0);
    const before = urls();
    await act(async () => {
      button?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(urls()).toEqual(before);
    expect(captured.downloads).toHaveLength(0);
    expect(listReads()).toBe(1);
    expect(textOf("aud5-export-count")).toContain("0");
  });

  it("exporting what is already loaded sends no request of its own", async () => {
    answer(THREE);
    await render(`/audit?window=custom&from=${FROM}&to=${TO}`);
    await waitFor(() => paintedRows().length === 3, "rows painted");
    const before = urls();
    expect(listReads()).toBe(1);
    const file = await exportFile();
    expect(dataLines(file.csv)).toHaveLength(3);
    expect(urls()).toEqual(before);
  });
});
