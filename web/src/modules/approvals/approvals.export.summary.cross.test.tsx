// @vitest-environment jsdom
/**
 * R278：审批导出与队列汇总的跨页四值同源（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 工单③「空站导出 disabled+title、强点零 Blob、计数位非假 0（不是缺数）」
 *    = approvals.export.summary.parity.test.tsx it③ L284（R269）逐字已锁：
 *    三状态桶全「—」、title 各含「不是缺数」（L292）、导出 inert、
 *    强点零 Blob 零请求。本页不重复服务端空站。
 *  - 工单②「切站后导出换代零残留、无 cursor」
 *    = approvals.export.multistatus.test.tsx it② L180（R246：pending 站先导出、
 *    切 approved 再导出，两次 blob 各只含本站行互不残留）+ 同文件 it① 站腿
 *    断言「每步列表腿计数 +1 且新请求无 cursor=」；R269 it② L258 再锁 rejected
 *    站四值 resync 与非本源桶「—」+原因句。「页码归 1」在无追加态不适用
 *    （无游标可清，按现状注记）。
 *  - 真缺口=工单①「pending/approved/rejected 三站各一次」的统一 loop：
 *    R269 只锁 all 站（it① L238）与 rejected 站（it②），pending/approved
 *    单状态站的「CSV 数据行==表体==apv5-count==本源桶计数」四值等式从未
 *    成站锁过。本文件按三站 loop 补齐，每站清场重挂（mockReset 后 re-serve）。
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
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;

/** 桶计数位解析：数字尾＝真实计数；「—」桶返回 null（R269 bucketCount 同源习语）。 */
function bucketCount(id: string): number | null {
  const el = q(id);
  if (!el) throw new Error(`bucket missing: ${id}`);
  const match = /(\d+)\s*$/.exec(el.textContent ?? "");
  return match ? Number(match[1]) : null;
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

async function grabCsv(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:summary-cross-278";
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

const XP = {
  approvalId: "ap_xc1",
  title: "跨站汇总待办单",
  status: "pending",
  riskLevel: "high",
  createdAt: "2026-11-19T01:00:00Z",
  requestId: "req-xc-11112222",
};
const XA = {
  approvalId: "ap_xc2",
  title: "跨站汇总已批单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-xc-22223333",
};
const XR = {
  approvalId: "ap_xc3",
  title: "跨站汇总已拒单",
  status: "rejected",
  riskLevel: "medium",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "req-xc-33334444",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [XP, XA, XR].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=pending")) return { items: [XP] };
    if (u.includes("status=approved")) return { items: [XA] };
    if (u.includes("status=rejected")) return { items: [XR] };
    return { items: [XP, XA, XR] };
  });
};

describe("R278 approvals export x summary cross-station guards", () => {
  it("holds the four-value equation on each of pending/approved/rejected stations with off-scope buckets dashed", async () => {
    const stations = [
      { value: "pending", label: "待办", id: "ap_xc1" },
      { value: "approved", label: "已批", id: "ap_xc2" },
      { value: "rejected", label: "已拒", id: "ap_xc3" },
    ];
    for (const station of stations) {
      clearScreen();
      api.fetchJSON.mockReset();
      serve();
      await render(`/approvals?tab=history&status=${station.value}`);
      // 单状态站：服务端腿必带 status 参，无 cursor（无追加态，按现状注记）
      const last = String(api.fetchJSON.mock.calls[listCalls() - 1]?.[0] ?? "");
      expect(last, station.value).toContain(`status=${station.value}`);
      expect(last, station.value).not.toContain("cursor=");
      expect(listCalls(), `${station.value} single list read`).toBe(1);
      expect(rowIds()).toEqual([station.id]);
      const { grid } = await grabCsv();
      const data = grid.slice(1);
      // 四值等式：CSV 数据行 == 表体 == apv5-count == 本源状态桶
      expect(data.length, `${station.value} csv rows`).toBe(rowIds().length);
      expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
      expect(bucketCount(`apv6-summary-${station.value}`)).toBe(rowIds().length);
      expect(data[0]?.[0]).toBe(station.id);
      // 非本源桶一律「—」+原因句（R269 it② 同源措辞，绝不假 0）
      for (const other of stations) {
        if (other.value === station.value) continue;
        const el = q(`apv6-summary-${other.value}`);
        expect(el, `${station.value}: off bucket ${other.value} present`).toBeTruthy();
        expect(bucketCount(`apv6-summary-${other.value}`), `${station.value}: ${other.value}`).toBeNull();
        expect(String(el!.getAttribute("title")), `${station.value}: ${other.value} reason`).toContain(
          "不同源",
        );
      }
      expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    }
  });
});
