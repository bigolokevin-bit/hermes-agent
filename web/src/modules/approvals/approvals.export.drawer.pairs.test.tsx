// @vitest-environment jsdom
/**
 * R275：审批导出与抽屉复制同一单的字段配对（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 「六段↔抽屉文本互等」= approvals.detail.copy.test.tsx（R162）it L161；
 *    「开态复制零额外请求」= 同文件 it L195；「缺值 gap 词」= 同文件 it L215。
 *  - 「默认站六段↔CSV 七列逐格配对」= approvals.export.rowcopy.same.test.tsx
 *    （R265）it①；「翻页后逐行配对」= 同文件 it②——该文件 grep 确认无
 *    抽屉开态 blob 站（grabCsvInDrawer/抽屉开态 计数=0）。
 *  - 「blob↔抽屉字段五列」= approvals.export.detail.parity（R255）it①，
 *    非「blob 七列↔apr-row-copy 六段」逐格。
 *  - 本文件真增量=**抽屉打开态同帧**：七列 blob 与六段复制逐格 toBe 配对、
 *    缺值行两侧口径、三值等式（CSV 数据行==表体==apv5-count）、
 *    apd7-back 关闭零请求且行序不变——组合站此前未整站锁。
 * 更正声明：前窗记录称本单已以 829061a3 交付并经上游并入——当轮
 *  git ls-tree origin/lane/hermes-console 终裁证伪（文件从未在任何链），
 *  本文件为磁盘终裁后从零真交付。
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
  Card: ({ children, ...rest }: { children?: ReactNode }) => <div {...rest}>{children}</div>,
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

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
});

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
const text = (): string => document.body.textContent ?? "";
const clicks = (): number => api.fetchJSON.mock.calls.length;
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;
const detailCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approval?id=")).length;
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const openDetail = async (id: string): Promise<void> => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
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

async function grabCsv(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:drawer-pairs-275";
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
  const csv = await blobs[0].text();
  return { text: csv, grid: parseCsv(csv) };
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

async function copyRowById(id: string): Promise<string> {
  const index = rowIds().indexOf(id);
  expect(index, `row ${index} for ${id}`).toBeGreaterThanOrEqual(0);
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, "copy button").toBeTruthy();
  const seen = written.length;
  const before = clicks();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => written.length > seen, "copy landed");
  expect(clicks(), "row copy never refetches").toBe(before);
  return written[written.length - 1];
}

const DP1 = {
  approvalId: "ap_dp1",
  title: "抽屉配对完整单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "DP1-12345678901234567890",
  approvers: [{ userId: "human:7", name: "郑涛" }],
};
const DP2 = {
  approvalId: "ap_dp2",
  title: "抽屉第二单",
  status: "rejected",
  riskLevel: "medium",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "DP2-87654321",
};
const DP3 = {
  approvalId: "ap_dp3",
  title: "抽屉缺值单",
  status: "pending",
  createdAt: "2026-11-18T03:00:00Z",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [DP1, DP2, DP3].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    return { items: [DP1, DP2, DP3] };
  });
};

describe("R275 approvals export x drawer copy pairs guards", () => {
  it("pairs every CSV cell of the full row with the copy segments while the drawer is open", async () => {
    serve();
    stubClipboard();
    await render("/approvals?tab=history");
    await openDetail("ap_dp1");
    const { grid } = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    const full = grid.find((r) => r[0] === "ap_dp1");
    expect(full, "csv row for ap_dp1").toBeTruthy();
    const copied = await copyRowById("ap_dp1");
    const lines = copied.split("\n");
    expect(lines.length, "six segments").toBe(6);
    expect(lines[0]).toBe(`单号：${full![0]}`);
    expect(lines[1]).toBe(`标题：${full![1]}`);
    expect(lines[2]).toBe(`状态：${full![2]}`);
    expect(lines[3]).toBe(`风险：${full![3]}`);
    expect(lines[4]).toBe(`更新时间：${full![4]}`);
    expect(lines[5]).toBe(`短码：${full![6].slice(-8)}`);
    // CSV rid 列=全串合法（R107），复制只给后 8 位短码，全串不落复制文本。
    expect(copied).not.toContain("DP1-12345678901234567890");
    expect(copied).not.toMatch(/undefined|null/);
  });

  it("keeps the gap row's two conventions apart in the same frame: empty CSV cells vs 复制「—」", async () => {
    serve();
    stubClipboard();
    await render("/approvals?tab=history");
    await openDetail("ap_dp3");
    const { grid } = await grabCsv();
    const gap = grid.find((r) => r[0] === "ap_dp3");
    expect(gap, "csv row for ap_dp3").toBeTruthy();
    expect(gap![3]).toBe("未标注风险"); // risk 缺值两侧同写人话（R107 现状）
    expect(gap![4]).toBe("");
    expect(gap![6]).toBe("");
    const copied = await copyRowById("ap_dp3");
    const lines = copied.split("\n");
    expect(lines[3]).toBe("风险：未标注风险");
    expect(lines[4]).toBe("更新时间：—");
    expect(lines[5]).toBe("短码：—");
    expect(copied).not.toMatch(/undefined|null|DP3-/);
    expect(grid.filter((r) => r.length > 1).length).toBeGreaterThan(1);
  });

  it("keeps three values in sync from the open drawer and leaves the rows untouched after 关闭", async () => {
    serve();
    await render("/approvals?tab=history");
    const orderBefore = rowIds();
    expect(orderBefore).toEqual(["ap_dp1", "ap_dp2", "ap_dp3"]);
    await openDetail("ap_dp1");
    expect(detailCalls(), "one detail read for the open drawer").toBe(1);
    expect(listCalls(), "the drawer costs no list read").toBe(1);
    const { grid } = await grabCsv();
    expect(grid.length - 1).toBe(rowIds().length);
    expect(Number(q("apv5-count")?.textContent)).toBe(rowIds().length);
    const beforeClose = clicks();
    await clickTestId("apd7-back");
    await waitFor(() => !q("apr5-detail"), "drawer closed");
    expect(rowIds()).toEqual(orderBefore);
    expect(clicks(), "closing the drawer asks for nothing").toBe(beforeClose);
    expect(text()).not.toMatch(/undefined|null/);
  });
});
