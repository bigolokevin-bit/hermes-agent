// @vitest-environment jsdom
/**
 * R260：审批导出跨 tab × 行复制三链同源（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行，不重写）：
 *  - 「同一单两页行复制六段逐字 + 零额外请求」=
 *    approvals.cross.page.test.tsx it② L257（双容器并排形态）；
 *    「同记录两页导出 blob 逐字 + 各站导出零请求」= 同文件 it④ L315；
 *    「单页筛选变更不动另一页」= 同文件 it③ L287。
 *  - 「CSV 单号列==复制首段逐行同序」=
 *    approvals.export.rowcopy.crossstate.test.tsx it① L241（history 三站）。
 *  - 「回切轮转互不残留」= approvals.export.statusmatrix.test.tsx it② L246；
 *    「跨 status 站六段互等」= approvals.rowcopy.stability.test.tsx L199。
 *  - 「空集导出 disabled+title+强点零 Blob+读数位『—』」=
 *    approvals.export.bounds.test.tsx it①（R229）+ approvals.empty.test.tsx
 *    it②（R211）。工单④逐字已锁，本文件只回证据。
 *  - 本文件真增量 = 跨 tab 组件「卸载重挂轮转」站型（此前是双容器并排或同页
 *    快捷钮换腿）：history ?status=approved&window=30d 站 → clearScreen →
 *    pending 站，同一单六段复制互等；pending 站三值同源
 *    （apv7-export-count==表体==blob 数据行）；pending 站导出只含本腿行、
 *    不含 history 站的 ap_tx2（跨 tab 残留防）；现场裁决注记：apv5-count
 *    是 history 页计数载体，pending 页无该 testid（R254 在案），本站以
 *    导出读数位替代并锁 null。
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
import ApprovalsPendingModulePage from "./ApprovalsPendingModulePage";

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

async function mountPage(entry: string, Page: typeof ApprovalsHistoryModulePage): Promise<void> {
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

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
const clicks = (): number => api.fetchJSON.mock.calls.length;

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

/** R258 教训：跨站剪贴板断言必须 written.length 差分等待，防上一站残留假绿。 */
async function copyRowById(id: string): Promise<string> {
  const index = rowIds().indexOf(id);
  expect(index, `row ${id} present`).toBeGreaterThanOrEqual(0);
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `copy button for ${id}`).toBeTruthy();
  const seen = written.length;
  const before = clicks();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => written.length > seen, `copy of ${id}`);
  expect(clicks(), "row copy never refetches").toBe(before);
  return written[written.length - 1];
}

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
    return "blob:tab-rowcopy-260";
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

const X1 = {
  approvalId: "ap_tx1",
  title: "跨 tab 一致单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-tx-11112222",
};
const X2 = {
  approvalId: "ap_tx2",
  title: "只在历史腿的行",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "req-tx-33334444",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [X1, X2].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    // pending 页数据腿恒 status=pending：只有 X1 在该腿
    if (u.includes("status=pending")) return { items: [X1] };
    return { items: [X1, X2] };
  });
};

describe("R260 approvals export tab-rowcopy cross-remount guards", () => {
  it("keeps the six copy segments, the CSV head column and the export counts identical across a tab remount rotation", async () => {
    stubClipboard(written);
    written.length = 0;
    serve();

    // —— 站 A：history ?status=approved&window=30d（window 为摆设参数，R129）
    await mountPage("/approvals?tab=history&status=approved&window=30d", ApprovalsHistoryModulePage);
    expect(rowIds()).toEqual(["ap_tx1", "ap_tx2"]);
    // ②行内腿：CSV 首列与复制首段逐行同序
    const historyGrid = await grabCsv();
    expect(historyGrid.slice(1).map((r) => r[0])).toEqual(rowIds());
    for (let i = 0; i < rowIds().length; i += 1) {
      const head = await copyRowById(rowIds()[i]);
      expect(head.split("\n")[0]).toBe(`单号：${historyGrid[i + 1][0]}`);
    }
    const sixA = await copyRowById("ap_tx1");
    expect(sixA.split("\n").length).toBe(6);
    expect(sixA).toContain("标题：跨 tab 一致单");
    expect(sixA).not.toMatch(/undefined|null/);
    const historyCounts = clicks();

    // —— 站 B：卸载重挂 pending tab（真实跨 tab 组件轮转，非双容器并排）
    clearScreen();
    expect(q("apr5-row-ap_tx1"), "station A fully unmounted").toBeNull();
    await mountPage("/approvals?tab=pending", ApprovalsPendingModulePage);
    expect(rowIds()).toEqual(["ap_tx1"]);
    // ①六段互等：同一单跨 tab 复制逐字不变（written 差分防残留假绿）
    const sixB = await copyRowById("ap_tx1");
    expect(sixB, "跨 tab 六段逐字互等").toBe(sixA);
    // ③跨 tab 残留防：pending 站导出只含本腿行，不含历史腿的 ap_tx2
    const pendingGrid = await grabCsv();
    expect(pendingGrid.slice(1).map((r) => r[0])).toEqual(["ap_tx1"]);
    expect(pendingGrid.map((r) => r.join(",")).join("\n")).not.toContain("ap_tx2");
    // pending 站三值同源：导出读数位==表体==blob 数据行
    expect(q("apv7-export-count")?.textContent).toBe("共 1 行");
    expect(q("apv7-export-count")?.textContent).toContain(String(rowIds().length));
    expect(pendingGrid.length - 1).toBe(rowIds().length);
    // 现场裁决注记：apv5-count 属 history 页载体，pending 页无该 testid
    expect(q("apv5-count"), "pending tab has no apv5-count carrier").toBeNull();
    // ③零额外请求：全程复制/导出不新增取数（两站各自内置锁之外再总核）
    expect(clicks(), "copies and exports across the rotation ask for nothing").toBe(historyCounts + 1);
  });

  it("notes the empty-station disabled export as evidence-only, relocking the pending side quick check", async () => {
    // 工单④逐字 = bounds it①（R229）/empty it②（R211）已锁；此处仅补一腿：
    // pending 数据腿返回空集合时导出钮 disabled 且强点零 Blob（同族形态
    // 在 pending 组件上此前未站过，bounds 的强点腿在 history 组件）。
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      return { items: [] };
    });
    await mountPage("/approvals?tab=pending", ApprovalsPendingModulePage);
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button present").toBeTruthy();
    expect(btn!.disabled, "empty pending station disables export").toBe(true);
    expect(String(btn!.getAttribute("title") ?? "").length, "stated reason").toBeGreaterThan(0);
    const before = clicks();
    const blobs: Blob[] = [];
    const orig = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    let called = 0;
    URL.createObjectURL = ((blob: Blob) => {
      blobs.push(blob);
      called += 1;
      return "blob:tab-empty-260";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    HTMLAnchorElement.prototype.click = () => undefined;
    try {
      await act(async () => {
        btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    } finally {
      URL.createObjectURL = orig;
      URL.revokeObjectURL = origRevoke;
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(called, "forced click creates no object URL").toBe(0);
    expect(blobs.length).toBe(0);
    expect(clicks(), "the empty station click asks for nothing").toBe(before);
    expect(q("apv7-export-count")?.textContent).toBe("—");
  });
});
