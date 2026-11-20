// @vitest-environment jsdom
/**
 * R171 — /system 时间三处同源护栏（纯测试，零产品码改动）。
 *
 * 派工单的四例原文与本轮现查结果（先 `git grep` 的纪律已执行）：
 *
 * ①「同一读源的采集时刻在『读源矩阵 asof』『事件表时间列』『行复制文本』三处逐字相同」
 *    —— 事件表时间列在本代不存在：health 模块没有事件表，`sys-evt-copy-*` 全仓只出现在两处
 *    记录「它不存在」的注释里（`system.filters.test.tsx:5-14`、`system.state.isolation.test.tsx:18`；
 *    R124 放弃、R145/R148/R155/R163 五条车道复核）。所以 ① 的第二腿换成同一次读源真正落到屏上的
 *    时间面：矩阵采集时刻单元格 `sys6-asof-*` / 内层 `sys8-asof-*`、展开全文 `sys15-full-asof-*`
 *    （此前从未与兄弟面逐字对过）、复制列第五列（pipe `sys10-copy` 与 tab `sys-matrix-copy`），
 *    再加健康清单侧的 `sys3-asof`／逐行 `sys3-checked`／R92 行复制 `sys-row-copy-<i>` 第三段
 *    （此前从未与任何屏上时间面对过）与探针 `hlt5-asof-*`。探针面只有 console/runtime/domain 三行
 *    带采集时刻（health 走 `sys3-*` 服务清单，没有探针行），所以凡遍历 `hlt5-asof-*` 的断言只走
 *    `PROBE_IDS`，否则取到不存在的节点。
 * ② 沿用 R112 口径：刷新时刻 `sys-updated-at` 不得冒充数据时刻，三处（本轮扩为全部时间面）
 *    任一都不得等于它、也不得被它覆盖。
 * ③ 时区口径一致：屏上可见时刻只允许「北京时间到分」一种形态，ISO 原文只能活在 title。
 * ④「切时间窗后三处同步换代」—— health 不读 `?window=`（该参数只由 `modules/audit/
 *    AuditEventsModulePage` 读，见 R135 的现查结论），本代没有可切的时间窗。诚实替代：
 *    换代 = 重新读取后全部时间面走进新一代读数，且上一代读数在表体与复制文本里零残留。
 *
 * 既有用例已覆盖的部分只回证据、不重复：R112 `system.refresh.test.tsx:104-123`（刷新戳 ≠ 每个
 * 采集时刻单元格，含矩阵）、R100 `system.matrix.copy.test.tsx` 例 ③（2031 假时钟下复制文本不含
 * 刷新戳）、R98 `system.matrix.test.tsx:186-187`（读 `sys-updated-at`）与 :168-199（跨面
 * `sys6-asof-health`==`sys3-asof`、`sys6-asof-<探针>`==`hlt5-asof-<探针>`）、R159 例 ①（复制五格
 * 与 DOM 锚逐字，含采集时刻列）、R92 `system.rowcopy.test.tsx`（行复制文本本身）、`SourceMatrix
 * .test.tsx:139-140`（`sys8-asof-health` == `sys3-checked`）。本文件补的是这三条从未闭合的链：
 * 展开行全文 `sys15-full-asof-*` 与兄弟面同源、行复制第三段与屏上 `sys3-checked` 同源、
 * 以及"全部时间面同一显示口径"与"换代零残留"。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => api.fetchJSON(...args) }));

const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Button: ({ children, outlined, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    void outlined;
    return <button {...props}>{children}</button>;
  },
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { HealthPage } from "./HealthPage";
import { resetSourceMatrix } from "./sourceReads";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let clipWrite: ReturnType<typeof vi.fn>;

const IDS = ["health", "console", "runtime", "domain"] as const;
type Id = (typeof IDS)[number];
/** `hlt5-*` 探针行只有三个读口；health 走的是 `sys3-*` 服务清单面，没有探针行。 */
const PROBE_IDS = ["console", "runtime", "domain"] as const;

