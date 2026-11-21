// @vitest-environment jsdom
/**
 * R259：审批导出×复制的时间列跨态精度护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据文件:行）：
 *  - 「屏上 title 绝对分钟 == CSV updated_at」两腿 = approvals.columns.lock
 *    .test.tsx it② L213（R219）与 approvals.decision.parity.test.tsx L277
 *    （R168 链路）；「缺 updated_at CSV 空字段」= columns.lock it① L125、
 *    csv.roundtrip L220；「屏上缺值腿=该字段未返回」= rowcopy.window/
 *    R244 家族。
 *  - 本文件真增量：①把第三腿「列表复制更新时间段」并入同一帧，三段互等
 *    （复制段==cells[4]==absMinute(屏上 title)，此前任何站都没在同一行上
 *    同时比过三腿）；缺值行的三处各自口径同帧对照（复制「—」/CSV 空/
 *    屏上「该字段未返回」，各按现状、禁互相冒充）。
 *  - ②翻页追加后逐行三段对齐（防追加错位：id 为键逐行映射，R235/R253 只
 *    锁首行与序，未锁时间列逐行）。
 *  - ③切 ?status=approved 再切回（entry 重挂站型，区别于 R246 快捷钮
 *    整 grid 互等）：updated_at 全列显式映射 toEqual。
 */
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ onClick, children, ...rest }: { onClick?: () => void; children?: ReactNode }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, unknown>)}>{children}</div>
  ),
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

const clearScreen = (): void => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
};

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
});

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

async function render(entry = "/approvals?tab=history"): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
const clicks = (): number => api.fetchJSON.mock.calls.length;

function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && src[i + 1] === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      i += 1;
    } else if (ch === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

async function grabCsv(): Promise<string[][]> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:time-precision-259";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  expect(blobs.length, "one blob per export").toBe(1);
  expect(clicks(), "export never refetches").toBe(before);
  return parseCsv(await blobs[0].text());
}

const written: string[] = [];
const stubClipboard = (): void => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return Promise.resolve();
      },
    },
  });
};

/** 按审批号复制该行并返回「更新时间」段（复制零请求内置锁 + written 差分等待）。 */
async function updatedSegmentOf(id: string): Promise<string> {
  const index = rowIds().indexOf(id);
  expect(index, `row ${id}`).toBeGreaterThanOrEqual(0);
  const before = clicks();
  const seen = written.length;
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `copy button for ${id}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => written.length > seen, "copy landed");
  expect(clicks(), "row copy never refetches").toBe(before);
  const line = written[written.length - 1].split("\n").find((l) => l.startsWith("更新时间："));
  expect(line, "更新时间 segment present").toBeTruthy();
  return String(line).replace("更新时间：", "");
}

/** 屏上时间载体的绝对分钟句（title 前缀「绝对 」占 3 个字符位）。 */
const absMinuteOf = (id: string): string => {
  const title = q(`apv-time-row-${id}`)?.getAttribute("title") ?? "";
  return title.slice(3, 19);
};

const TIME = "2026-11-19 10:00";
const TP1 = {
  approvalId: "ap_tp1",
  title: "时间精度一号",
  status: "approved",
  riskLevel: "high",
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
  requestId: "req-tp-11112222",
};
const TP2 = {
  approvalId: "ap_tp2",
  title: "时间精度二号",
  status: "approved",
  riskLevel: "low",
  createdAt: "2026-11-18T02:00:00Z",
  decidedAt: "2026-11-19T03:00:00Z",
  requestId: "req-tp-33334444",
};
const GAP = {
  approvalId: "ap_gap",
  title: "缺时间主角单",
  status: "approved",
  createdAt: "2026-11-17T01:00:00Z",
  // 无 decidedAt/closedAt/updatedAt：缺值三处各口径主角
};

const baseServe = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    return { items: [TP1, GAP] };
  });
};

const pagedServe = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("cursor=")) {
      return { items: [GAP, TP2] }; // GAP 重复行去重，TP2 为追加新行
    }
    return { items: [TP1, GAP], nextCursor: "pc-2" }; // 首页带游标，more 才可点
  });
};

const allServe = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    return { items: [TP1, TP2, GAP] };
  });
};

describe("R259 approvals export time precision guards", () => {
  it("keeps copy segment, CSV updated_at and the on-screen absolute minute byte-equal in one frame", async () => {
    baseServe();
    stubClipboard();
    await render();
    expect(rowIds()).toEqual(["ap_tp1", "ap_gap"]);
    const grid = await grabCsv();
    // 有值行：三段互等
    const seg = await updatedSegmentOf("ap_tp1");
    const cell = grid.find((r) => r[0] === "ap_tp1")?.[4];
    expect(seg).toBe(TIME);
    expect(cell, "CSV updated_at==复制段").toBe(seg);
    expect(absMinuteOf("ap_tp1"), "屏上 title 分钟==复制段").toBe(seg);
    // 缺值行：三处各自口径同帧，禁互相冒充
    const gapSeg = await updatedSegmentOf("ap_gap");
    const gapCell = grid.find((r) => r[0] === "ap_gap")?.[4];
    expect(gapSeg, "复制缺值口径=—").toBe("—");
    expect(gapCell, "CSV 缺值口径=空字段").toBe("");
    expect(q("apv-time-row-ap_gap")?.textContent, "屏上缺值口径=该字段未返回").toBe(
      "该字段未返回",
    );
  });

  it("stays byte-accurate row by row on the second page instead of drifting with appended rows", async () => {
    pagedServe();
    stubClipboard();
    await render();
    const btn = q("apv-page-more") as HTMLButtonElement | null;
    expect(btn, "more button").toBeTruthy();
    if (!btn!.disabled) {
      await act(async () => {
        btn!.click();
      });
    }
    await waitFor(() => rowIds().join(",") === "ap_tp1,ap_gap,ap_tp2", "page 2 appended");
    const grid = await grabCsv();
    expect(grid.length - 1, "CSV 数据行==追加后表体").toBe(rowIds().length);
    // 逐行三段对齐（id 为键，防追加错位）
    const expected: Record<string, string> = {
      ap_tp1: TIME,
      ap_gap: "",
      ap_tp2: "2026-11-19 11:00",
    };
    for (const id of rowIds()) {
      const seg = await updatedSegmentOf(id);
      const cell = grid.find((r) => r[0] === id)?.[4];
      expect(cell, `CSV cell for ${id}`).toBe(expected[id]);
      expect(seg, `copy segment for ${id}`).toBe(expected[id] === "" ? "—" : expected[id]);
      if (expected[id] !== "") {
        expect(absMinuteOf(id), `on-screen minute for ${id}`).toBe(expected[id]);
      }
    }
    expect(rowIds().filter((r) => r === "ap_gap").length, "去重后 GAP 只一行").toBe(1);
  });

  it("re-exports the identical updated_at column after switching status away and back", async () => {
    allServe();
    await render("/approvals?tab=history&status=approved");
    const first = await grabCsv();
    const firstTimes = first.slice(1).map((r) => r[4]);
    clearScreen();
    api.fetchJSON.mockReset();
    allServe();
    await render("/approvals?tab=history");
    const back = await grabCsv();
    const backTimes = back.slice(1).map((r) => r[4]);
    expect(backTimes, "切回后 updated_at 全列逐字相等").toEqual(firstTimes);
    expect(firstTimes).toEqual([TIME, "2026-11-19 11:00", ""]);
  });
});
