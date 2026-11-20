// @vitest-environment jsdom
/**
 * R256：审批导出「无 status 参」×「多状态连切」矩阵护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据+文件:行）：
 *  - 工单③「?status=__nope__ 空站导出 disabled+title、强点零 Blob 零请求、
 *    apv5-count 不渲染」= approvals.export.multistatus.test.tsx it③（R246）
 *    与 approvals.export.bounds.test.tsx it①（R229）逐字已锁 → 不重写。
 *  - 工单②的「两站互不残留」= approvals.export.multistatus.test.tsx it②
 *    （R246：pending→approved 两站各含各行）；本文件增量 = 三连切
 *    pending→approved→pending 的第三站 blob 与首站逐字相同（回到原站的
 *    轮转稳定性，此前只走过两站）。
 *  - 工单①「每行恒 7 格不塌列」的纯函数站 = approvals.columns.lock.test.tsx
 *    it①（R219）；表头逐字默认站 = approvals.export.header.row.test.tsx
 *    it①（R254）。本文件增量 = 页面默认站含缺值行时的逐行 7 格直锁
 *    （缺值格占空、列数不塌），与 R254 的「行数+首列同序」互补。
 *  - 其余列头/缺值双载体/翻页/排序家族 = R182/R217/R250/R251/R253/R254/
 *    R255 —— 不重写。
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

async function render(entry: string): Promise<void> {
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

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
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

async function grabCsv(): Promise<string[][]> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:statusmatrix-256";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  try {
    await clickTestId("apv7-export");
  } finally {
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
    HTMLAnchorElement.prototype.click = origClick;
  }
  expect(blobs.length, "one blob per export").toBe(1);
  expect(clicks(), "export never refetches").toBe(before);
  return parseCsv(await blobs[0].text());
}

const SM1 = {
  approvalId: "ap_sm1",
  title: "矩阵一号",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-sm-11112222",
};
const SM2 = {
  approvalId: "ap_sm2",
  title: "矩阵二号",
  status: "pending",
  riskLevel: "low",
  createdAt: "2026-11-18T02:00:00Z",
};
const SM3 = {
  approvalId: "ap_sm3",
  title: "缺值矩阵单",
  status: "approved",
  createdAt: "2026-11-18T03:00:00Z",
  // 无 riskLevel / decidedAt / requestId：空字段占位不塌列的主角
};
const PD1 = SM2;
const PD2 = { ...SM3, approvalId: "ap_pd2", status: "pending", title: "待办回切单" };
const AP1 = SM1;

describe("R256 approvals export status matrix guards", () => {
  it("keeps every CSV row exactly seven cells on the default station with a missing-value row", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      return { items: [SM1, SM2, SM3] };
    });
    await render("/approvals?tab=history");
    expect(rowIds()).toEqual(["ap_sm1", "ap_sm2", "ap_sm3"]);
    const grid = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    for (const r of grid) {
      expect(r.length, "每行恒 7 格（含表头与缺值行）").toBe(7);
    }
    const gap = grid.find((r) => r[0] === "ap_sm3");
    expect(gap?.[3]).toBe("未标注风险"); // 现状：risk 缺值写人话句（R107）
    expect(gap?.[4], "缺 updated_at 占空字段不塌列").toBe("");
    expect(gap?.[6], "缺 rid 占空字段不塌列").toBe("");
    expect(q("apv5-count")?.textContent).toBe("3");
  });

  it("returns to the original export set after a pending → approved → pending round trip", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return {};
      if (u.includes("status=approved")) return { items: [AP1] };
      if (u.includes("status=pending")) return { items: [PD1, PD2] };
      return { items: [PD1, PD2] };
    });
    await render("/approvals?tab=history&status=pending");
    expect(rowIds()).toEqual(["ap_sm2", "ap_pd2"]);
    const grid1 = await grabCsv();
    await clickTestId("apv5-filter-status-approved");
    await waitFor(() => rowIds().join(",") === "ap_sm1", "approved set");
    const grid2 = await grabCsv();
    await clickTestId("apv5-filter-status-pending");
    await waitFor(() => rowIds().join(",") === "ap_sm2,ap_pd2", "pending set restored");
    const grid3 = await grabCsv();
    // 每站 blob 与屏上同集合、互不残留
    expect(grid2.length).toBe(2);
    expect(grid2[1][0]).toBe("ap_sm1");
    expect(grid3).toEqual(grid1); // 回切第三站与首站逐字相同（轮转稳定）
    expect(grid1.slice(1).map((r) => r[0])).toEqual(rowIds());
    // 三站导出全程零新增取数（grabCsv 内置计数锁已逐次验证）
    expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
  });
});