/** 每个读口的顶层 ISO 各不相同，所以任何一个时间面都能被认出是谁的值。 */
const T1: Record<Id, string> = {
  health: "2026-11-19 23:17",
  console: "2026-11-19 09:30",
  runtime: "2026-11-19 10:45",
  domain: "2026-11-19 12:15",
};
const T2: Record<Id, string> = {
  health: "2026-11-20 08:05",
  console: "2026-11-20 11:10",
  runtime: "2026-11-20 12:20",
  domain: "2026-11-20 13:25",
};
const LABEL: Record<Id, string> = {
  health: "系统健康清单",
  console: "控制台服务探针",
  runtime: "Hermes 运行时探针",
  domain: "域服务探针",
};

const GEN1: Record<Id, unknown> = {
  health: {
    ok: true,
    asOf: "2026-11-19T15:17:09Z",
    sources: [
      { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
      { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 },
    ],
  },
  console: { status: "healthy", asOf: "2026-11-19T01:30:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-19T02:45:00Z" },
  domain: { items: [], asOf: "2026-11-19T04:15:00Z" },
};
const GEN2: Record<Id, unknown> = {
  health: {
    ok: true,
    asOf: "2026-11-20T00:05:00Z",
    sources: [
      { id: "svc-a", name: "控制台服务", status: "ok", version: "4.2.1", latencyMs: 12 },
      { id: "svc-b", name: "域服务", status: "ok", version: "0.9.1", latencyMs: 7 },
    ],
  },
  console: { status: "healthy", asOf: "2026-11-20T03:10:00Z" },
  runtime: { status: "healthy", asOf: "2026-11-20T04:20:00Z" },
  domain: { items: [], asOf: "2026-11-20T05:25:00Z" },
};

const PIPE_HEADER = ["口径名", "路径", "状态", "耗时", "采集时刻"];
const CALIBER = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

function keyOf(url: string): Id {
  if (url.includes("/api/health")) return "health";
  if (url.includes("__health-probe__")) return "console";
  if (url.includes("hermes-summary")) return "runtime";
  return "domain";
}

function arm(gen: Record<Id, unknown>): void {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: unknown) => gen[keyOf(String(url))]);
}

/** 换代用：只换实现、不清调用历史，首载那几笔仍留在计数里。 */
function rearm(gen: Record<Id, unknown>): void {
  api.fetchJSON.mockImplementation(async (url: unknown) => gen[keyOf(String(url))]);
}

/** 请求计数：Vitest 收尾会以无参形式调用 mock，那一次不算读口调用。 */
function reads(): string[] {
  return api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  // 迭代封顶而不是墙钟：本文件冻 `Date`，`Date.now()` 读到的截止期永远不会到，循环会转到
  // vitest 15 s 判死并把空白渲染传染给同文件后面的用例。
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return container.querySelector<T>(`[data-testid='${testid}']`);
}

function must<T extends HTMLElement = HTMLElement>(testid: string): T {
  const el = q<T>(testid);
  if (!el) throw new Error(`missing node [data-testid='${testid}']`);
  return el;
}

function text(testid: string): string {
  return must(testid).textContent ?? "";
}

function all(testidPrefix: string): Element[] {
  return [...container.querySelectorAll(`[data-testid^='${testidPrefix}']`)];
}

function checkedTexts(): string[] {
  return [...container.querySelectorAll("[data-testid='sys3-checked']")].map((node) => node.textContent ?? "");
}

/** 一次读源真正落到屏上的时间面（展开行全文除外：同一时刻只允许一行展开，只能逐景取）。 */
function screenFaces(): { name: string; value: string }[] {
  const faces: { name: string; value: string }[] = [];
  for (const id of IDS) {
    faces.push({ name: `sys6-asof-${id}`, value: text(`sys6-asof-${id}`) });
    faces.push({ name: `sys8-asof-${id}`, value: text(`sys8-asof-${id}`) });
  }
  for (const id of PROBE_IDS) {
    faces.push({ name: `hlt5-asof-${id}`, value: text(`hlt5-asof-${id}`) });
  }
  faces.push({ name: "sys3-asof", value: text("sys3-asof") });
  checkedTexts().forEach((value, index) => faces.push({ name: `sys3-checked#${index}`, value }));
  return faces;
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(<HealthPage />);
  });
  await act(async () => {});
}

