// @vitest-environment jsdom
/**
 * R271：审批导出在 status×risk×asort 三维叠加下的同源护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 本地维（q/actor/since/risk/asort+adir）不进请求、status 唯一服务端维、
 *    asort+adir 合成一枚 sort chip = approvals.filterurl.test.tsx it L158-175
 *    （R98，ALL_PARAMS 全参站）逐字锁过；status 列人话==屏上徽标=
 *    approvals.export.multistatus it① L156（R246）；title/desc 站三载体同序
 *    +首行+缺值双口径=approvals.export.order it L157（R248）。
 *  - 真缺口：①「status=approved&risk=high&asort=title&adir=asc」四维叠加站
 *    把导出 blob、计数位、首行互等、status/risk 双列人话收进同一请求帧
 *    （R98 站型是 status=pending 且从未拦 blob；R248 站无 risk 维）。
 *  - ②「移除 risk chip 后再导出」的 blob 组合从未做过——chip×请求腿
 *    =ApprovalsHistoryModulePage.test.tsx L2433（R98 系，只锁 URL/计数），
 *    两 blob 互不残留与三值重算是本文件新站。
 *  - ③「status=rejected&risk=high 双参空站」：既有空站全是单维
 *    （bounds it① L148、multistatus it③ L204），risk 本地维滤空后
 *    ready-empty 站的导出 disabled+强点零 Blob+计数位非假 0 未锁。
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
import { riskView, statusView } from "./model";

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
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const rowBadge = (id: string): string => {
  const link = q(`apv-trunc-row-title-${id}`);
  const btn = link?.closest("button");
  return String(btn?.parentElement?.lastElementChild?.textContent ?? "");
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
    return "blob:filters-multi-271";
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

const MXH = {
  approvalId: "ap_mx1",
  title: "多维首行单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-mx-11112222",
};
const MX2 = {
  approvalId: "ap_mx2",
  title: "多维次行单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T02:30:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "req-mx-22223333",
};
const MX3 = {
  approvalId: "ap_mx3",
  title: "双空对照单",
  status: "rejected",
  riskLevel: "medium",
  decidedAt: "2026-11-19T03:30:00Z",
  createdAt: "2026-11-18T03:00:00Z",
};

const ALL_ROWS = [MXH, MX2, MX3];

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = ALL_ROWS.find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=pending")) return { items: [] };
    if (u.includes("status=rejected")) return { items: [MX3] };
    if (u.includes("status=approved")) return { items: [MXH, MX2] };
    return { items: ALL_ROWS.map((r) => ({ ...r })) };
  });
};

describe("R271 approvals export multi filter guards", () => {
  it("keeps one four-dimension station: blob, counter, first row and both human labels in a single frame", async () => {
    serve();
    await render("/approvals?tab=history&status=approved&risk=high&asort=title&adir=asc");
    expect(listCalls(), "one list read for the deep link").toBe(1);
    const u = String(api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).slice(-1)[0][0]);
    expect(u).toContain("status=approved");
    // 本地维不进请求（R98 契约在新站型复核）
    for (const local of ["risk=", "asort=", "adir="]) {
      expect(u, `请求不带本地维 ${local}`).not.toContain(local);
    }
    // risk=high 本地腿生效：只剩高风险行
    expect(rowIds()).toEqual(["ap_mx1"]);
    const { text, grid } = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    const data = grid.slice(1);
    expect(data.length, "blob 数据行==表体").toBe(rowIds().length);
    expect(q("apv5-count")?.textContent, "计数位==表体").toBe(String(rowIds().length));
    expect(data[0]?.[0], "CSV 首行==屏上首行").toBe(rowIds()[0]);
    expect(data[0]?.[2], "status 列人话==徽标").toBe(rowBadge("ap_mx1"));
    expect(data[0]?.[2]).toBe(statusView("approved").label);
    expect(data[0]?.[3], "risk 列人话=单点").toBe(riskView("high").label);
    expect(text, "不写枚举原词/引擎词").not.toMatch(/approved|riskLevel|undefined|null/);
    expect(text).not.toMatch(/\bhigh\b/);
  });

  it("re-exports after removing the risk chip: three values recomputed, no rows leak between the two blobs", async () => {
    serve();
    await render("/approvals?tab=history&status=approved&risk=high&asort=title&adir=asc");
    expect(q("apv-chip-risk"), "risk chip present").toBeTruthy();
    const narrow = await grabCsv();
    expect(narrow.grid.slice(1).map((r) => r[0])).toEqual(["ap_mx1"]);
    const before = listCalls();
    await clickTestId("apv-chip-remove-risk");
    await waitFor(() => rowIds().includes("ap_mx2"), "risk filter lifted");
    expect(listCalls(), "removing a local-dimension chip refetches nothing").toBe(before);
    expect(q("apv-chip-risk"), "risk chip gone").toBeNull();
    const wide = await grabCsv();
    expect(wide.grid.length - 1, "重算后 blob 行==表体").toBe(rowIds().length);
    expect(q("apv5-count")?.textContent, "计数位==表体").toBe(String(rowIds().length));
    const wideIds = wide.grid.slice(1).map((r) => r[0]);
    expect(wideIds, "CSV 序==屏上序").toEqual(rowIds());
    expect(wideIds).toContain("ap_mx2");
    expect(narrow.grid.map((r) => r[0]), "第一次导出不含被 risk 滤掉的行").not.toContain("ap_mx2");
    expect(wideIds, "行数=approved 两行").toEqual(expect.arrayContaining(["ap_mx1", "ap_mx2"]));
  });

  it("holds the two-parameter empty station: export inert, forced click makes zero blobs, no fake zeros", async () => {
    serve();
    await render("/approvals?tab=history&status=rejected&risk=high");
    // status=rejected 腿有 medium 行；risk=high 本地腿滤空 → risk 空态卡站
    expect(rowIds(), "risk 本地维滤空后无行").toEqual([]);
    expect(q("apv-risk-empty"), "risk 本地滤空态卡在").toBeTruthy();
    expect(q("apv-risk-empty")?.textContent).toContain("该风险档下没有审批");
    expect(q("apv-risk-clear"), "清空风险档出口在").toBeTruthy();
    expect(q("apv-state-empty"), "服务端空态面板不误渲").toBeNull();
    // 现场形态：apv5-count 渲的是 visibleRows 读数——此站表体确为 0 行，
    // 「0」与表体同源（非假 0），按现状锁同源等式而非隐藏。
    expect(q("apv5-count")?.textContent, "计数位与表体同源").toBe(String(rowIds().length));
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    expect(btn!.disabled, "空集导出 disabled").toBe(true);
    expect(btn!.getAttribute("title"), "disabled 带原因").toBeTruthy();
    const before = clicks();
    const created: string[] = [];
    const orig = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = ((blob: Blob) => {
      created.push(blob.type);
      return "blob:forced-271";
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
    expect(created, "强点不生成 Blob").toEqual([]);
    expect(clicks(), "强点不发请求").toBe(before);
    expect(listCalls(), "全程一次列表读").toBe(1);
  });
});
