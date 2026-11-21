// @vitest-environment jsdom
/**
 * R263：审批导出关闭态与空详情列恒七格（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 工单①「详情从未打开时导出七列逐字且行数==表体==apv5-count」
 *    = approvals.export.header.row.test.tsx it①（R254 默认站表头逐字+逻辑
 *      行数==表体+1+apv5-count）+ approvals.export.statusmatrix.test.tsx
 *      it①（默认站逐行恒 7 格）——回证据，本文件不重写。
 *  - 工单③「500 形态下导出只含列表行、七格不塌、rid 可复制」
 *    = approvals.export.detail.parity.test.tsx it③ L296（R255：详情腿失败
 *      时导出照常三段落、apv5-count 与表体同步、重试恰 +1）——回证据。
 *  - 真缺口 = ②「开→关详情后导出与开前 blob 整体 toEqual（零残留）」：
 *      detail.parity it① 只锁开态 blob、multipage it② 的 apd7-back 只锁
 *      URL 与行序；关闭后再导出的 blob 等式此前未锁。
 *    + ③「403≡404 形态下 blob 只含列表行且恒 7 格 + rid 可复制」：
 *      detail.multipage it③（R244）锁的是 apr5-denied/apv-state-rid 文本与
 *      剪贴板回环，未在该站拦过导出 blob。本文件补这两腿。
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

import { ApiError } from "@/lib/api-error";
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
const detailCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approval?id=")).length;

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
    return "blob:closed-detail-263";
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

const CL1 = {
  approvalId: "ap_cd1",
  title: "关闭态对照一",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-cd-11112222",
};
const CL2 = {
  approvalId: "ap_cd2",
  title: "关闭态对照二",
  status: "approved",
  createdAt: "2026-11-18T02:00:00Z",
  // 缺 risk/decided/rid：关闭态导出也要恒 7 格不塌
};

const serveNormal = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [CL1, CL2].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    return { items: [CL1, CL2] };
  });
};

const serveDetailDenied = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      throw new ApiError("gone", {
        status: 404,
        body: JSON.stringify({ code: "approval.not_found" }),
        url: u,
        requestId: "req-r263-404",
      });
    }
    return { items: [CL1, CL2] };
  });
};

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

describe("R263 approvals export closed-detail guards", () => {
  it("exports the identical blob after the drawer is closed as before it was opened", async () => {
    serveNormal();
    await render("/approvals?tab=history");
    const { grid: before } = await grabCsv();
    expect(before[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(before.every((r) => r.length === 7), "每行恒 7 格").toBe(true);
    await openDetail("ap_cd1");
    await waitFor(() => !!q("apr5-detail"), "detail opened");
    expect(detailCalls(), "the drawer costs one detail read").toBe(1);
    const opened = clicks();
    await clickTestId("apd7-back");
    await waitFor(() => !q("apr5-detail"), "drawer closed");
    expect(clicks(), "closing the drawer asks for nothing").toBe(opened);
    const { grid: after } = await grabCsv();
    expect(after).toEqual(before); // 关闭后 blob 与开前整体逐字（零残留）
    expect(after.slice(1).map((r) => r[0])).toEqual(rowIds());
    expect(after[2]?.[3]).toBe("未标注风险");
    expect(after[2]?.[6]).toBe("");
  });

  it("keeps the export body-only and seven-celled while the detail reads as denied, with a copyable rid", async () => {
    serveDetailDenied();
    await render("/approvals?tab=history");
    await openDetail("ap_cd1");
    await waitFor(() => !!q("apr5-denied"), "denied drawer");
    expect(q("apv-state-rid")?.textContent).toContain("req-r263-404");
    const written: string[] = [];
    stubClipboard(written);
    await clickTestId("apr5-copy-request-id");
    await waitFor(() => written.length === 1, "rid reached the clipboard");
    expect(written[0]).toBe("req-r263-404");
    const { text, grid } = await grabCsv();
    expect(grid.length - 1, "导出只含列表行").toBe(rowIds().length);
    expect(grid.every((r) => r.length === 7), "七格不塌").toBe(true);
    expect(grid.slice(1).map((r) => r[0])).toEqual(["ap_cd1", "ap_cd2"]);
    expect(text).not.toMatch(/undefined|null/);
    expect(detailCalls(), "the export costs no extra detail read").toBe(1);
  });
});
