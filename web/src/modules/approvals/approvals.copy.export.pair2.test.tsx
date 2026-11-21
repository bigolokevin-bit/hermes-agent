// @vitest-environment jsdom
/**
 * R302：审批导出行×抽屉复制字段级配对（跨站，纯测试，零产品改动）。
 *
 * 先 git grep 查重，已覆盖只回证据、本文件不写重复用例：
 *  - 默认(all)站抽屉开态六段↔七列逐格 = approvals.export.drawer.pairs.test.tsx
 *    it① L262（R275）；gap 行双口径同帧（默认站）= 同文件 it② L285。
 *  - blob 跨站换代零残留 = approvals.export.multistatus.test.tsx it② L180、
 *    approvals.export.detail.parity.test.tsx it② L279（R255，抽屉开态切站）。
 *  - 无抽屉跨站复制↔CSV 首段 = approvals.export.rowcopy.crossstate.test.tsx
 *    it① L241/it② L268（R258）；跨站六段逐字不变 =
 *    approvals.rowcopy.stability.test.tsx it① L179（R234，复制↔复制无 CSV 同帧）。
 *  - window 伪参腿 = approvals.rowcopy.window.gap.test.tsx（R300），本单不涉。
 * 真缺口=「同一单在 pending 与 approved 两站、抽屉开态」的组合站：
 * ①PF1 完整单在两站各开抽屉做六段↔七列逐字段 loop，且两站文本逐字相等；
 * ②抽屉开态下切站：复制文本随行集换代 + blob 零旧站残留的组合腿；
 * ③gap 行在两站抽屉开态各锁一次「—」与空字段双口径、导出零新增请求。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

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
    return "blob:copy-export-pair2-302";
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

/** 同一单跨站注入（R218 先例）：结果集重叠，行对象 status 单值决定两侧人话。 */
const PF1 = {
  approvalId: "ap_cf1",
  title: "完整跨站单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-cf-111122223333444455556666",
};
const PFO = {
  approvalId: "ap_cf0",
  title: "待办独占单",
  status: "pending",
  riskLevel: "low",
  createdAt: "2026-11-19T04:00:00Z",
  requestId: "req-cf-0000111122223333",
};
const PFA = {
  approvalId: "ap_cf9",
  title: "已批独占单",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T05:00:00Z",
  createdAt: "2026-11-18T05:00:00Z",
  requestId: "req-cf-9999888877776666",
};
const PFG = {
  approvalId: "ap_cf2",
  title: "缺值跨站单",
  status: "pending",
  createdAt: "2026-11-17T01:00:00Z",
};

const ALL_ROWS = [PF1, PFO, PFA, PFG];

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = ALL_ROWS.find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=pending")) return { items: [PF1, PFO, PFG] };
    if (u.includes("status=approved")) return { items: [PF1, PFA, PFG] };
    return { items: ALL_ROWS };
  });
};