async function mount(gen: Record<Id, unknown>): Promise<void> {
  arm(gen);
  await render();
  await waitFor(() => !!q("sys3-table"), "the health table renders");
  await act(async () => {
    q<HTMLButtonElement>("sys6-toggle")?.click();
  });
  await waitFor(() => all("sys6-row-").length === 4, "the 读源矩阵 expands to four rows");
}

async function openDetail(id: Id): Promise<void> {
  await act(async () => {
    q<HTMLButtonElement>(`sys15-row-toggle-${id}`)?.click();
  });
  await waitFor(() => !!q(`sys15-detail-${id}`), `the 全文 row of ${id} opens`);
}

/** 矩阵的两把复制键都走原生 navigator，不走 copyTextToClipboard 助手。 */
async function copyVia(testid: string): Promise<string> {
  clipWrite.mockClear();
  const button = q<HTMLButtonElement>(testid);
  if (!button) throw new Error(`missing copy button ${testid}`);
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => clipWrite.mock.calls.length > 0, `${testid} writes to the clipboard`);
  return String(clipWrite.mock.lastCall?.[0] ?? "");
}

/** R92 的行复制走 @/lib/clipboard 助手；按 DOM 顺序逐行取，段序 = 表体行序。 */
async function copyEveryRow(): Promise<string[]> {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>("button[data-testid^='sys-row-copy-']")];
  const lines: string[] = [];
  for (const button of buttons) {
    clipboard.copyTextToClipboard.mockClear();
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    await waitFor(() => clipboard.copyTextToClipboard.mock.calls.length > 0, "the row copy helper fires");
    lines.push(String(clipboard.copyTextToClipboard.mock.lastCall?.[0] ?? ""));
  }
  return lines;
}

function columns(text: string, sep: string): string[][] {
  return text.trimEnd().split("\n").map((line) => line.split(sep));
}

function col5(lines: string[][], label: string): string {
  const row = lines.find((cells) => cells[0] === label);
  if (!row) throw new Error(`no copied line for ${label}`);
  return row[4] ?? "";
}

async function clickRefresh(): Promise<void> {
  const button = q<HTMLButtonElement>("sys-refresh");
  if (!button) throw new Error("sys-refresh is not on screen");
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
  await waitFor(() => !!q("sys-updated-at"), "the read stamp lands");
}

