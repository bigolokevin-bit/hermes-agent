// @vitest-environment jsdom
/**
 * R255：审批导出 × 抽屉详情双面同源护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据+文件:行）：
 *  - 「行×预览×抽屉×复制×CSV 五载体逐字（折叠态导出）」=
 *    approvals.panel.detail.parity.test.tsx（R230，?status=approved 站，
 *    导出在关闭抽屉后）；「CSV updated_at==抽屉决定时间」=
 *    approvals.decision.parity.test.tsx L347 / approvals.parity（R168）；
 *    「抽屉开态行复制逐字+零请求」= approvals.detail.copy.test.tsx L161
 *    （R162）。本文件增量①= 抽屉打开态下拦真实导出 blob、五列与抽屉
 *    字段（h2 标题/两枚徽标/apd5-field-decided-at）当帧逐字对照，并对
 *    缺值行给出两处口径同帧（抽屉「—」/「未标注风险」 vs CSV 空字段/
 *    人话句——risk 缺值写人话是 R107 现状，禁凑「也空字段」）。
 *  - ②「切 ?status= 后行集换代」主体= approvals.detail.multipage.test.tsx
 *    it②（R244：开抽屉切 status 现场自动关抽屉+rail 从 0 重排）；本文件
 *    增量= 换代后拦导出 blob 只含新集合、旧单号零残留、apv5-count==表体
 *    ==CSV 数据行三值。
 *  - ③「详情 500 可读句+rid+重试恰 +1」= approvals.detail.fields2.test.tsx
 *    it④（R207，L364-398）；404=denied 同体=R244 it③。本文件增量= 错误
 *    站导出照常（列表不受累、blob 行数不变）与重试成功后三值再同步。
 *  - 列头逐字/缺值双载体/翻页/排序/rid 往返 = R182/R217/R219/R250/R251/
 *    R253/R254 —— 不重写。
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
const text = (id: string): string => q(id)?.textContent ?? "";
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
const urls = (): string[] => api.fetchJSON.mock.calls.map((c) => String(c[0]));
const clicks = (): number => api.fetchJSON.mock.calls.length;
const listCalls = (): number => urls().filter((u) => u.includes("/api/approvals?")).length;
const detailCalls = (): number => urls().filter((u) => u.includes("/api/approval?id=")).length;

const openDetail = async (id: string): Promise<void> => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

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

async function grabCsv(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:export-detail-255";
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
  const csv = await blobs[0].text();
  return { text: csv, grid: parseCsv(csv) };
}

const detailBadges = (): string[] => {
  const head = q("apv-trunc-detail-title")?.parentElement;
  const kids = head ? Array.from(head.children).slice(1) : [];
  return kids.map((el) => (el.textContent ?? "").trim());
};

// Field 容器 testid 的 textContent 含 dt 标签（「决定时间…」），值腿在 dd
// （approvals.parity.test.tsx L247 先例公式）。
const decidedCell = (): string =>
  (q("apd5-field-decided-at")?.querySelector("dd")?.textContent ?? "").trim();

const DR1 = {
  approvalId: "ap_dr1",
  title: "抽屉开态导出",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-dr-11112222",
  approvers: [{ userId: "human:7", name: "郑涛" }],
};
const DR2 = {
  approvalId: "ap_dr2",
  title: "缺值对照单",
  status: "approved",
  createdAt: "2026-11-18T02:00:00Z",
  // 无 riskLevel / decidedAt / requestId
};
const RE1 = {
  approvalId: "ap_re1",
  title: "驳回唯一",
  status: "rejected",
  riskLevel: "low",
  decidedAt: "2026-11-19T04:00:00Z",
  createdAt: "2026-11-18T03:00:00Z",
};

const serveRows = (rows: unknown[], rejectedRows: unknown[]): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = (rows as { approvalId?: string }[]).find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=rejected")) return { items: rejectedRows };
    return { items: rows };
  });
};

describe("R255 approvals export x drawer parity guards", () => {
  it("exports the real blob while the drawer stays open with all five columns matching the drawer byte-for-byte", async () => {
    serveRows([DR1, DR2], [RE1]);
    await render();
    await openDetail("ap_dr1");
    const badges = detailBadges();
    const title = text("apv-trunc-detail-title");
    const decided = decidedCell();
    expect(decided).toBe("2026-11-19 10:00");
    const listBefore = listCalls();
    const { grid } = await grabCsv();
    expect(q("apr5-detail"), "drawer still open after export").toBeTruthy();
    expect(listCalls(), "export adds no list read").toBe(listBefore);
    const row1 = grid.find((r) => r[0] === "ap_dr1");
    expect(row1?.[1], "CSV title == drawer title").toBe(title);
    expect(row1?.[2], "CSV status == drawer badge").toBe(badges[0]);
    expect(row1?.[3], "CSV risk == drawer risk badge").toBe(badges[1]);
    expect(row1?.[4], "CSV updated_at == drawer decided").toBe(decided);
    // 缺值行两处口径同帧：抽屉「—」/「未标注风险」 vs CSV 空字段/人话句
    await openDetail("ap_dr2");
    const badges2 = detailBadges();
    const decided2 = decidedCell();
    expect(decided2, "drawer missing time shows the dash body").toBe("—");
    const second = await grabCsv();
    const row2 = second.grid.find((r) => r[0] === "ap_dr2");
    expect(row2?.[4], "CSV missing updated_at is an empty field, not a dash").toBe("");
    expect(row2?.[3], "risk gap keeps the human word on both sides (R107 现状)").toBe(badges2[1]);
    expect(badges2[1]).toBe("未标注风险");
    expect(second.text).not.toMatch(/undefined|null/);
  });

  it("swaps the whole export set after a status switch with the drawer had been open, leaving zero old rows", async () => {
    serveRows([DR1, DR2], [RE1]);
    await render();
    await openDetail("ap_dr1");
    await clickTestId("apr5-filter-rejected");
    await waitFor(() => rowIds().join(",") === "ap_re1", "rejected set");
    // 现状裁决（R244）：开抽屉切 status 由 choose() 自动关抽屉，非残留
    expect(q("apr5-detail"), "drawer closed by the status switch").toBeNull();
    const { text: csv, grid } = await grabCsv();
    expect(grid.length, "header + the swapped set only").toBe(2);
    expect(grid[1][0]).toBe("ap_re1");
    expect(csv).not.toContain("ap_dr1");
    expect(csv).not.toContain("ap_dr2");
    expect(q("apv5-count")?.textContent).toBe("1");
    expect(rowIds().length).toBe(1);
  });

  it("keeps list and export intact while the detail leg fails, and the retry costs exactly one read with the three values in sync", async () => {
    let detailTries = 0;
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) {
        detailTries += 1;
        if (detailTries === 1) {
          throw new ApiError("boom", {
            status: 500,
            body: JSON.stringify({ message: "上游暂时没有响应" }),
            url: u,
            requestId: "req-r255-detail",
          });
        }
        const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
        const row = [DR1, DR2].find((r) => r.approvalId === id);
        return row ? { ...row } : {};
      }
      return { items: [DR1, DR2] };
    });
    await render();
    const card = q("apr5-row-ap_dr1") as HTMLElement | null;
    expect(card, "row present").toBeTruthy();
    const listBefore = listCalls();
    await act(async () => {
      card!.click();
    });
    await waitFor(() => !!q("apr5-detail-error"), "detail error panel");
    expect(text("apr5-request-id")).toContain("req-r255-detail");
    // 错误站：列表与导出照常（列表腿不被详情错误牵连）
    expect(rowIds()).toEqual(["ap_dr1", "ap_dr2"]);
    expect(q("apv5-count")?.textContent).toBe("2");
    const failed = await grabCsv();
    expect(failed.grid.length, "export still carries both loaded rows").toBe(3);
    expect(listCalls(), "detail failure costs no list read").toBe(listBefore);
    const detailBefore = detailCalls();
    await clickTestId("apr5-detail-error-retry");
    await waitFor(() => !!q("apr5-detail"), "detail recovered");
    expect(detailCalls(), "retry costs exactly one detail read").toBe(detailBefore + 1);
    expect(q("apr5-detail-error"), "error carrier gone").toBeNull();
    const synced = await grabCsv();
    expect(synced.grid.length).toBe(3);
    expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
    expect(listCalls(), "retry never re-reads the list").toBe(listBefore);
  });
});