describe("R302 approvals copy x export cross-station pairing guards", () => {
  it("pairs the same row's six copy segments with the seven CSV columns on both pending and approved stations, byte-identical", async () => {
    stubClipboard();
    const texts: string[] = [];
    for (const station of ["pending", "approved"]) {
      clearScreen();
      api.fetchJSON.mockReset();
      serve();
      await render(`/approvals?tab=history&status=${station}`);
      expect(rowIds(), `${station} row set`).toContain("ap_cf1");
      await openDetail("ap_cf1");
      const { grid } = await grabCsv();
      expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
      const full = grid.find((r) => r[0] === "ap_cf1");
      expect(full, `csv row ap_cf1 at ${station}`).toBeTruthy();
      // 人话经 model 单点（勿硬编码词面，R297 教训）
      expect(full![2], `${station} status 列人话`).toBe(statusView("approved").label);
      expect(full![2], `${station} 不写枚举原词`).not.toBe("approved");
      expect(full![3], `${station} 风险人话`).toBe(riskView("high").label);
      const copied = await copyRowById("ap_cf1");
      const lines = copied.split("\n");
      expect(lines.length, `${station} 六段`).toBe(6);
      expect(lines[0]).toBe(`单号：${full![0]}`);
      expect(lines[1]).toBe(`标题：${full![1]}`);
      expect(lines[2]).toBe(`状态：${full![2]}`);
      expect(lines[3]).toBe(`风险：${full![3]}`);
      expect(lines[4]).toBe(`更新时间：${full![4]}`);
      expect(lines[5]).toBe(`短码：${full![6].slice(-8)}`);
      expect(copied, `${station} 复制只带短码，rid 全串不入`).not.toContain(
        "req-cf-111122223333444455556666",
      );
      expect(copied).not.toMatch(/undefined|null/);
      texts.push(copied);
    }
    expect(texts[1], "同一单两站复制逐字相等").toBe(texts[0]);
  });

  it("swaps both the export blob and the drawer copy set on a station switch with zero rows from the old station", async () => {
    stubClipboard();
    serve();
    await render("/approvals?tab=history&status=pending");
    expect(rowIds()).toEqual(["ap_cf1", "ap_cf0", "ap_cf2"]);
    await openDetail("ap_cf1");
    await copyRowById("ap_cf1");
    const first = await grabCsv();
    const firstIds = first.grid.slice(1).map((r) => r[0]);
    expect(firstIds).toContain("ap_cf0");
    expect(firstIds).not.toContain("ap_cf9");
    // status=服务端维必重取且自动关抽屉（R244）
    const before = clicks();
    await clickTestId("apv5-filter-status-approved");
    await waitFor(() => rowIds().includes("ap_cf9"), "approved station rows");
    expect(rowIds()).toEqual(["ap_cf1", "ap_cf9", "ap_cf2"]);
    expect(listCalls(), "one extra list read per status switch").toBe(2);
    expect(detailCalls(), "status switch costs no extra detail read").toBe(1);
    expect(q("apr5-detail"), "drawer auto-closed on switch").toBeNull();
    const lastList = String(api.fetchJSON.mock.calls.slice(before).find((c) => String(c[0]).includes("/api/approvals?"))?.[0] ?? "");
    expect(lastList).toContain("status=approved");
    for (const call of api.fetchJSON.mock.calls) {
      expect(String(call[0])).not.toMatch(/cursor=/);
    }
    // 换代后抽屉重开、blob 只含新站行、旧站独占行零残留
    await openDetail("ap_cf1");
    const second = await grabCsv();
    const secondIds = second.grid.slice(1).map((r) => r[0]);
    expect(secondIds).toContain("ap_cf9");
    expect(secondIds, "上一站 blob 不残留").not.toContain("ap_cf0");
    expect(first.text, "旧站 blob 从无新站行").not.toContain("ap_cf9");
    // 复制文本随行集换代：换代后复制 gap 行可用且首段=其单号
    const copied = await copyRowById("ap_cf2");
    expect(copied.split("\n")[0]).toBe("单号：ap_cf2");
  });

  it("holds the dash-vs-empty dual convention for the gap row in the open drawer on both stations with export adding zero requests", async () => {
    stubClipboard();
    for (const station of ["pending", "approved"]) {
      clearScreen();
      api.fetchJSON.mockReset();
      serve();
      await render(`/approvals?tab=history&status=${station}`);
      await openDetail("ap_cf2");
      const listsBefore = listCalls();
      const { grid } = await grabCsv();
      const gap = grid.find((r) => r[0] === "ap_cf2");
      expect(gap, `csv row ap_cf2 at ${station}`).toBeTruthy();
      // CSV 侧口径：唯 risk 缺值为人话「未标注风险」（R107 契约词面），
      // updated_at/rid 为空字段
      expect(gap![3], `${station} CSV 风险缺值人话`).toBe("未标注风险");
      expect(gap![4], `${station} CSV 更新时间空字段`).toBe("");
      expect(gap![6], `${station} CSV rid 空字段`).toBe("");
      // 复制侧口径：同句人话 + 「—」占位
      const copied = await copyRowById("ap_cf2");
      const lines = copied.split("\n");
      expect(lines.length, `${station} 六段`).toBe(6);
      expect(lines[3]).toBe("风险：未标注风险");
      expect(lines[4]).toBe("更新时间：—");
      expect(lines[5]).toBe("短码：—");
      expect(copied).not.toMatch(/undefined|null|req-/);
      expect(listCalls(), `${station} 导出零新增列表请求`).toBe(listsBefore);
    }
  });
});