function tableSurfaces(): string {
  return [text("sys3-table"), text("hlt5-list"), text("sys6-table")].join("\n");
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  clipWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipWrite } });
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetSourceMatrix();
  window.history.replaceState({}, "", "/system?tab=health");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  resetSourceMatrix();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R171 — /system 采集时刻三处同源", () => {
  it("① 一次读源的采集时刻在矩阵单元格、展开全文与两种复制列里逐字相同", async () => {
    await mount(GEN1);

    const pipe = columns(await copyVia("sys10-copy"), " | ");
    const tab = columns(await copyVia("sys-matrix-copy"), "\t");
    expect(pipe[0]).toEqual(PIPE_HEADER);
    expect(tab[0]).toEqual(PIPE_HEADER);

    for (const id of IDS) {
      const cell = text(`sys8-asof-${id}`);
      expect(cell, id).toBe(T1[id]);
      expect(text(`sys6-asof-${id}`), id).toBe(cell);
      expect(col5(pipe, LABEL[id]), `${id} pipe`).toBe(cell);
      expect(col5(tab, LABEL[id]), `${id} tab`).toBe(cell);
      // 全文行是唯一值状态：开一行读一行，开下一行会收起上一行。
      await openDetail(id);
      expect(text(`sys15-full-asof-${id}`), id).toBe(cell);
    }

    expect(text("sys3-asof")).toBe(T1.health);
    for (const id of PROBE_IDS) {
      expect(text(`hlt5-asof-${id}`), id).toBe(T1[id]);
    }

    const checked = checkedTexts();
    expect(checked.length).toBeGreaterThan(0);
    for (const value of checked) expect(value).toBe(T1.health);

    const rows = await copyEveryRow();
    expect(rows).toHaveLength(checked.length);
    rows.forEach((line, index) => {
      expect(line.split(" · ")[2], `row copy ${index}`).toBe(checked[index]);
    });

    expect(reads()).toHaveLength(4);
  });

  it("② 刷新时刻只写 sys-updated-at：假时钟 2031 下没有任何时间面、复制文本或行复制沾染它", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    await mount(GEN1);
    expect(q("sys-updated-at")).toBeNull();

    await clickRefresh();
    const stamp = text("sys-updated-at");
    expect(stamp).toContain("（读取时刻，不是数据时刻）");
    expect(stamp).toContain("2031");
    const picked = /刷新完成于 (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/.exec(stamp);
    expect(picked, "the stamp carries a Beijing minute").not.toBeNull();
    const stampValue = picked?.[1] ?? "";

    for (const face of screenFaces()) {
      expect(face.value, face.name).not.toContain("2031");
      expect(face.value, face.name).not.toContain("刷新完成于");
      expect(face.value, face.name).not.toBe(stampValue);
    }
    for (const id of IDS) {
      expect(text(`sys8-asof-${id}`), id).toBe(T1[id]);
      await openDetail(id);
      expect(text(`sys15-full-asof-${id}`), id).toBe(T1[id]);
    }

    const pipe = await copyVia("sys10-copy");
    const tab = await copyVia("sys-matrix-copy");
    for (const copied of [pipe, tab]) {
      expect(copied).not.toContain("2031");
      expect(copied).not.toContain("刷新完成于");
      expect(copied).not.toContain(stampValue);
    }
    const pipeCols = columns(pipe, " | ");
    const tabCols = columns(tab, "\t");
    for (const id of IDS) {
      expect(col5(pipeCols, LABEL[id]), `${id} pipe`).toBe(text(`sys8-asof-${id}`));
      expect(col5(tabCols, LABEL[id]), `${id} tab`).toBe(text(`sys8-asof-${id}`));
    }

    const rows = await copyEveryRow();
    for (const line of rows) {
      expect(line).not.toContain("2031");
      expect(line).not.toContain(stampValue);
      expect(line.split(" · ")[2]).toBe(text("sys3-asof"));
    }

    expect(reads()).toHaveLength(8);
  });

  it("③ 显示口径只有一种：可见时刻全是北京时间到分，ISO 原文只活在 title 里", async () => {
    await mount(GEN1);
    const forbidden = ["T", "Z", "+08:00", "UTC", "北京时间", "上午", "下午"];

    for (const face of screenFaces()) {
      const honest = face.value === "—" || CALIBER.test(face.value);
      expect(honest, `${face.name} = ${face.value}`).toBe(true);
      if (face.value !== "—") {
        for (const word of forbidden) {
          expect(face.value.includes(word), `${face.name} carries 「${word}」`).toBe(false);
        }
      }
    }
    for (const id of IDS) {
      await openDetail(id);
      const detail = text(`sys15-full-asof-${id}`);
      expect(detail === "—" || CALIBER.test(detail), `${id} 全文 = ${detail}`).toBe(true);
    }

    const pipe = columns(await copyVia("sys10-copy"), " | ");
    const tab = columns(await copyVia("sys-matrix-copy"), "\t");
    for (const id of IDS) {
      for (const [name, cols] of [["pipe", pipe], ["tab", tab]] as const) {
        const cell = col5(cols, LABEL[id]);
        expect(cell === "—" || CALIBER.test(cell), `${id} ${name} copied = ${cell}`).toBe(true);
      }
    }
    for (const line of await copyEveryRow()) {
      const segment = line.split(" · ")[2] ?? "";
      expect(segment === "—" || CALIBER.test(segment), `row copy segment = ${segment}`).toBe(true);
    }

    // ISO 原文是工程上下文，只进 title；屏上是北京时间。
    const cellTitle = must(`sys6-asof-health`).getAttribute("title") ?? "";
    expect(cellTitle).toContain("UTC 原文：2026-11-19T15:17:09Z");
    expect(cellTitle).toContain("北京时间：2026-11-19 23:17");
    expect(cellTitle).toContain("不使用本机时钟");
    expect(must(`sys8-asof-health`).getAttribute("title") ?? "").toContain("UTC 原文：2026-11-19T15:17:09Z");
    expect(tableSurfaces()).not.toContain("2026-11-19T15:17:09Z");

    // 刷新戳与数据时刻同一显示口径，靠后缀区分，不靠格式区分。
    await clickRefresh();
    const picked = /刷新完成于 (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/.exec(text("sys-updated-at"));
    expect(picked, "the refresh stamp is a Beijing minute too").not.toBeNull();
    expect(CALIBER.test(picked?.[1] ?? "")).toBe(true);
    expect(text("sys-updated-at")).toContain("（读取时刻，不是数据时刻）");

    expect(reads()).toHaveLength(8);
  });

  it("④ 换代后全部时间面一起走进新一代，上一代读数在表体与复制文本里零残留", async () => {
    await mount(GEN1);
    const before = { matrix: all("sys6-row-").length, services: checkedTexts().length, probes: all("hlt5-row-").length };
    const oldPipe = await copyVia("sys10-copy");
    const oldTab = await copyVia("sys-matrix-copy");
    const oldRows = await copyEveryRow();
    expect(oldRows).toHaveLength(before.services);
    for (const id of IDS) {
      expect(col5(columns(oldPipe, " | "), LABEL[id]), `${id} old pipe`).toBe(T1[id]);
      expect(col5(columns(oldTab, "\t"), LABEL[id]), `${id} old tab`).toBe(T1[id]);
    }

    // 反向可判：换代先前代读数确实落在表体里，否则「零残留」是空断言。
    for (const id of IDS) expect(tableSurfaces(), `gen1 ${id} on screen`).toContain(T1[id]);

    // 换代只换实现，不 mockReset：否则首载的四笔被清掉，计数就不再是「同一 URL 两代共 8 次」。
    rearm(GEN2);
    await clickRefresh();

    expect(all("sys6-row-")).toHaveLength(before.matrix);
    expect(checkedTexts()).toHaveLength(before.services);
    expect(all("hlt5-row-")).toHaveLength(before.probes);

    for (const id of IDS) {
      expect(text(`sys6-asof-${id}`), id).toBe(T2[id]);
      expect(text(`sys8-asof-${id}`), id).toBe(T2[id]);
    }
    for (const id of PROBE_IDS) {
      expect(text(`hlt5-asof-${id}`), id).toBe(T2[id]);
    }
    expect(text("sys3-asof")).toBe(T2.health);
    const checked = checkedTexts();
    for (const value of checked) expect(value).toBe(T2.health);
    for (const id of IDS) {
      await openDetail(id);
      expect(text(`sys15-full-asof-${id}`), id).toBe(T2[id]);
    }

    const surfaces = tableSurfaces();
    for (const stale of Object.values(T1)) {
      expect(surfaces.includes(stale), `表体残留上一代 ${stale}`).toBe(false);
    }

    const newPipe = await copyVia("sys10-copy");
    const newTab = await copyVia("sys-matrix-copy");
    const newPipeCols = columns(newPipe, " | ");
    const newTabCols = columns(newTab, "\t");
    for (const id of IDS) {
      expect(col5(newPipeCols, LABEL[id]), `${id} new pipe`).toBe(T2[id]);
      expect(col5(newTabCols, LABEL[id]), `${id} new tab`).toBe(T2[id]);
    }
    for (const copied of [newPipe, newTab]) {
      for (const stale of Object.values(T1)) {
        expect(copied.includes(stale), `复制文本残留上一代 ${stale}`).toBe(false);
      }
    }

    const rows = await copyEveryRow();
    expect(rows).toHaveLength(checked.length);
    rows.forEach((line, index) => {
      expect(line.split(" · ")[2], `row copy ${index}`).toBe(checked[index]);
      for (const stale of Object.values(T1)) {
        expect(line.includes(stale), `行复制残留上一代 ${stale}`).toBe(false);
      }
    });

    expect(reads()).toHaveLength(8);
  });
});
