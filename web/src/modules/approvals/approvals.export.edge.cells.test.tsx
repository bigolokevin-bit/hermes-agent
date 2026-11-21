// @vitest-environment jsdom
/**
 * R262：审批导出 × 详情边缘——缺 requestId 与超长 title 同一行（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 超长 title 的 CSV 全文腿 = approvals.export.truncate.test.tsx it① L185
 *    （屏上截断/复制全文/CSV 全文三层同帧）；缺 rid 空字段腿 =
 *    approvals.export.missing.fields.test.tsx it①（[6]==""）；缺值行 7 格 =
 *    approvals.export.statusmatrix.test.tsx it①（默认站逐行恒 7 格）。
 *  - 真缺口 = 三条件同帧的同一行：超长 title 且缺 requestId 的行在 CSV
 *    仍恒 7 格、title 列全文无省略号、rid 列空字段（组合站此前未锁）。
 *  - 工单②「抽屉开态导出该行与列表态 blob 整体 toEqual」= missing.fields
 *    it② L260 形态（普通缺值行）；本文件用超长+缺 rid 行重锁同一形态。
 *  - 工单③「?status=rejected 站导出只含该集合、缺值行不塌列、零额外请求」
 *    = approvals.export.multistatus.test.tsx it① L156/it② L180 +
 *      approvals.export.rowcopy.crossstate.test.tsx it③ +
 *      approvals.export.bounds it①（R229）——回证据，不重写。
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
const clicks = (): number => api.fetchJSON.mock.calls.length;
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;
const detailCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approval?id=")).length;

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
    return "blob:edge-cells-262";
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

const LONG = "边界".repeat(63); // 126 字 > 120，且 > TRUNCATE_LIMIT(60)
const EDG = {
  approvalId: "ap_ec1",
  title: LONG,
  status: "rejected",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  // 缺 requestId —— 与超长 title 同一行（组合边缘）
};
const STD = {
  approvalId: "ap_ec2",
  title: "短行对照单",
  status: "rejected",
  createdAt: "2026-11-18T02:00:00Z",
  // 缺 risk / decided / rid —— 对照行同样不塌列
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [EDG, STD].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    return { items: [EDG, STD] };
  });
};

describe("R262 approvals export edge cells guards", () => {
  it("keeps the over-long title row at seven cells with the full title and an empty rid column", async () => {
    serve();
    await render("/approvals?tab=history");
    const { text, grid } = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(grid.every((r) => r.length === 7), "每行恒 7 格不塌列").toBe(true);
    const edgeRow = grid.find((r) => r[0] === "ap_ec1");
    expect(edgeRow?.[1]).toBe(LONG); // title 列全文，不截断
    expect(edgeRow?.[6]).toBe(""); // rid 缺位 = 空字段，不写占位句
    expect(edgeRow?.[3]).toBe("高风险");
    expect(edgeRow?.[4]).toBe("2026-11-19 10:00");
    const gapRow = grid.find((r) => r[0] === "ap_ec2");
    expect(gapRow?.[3]).toBe("未标注风险");
    expect(gapRow?.[4]).toBe("");
    expect(gapRow?.[6]).toBe("");
    expect(text).not.toContain("…"); // 省略号不进数据
    expect(text).not.toMatch(/undefined|null/);
    // 屏上腿：截断上屏 + title 属性给全文（与 CSV 全文不打架）
    const shown = q("apv-trunc-row-title-ap_ec1");
    expect(shown?.getAttribute("title")).toBe(LONG);
  });

  it("re-locks drawer-open export equality for the long-title row without a requestId", async () => {
    serve();
    await render("/approvals?tab=history");
    const { grid: listGrid } = await grabCsv();
    const callsAfterList = clicks();
    await openDetail("ap_ec1");
    expect(detailCalls(), "opening the drawer costs one detail read").toBe(1);
    expect(listCalls(), "the drawer costs no list read").toBe(1);
    const { grid: drawerGrid } = await grabCsv();
    expect(drawerGrid).toEqual(listGrid); // 两态 blob 整体逐字（超长+缺 rid 行重锁）
    expect(clicks(), "no reads between the two exports and the drawer").toBe(callsAfterList + 1);
  });
});
