// @vitest-environment jsdom
/**
 * R273：审批行复制与分页一致性（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 六段↔CSV 逐列配对（含缺值双口径与短码=rid 后 8 位）
 *    = approvals.export.rowcopy.same.test.tsx it① L259/L299（R265）；
 *    翻页后 CSV 行序对齐=同文件 it②（R265）+export.paged it①（R235）；
 *    翻页+开详情+导出三值=export.detail.paging it①（R261）；
 *    深链筛选下导出不漂移=export.statusmatrix it②（R256）。
 *  - 真增量=「复制钮行序」与「翻页追加」的组合站：
 *    ①第 2 页追加后首行仍是第 1 页首行、追加去重（重复单只一张卡）、
 *      第 3 行复制钮存在且首段==该行单号；
 *    ②追加行（第 2 页新单）复制与 CSV 数据行逐列配对（标题/更新时间分钟/
 *      status 人话==屏上徽标）、列表腿恒 2、复制与导出零新增取数；
 *    ③?status=pending 深链站首行==CSV 首行==复制首段互等。
 *  - 现场案沿用：apv-page-more 依赖首页响应带 nextCursor 才可点（R259）。
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
  for (const node of mounted) node.remove();
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
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

function parseCsv(body: string): string[][] {
  const src = body.replace(/^\uFEFF/, "");
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

async function grabCsv(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:rowcopy-paging-273";
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
  const body = await blobs[0].text();
  return { text: body, grid: parseCsv(body) };
}

const written: string[] = [];
const stubClipboard = (): void => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (value: string) => {
        written.push(value);
        return Promise.resolve();
      },
    },
  });
};

/** 差分等待：上一站残留文本不能冒充本次复制（R258 教训）。 */
async function copyRowById(id: string): Promise<string> {
  const index = rowIds().indexOf(id);
  expect(index, `row ${id} present`).toBeGreaterThanOrEqual(0);
  const seen = written.length;
  await clickTestId(`apr-row-copy-${index}`);
  await waitFor(() => written.length > seen, `copy of ${id} landed`);
  return written[written.length - 1];
}

const PF1 = {
  approvalId: "ap_pf1",
  title: "首页首行单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-pf-11112222",
};
const PF2 = {
  approvalId: "ap_pf2",
  title: "首页次行单",
  status: "pending",
  riskLevel: "medium",
  createdAt: "2026-11-18T02:00:00Z",
};
const PF3 = {
  approvalId: "ap_pf3",
  title: "第二页追加单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T04:00:00Z",
  createdAt: "2026-11-18T03:00:00Z",
  requestId: "req-pf-33334444",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [PF1, PF2, PF3].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("cursor=")) return { items: [PF2, PF3] }; // PF2 重复=去重腿
    if (u.includes("status=pending")) return { items: [PF2] };
    return { items: [PF1, PF2], nextCursor: "pc-273" };
  });
};

describe("R273 approvals row copy paging guards", () => {
  it("keeps page-one order after appending, dedupes the repeated row, and the new copy button carries the appended id", async () => {
    serve();
    stubClipboard(written.length);
    await render();
    expect(rowIds()).toEqual(["ap_pf1", "ap_pf2"]);
    await clickTestId("apv-page-more");
    await waitFor(() => rowIds().length === 3, "page 2 appended");
    expect(rowIds()).toEqual(["ap_pf1", "ap_pf2", "ap_pf3"]);
    // 首行仍是第 1 页首行；重复的 ap_pf2 只有一张卡
    expect(rowIds()[0]).toBe("ap_pf1");
    expect(
      Array.from(document.querySelectorAll('[data-testid="apr5-row-ap_pf2"]')).length,
      "duplicate row deduped",
    ).toBe(1);
    const btn2 = q("apr-row-copy-2") as HTMLButtonElement | null;
    expect(btn2, "copy button for the appended row").toBeTruthy();
    const copied = await copyRowById("ap_pf3");
    expect(copied.split("\n")[0]).toBe("单号：ap_pf3");
  });

  it("pairs the appended row's copy segments with its CSV row cell by cell without extra reads", async () => {
    serve();
    await render();
    const before = clicks();
    await clickTestId("apv-page-more");
    await waitFor(() => rowIds().length === 3, "page 2 appended");
    const { grid } = await grabCsv();
    const data = grid.slice(1);
    expect(data.map((r) => r[0])).toEqual(rowIds());
    expect(listCalls(), "paging cost exactly one extra list read").toBe(2);
    stubClipboard(written.length);
    const copied = await copyRowById("ap_pf3");
    const seg = (prefix: string): string =>
      copied.split("\n").find((line) => line.startsWith(prefix)) ?? "";
    const row = data.find((r) => r[0] === "ap_pf3");
    expect(seg("标题：")).toBe(`标题：${row?.[1]}`);
    expect(row?.[2]).toBe("已通过"); // 现场 model APPROVED 人话单点=「已通过」（本轮定向暴露旧硬编码漂移，随单修正禁臆造）
    expect(row?.[4]).toBe("2026-11-19 12:00");
    expect(seg("更新时间：")).toBe(`更新时间：${row?.[4]}`);
    expect(clicks(), "copy costs no extra read").toBe(before + 1); // 唯一新增=翻页那条列表腿
  });

  it("holds the first-row chain on the ?status=pending station: screen, CSV and copy agree", async () => {
    api.fetchJSON.mockReset();
    serve();
    await render("/approvals?tab=history&status=pending");
    expect(rowIds()).toEqual(["ap_pf2"]);
    const last = api.fetchJSON.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/api/approvals?"))
      .at(-1);
    expect(last).toContain("status=pending");
    const { grid } = await grabCsv();
    expect(grid.length - 1).toBe(rowIds().length);
    expect(grid[1][0]).toBe(rowIds()[0]);
    stubClipboard(written.length);
    const copied = await copyRowById("ap_pf2");
    expect(copied.split("\n")[0]).toBe(`单号：${grid[1][0]}`);
    expect(copied).toContain("待处理");
  });
});
