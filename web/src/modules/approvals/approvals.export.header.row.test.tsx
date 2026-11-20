// @vitest-environment jsdom
/**
 * R254：审批导出 header/row 三源锁，补齐折叠面板打开态（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款）：
 *  - 工单①「默认站表头逐字」= R219 纯函数列序冻结 + R231/R246 页面站
 *    grid[0] 逐字（排序/筛选站）；「逻辑行数==表体+1（含表头）」此前只以
 *    「数据行数==表体」形态锁过（R235/R246），整段行数含表头为本次直锁。
 *  - 工单②「筛选折叠面板打开态（openFilters）下导出」= 真缺口：P0-③ 起
 *    筛选控件默认收起，apv-filter-toggle 展开与收起本身是否零请求、展开态
 *    三值（apv5-count==表体==导出读数与 blob 行数）是否仍同源——此前所有
 *    导出用例都在折叠态站点操作，面板打开态从未导出过。
 *  - 工单③「含逗号/引号的 requestId」：RFC4180 往返此前只对 title 腿锁过
 *    （R217 HAZARD 纯函数 + 页面站逗号引号 title）；rid 腿的引号双写与
 *    parseCsv 状态机还原逐字、以及同屏「复制给短码 / CSV 给全串」两处各自
 *    逐字 = 新站。缺值双载体列头/空字段 = R182/R217/R250 家族回证据。
 *  - 分页=R251、排序=R248/R231/R253 —— 勿重写，本文件不翻页不点排序。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ onClick, children, ...rest }: { onClick?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: React.ReactNode }) => <div {...rest}>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";
import ApprovalsPendingModulePage from "./ApprovalsPendingModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
const mounted: HTMLDivElement[] = [];

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

async function render(entry: string): Promise<void> {
  await mount(entry, ApprovalsHistoryModulePage);
}

async function renderPending(entry: string): Promise<void> {
  await mount(entry, ApprovalsPendingModulePage);
}

async function mount(entry: string, Page: typeof ApprovalsHistoryModulePage): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Page />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots.length = 0;
  for (const el2 of mounted) el2.remove();
  mounted.length = 0;
  api.fetchJSON.mockReset();
});

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((n) => !String(n.getAttribute("data-testid")).includes("-details-"))
    .map((n) => String(n.getAttribute("data-testid")).replace("apr5-row-", ""));
const clicks = () => api.fetchJSON.mock.calls.length;

/** P0-③ 契约：筛选控件默认收起，碰面板内控件前先展开；展开动作本身不应发请求。 */
const openFilters = async (): Promise<void> => {
  const toggle = q("apv-filter-toggle") as HTMLButtonElement | null;
  expect(toggle, "filter disclosure present").toBeTruthy();
  if (toggle!.getAttribute("aria-expanded") === "true") return;
  await act(async () => {
    toggle!.click();
  });
  await waitFor(() => toggle!.getAttribute("aria-expanded") === "true", "filter panel opened");
};

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

async function grabCsvRaw(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:header-row-254";
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
  const text = await blobs[0].text();
  return { text, grid: parseCsv(text) };
}

const stubClipboard = (written: string[]): void => {
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

async function copyRowIndex(index: number, written: string[]): Promise<string> {
  const before = clicks();
  await openCopy(index);
  await waitFor(() => written.length > 0, "row copy landed");
  expect(clicks(), "row copy never refetches").toBe(before);
  return written[written.length - 1];
}

const openCopy = async (index: number): Promise<void> => {
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `row copy button ${index}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
};

const HAZRID = 'req-2026,"quote"87654321';
const HR1 = {
  approvalId: "ap_hr1",
  title: "header carrier one",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: HAZRID,
  approvers: [{ userId: "human:7", name: "郑涛" }],
};
const HR2 = {
  approvalId: "ap_hr2",
  title: "header carrier two",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "req-plain-11112222",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation((url: unknown) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      return Promise.resolve(id === "ap_hr1" ? { ...HR1 } : id === "ap_hr2" ? { ...HR2 } : {});
    }
    return Promise.resolve({ items: [HR1, HR2] });
  });
};

describe("R254 approvals export header/row three-source guards", () => {
  it("locks the header byte-for-byte and the whole logical line count on the default station", async () => {
    serve();
    await render("/approvals?tab=history");
    expect(rowIds()).toEqual(["ap_hr1", "ap_hr2"]);
    const { grid } = await grabCsvRaw();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    // 逻辑行数（含表头一行）== 表体行数 + 1，且数据行与屏上同序
    expect(grid.length).toBe(rowIds().length + 1);
    expect(grid.slice(1).map((r) => r[0])).toEqual(rowIds());
    expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
  });

  it("keeps the three sources in sync with the filter panel opened, and the toggle itself asks for nothing", async () => {
    serve();
    // 现场形态裁决：P0-③ 筛选折叠面板（apv-filter-toggle）挂在 pending 页，
    // history 页筛选控件常显无折叠。工单②「折叠面板打开态」按现场站型落
    // pending tab；导出读数/blob 两腿与 history 站同源。
    await renderPending("/approvals?tab=pending");
    expect(rowIds()).toEqual(["ap_hr1", "ap_hr2"]);
    const settled = clicks();
    await openFilters();
    expect(clicks(), "opening the filter disclosure asks for nothing").toBe(settled);
    // 面板打开态：导出读数与真实 blob 同源。现场裁决：apv5-count 是 history
    // 页计数载体（pending 页读数行不同名），三值中的「计数位」腿由 ① 的
    // history 站锁，本站锁 表体==导出读数==blob 行数。
    expect(rowIds()).toEqual(["ap_hr1", "ap_hr2"]);
    expect(q("apv7-export-count")?.textContent).toBe("共 2 行");
    const opened = clicks();
    const { grid } = await grabCsvRaw();
    expect(grid.length).toBe(3); // header + 2，与折叠态导出同一集合
    expect(grid.slice(1).map((r) => r[0])).toEqual(["ap_hr1", "ap_hr2"]);
    expect(clicks(), "export from the opened panel adds no read").toBe(opened);
  });

  it("round-trips a comma-and-quote requestId byte-for-byte while the copy shows only the short code", async () => {
    serve();
    await render("/approvals?tab=history");
    const { text, grid } = await grabCsvRaw();
    // 引号双写真的出现（RFC4180 转义腿），随后状态机还原为逐字原串
    expect(text).toContain('"req-2026,""quote""87654321"');
    const hazard = grid.find((r) => r[0] === "ap_hr1");
    const plain = grid.find((r) => r[0] === "ap_hr2");
    expect(hazard?.[6]).toBe(HAZRID);
    expect(plain?.[6]).toBe("req-plain-11112222");
    // 同一行的屏上复制：短码只给后 8 位，全串（含引号段）不落在复制文本
    const written: string[] = [];
    stubClipboard(written);
    const copied = await copyRowIndex(0, written);
    expect(copied).toContain("短码：87654321");
    expect(copied).not.toContain(HAZRID);
    expect(copied).not.toMatch(/undefined|null/);
  });
});
