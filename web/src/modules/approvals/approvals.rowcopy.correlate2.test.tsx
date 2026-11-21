// @vitest-environment jsdom
/**
 * R305 — 审批行复制 ↔ 导出 correlation 二级项：跨站一致性（纯测试，零产品改动）。
 *
 * 先 git grep 现查既有覆盖，已覆盖只回证据、本文件不写重复用例：
 *  - R304 approvals.rowcopy.correlate.test.tsx it① L220（默认站）/it② L246
 *    （追加页站）已锁 单号段↔col5 correlation 与 col5==col0、缺单号行三载体；
 *    本单缺口=?status=approved / ?status=rejected 两个单状态站的同组等式。
 *  - R182 approvals.export.filter.test.tsx it L194 锁 approved 深链站的
 *    CSV 行数==表体==apv5-count 与 status 列人话，但无复制段↔col5 腿。
 *  - R246 approvals.export.multistatus.test.tsx it② L180 的换代零残留腿用
 *    col0（id 列）断言；现场裁决 col0==col5 同值异列由 R304 it① 默认站锁过，
 *    本单把它升为 **correlation 列位数组**排他 + apv5-count 同步重算的集中站。
 *  - R268 approvals.columns.lock.test.tsx L214 cells[5]=="ap_h1"（correlation
 *    列↔屏上单号，一屏站非复制段非 status 站）；R227 export.filters.multi 是
 *    chip 维（非 status 快捷钮站型）。R107 契约：缺值 CSV 空字段、复制「—」。
 * 本文件真增量：
 *  ① approved/rejected 两站各自：完整行 单号段↔col5 逐字 + col5==col0；
 *  ② approved 站导出后切 rejected 站再导出：新 blob 的 col5 列位数组零旧站
 *    残留、行集换代、CSV 数据行数==apv5-count 同步重算、切换恰一次重取；
 *  ③ 缺 correlation（rawId=null）行在两站各出现一次：复制「单号：—」两站
 *    文本一致、CSV col0/col5 均空字段、导出与复制零新增请求。
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
  Button: ({
    onClick,
    children,
    ...rest
  }: {
    onClick?: () => void;
    children?: ReactNode;
  }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...rest}>{children}</div>
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
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
/** 全页行复制钮数（含缺单号行——其 testid 不带 ap_ 前缀，只能按位置数）。 */
const copyBtnCount = (): number =>
  Array.from(document.querySelectorAll("button")).filter((b) =>
    /^apr-row-copy-\d+$/.test(String(b.getAttribute("data-testid") ?? "")),
  ).length;

async function clickTestId(id: string): Promise<void> {
  const el = q(id);
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  return src
    .split("\r\n")
    .filter((l) => l !== "")
    .map((l) => l.split(","));
}

/** 拦一次导出：收 blob、锁导出不新增 fetch，返回全文与网格。 */
async function grabCsv(): Promise<{ text: string; grid: string[][] }> {
  const before = clicks();
  const blobs: Blob[] = [];
  const orig = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:rowcopy-correlate2-305";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = () => undefined;
  try {
    await clickTestId("apv7-export");
    await waitFor(() => blobs.length === 1, "export blob captured");
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

/** 按屏上钮序号复制一行（缺单号行的 testid 不带 ap_ 前缀，只能按 index 点）。 */
async function copyRowByIndex(index: number): Promise<string> {
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `apr-row-copy-${index}`).toBeTruthy();
  const seen = written.length;
  const before = clicks();
  await act(async () => {
    btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(() => written.length > seen, `copy #${index} wrote clipboard`);
  expect(clicks(), "row copy never refetches").toBe(before);
  return written[written.length - 1] as string;
}

const AF1 = {
  approvalId: "ap_xa1",
  title: "跨站关联完整批单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
};
const AGA = {
  title: "跨站关联缺号批单",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T06:00:00Z",
  createdAt: "2026-11-18T06:00:00Z",
};
const RF1 = {
  approvalId: "ap_xr1",
  title: "跨站关联完整拒单",
  status: "rejected",
  riskLevel: "low",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
};
const RGR = {
  title: "跨站关联缺号拒单",
  status: "rejected",
  riskLevel: "high",
  decidedAt: "2026-11-19T07:00:00Z",
  createdAt: "2026-11-18T07:00:00Z",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("status=approved")) return { items: [AF1, AGA] };
    if (u.includes("status=rejected")) return { items: [RF1, RGR] };
    return { items: [AF1, AGA, RF1, RGR] };
  });
};

describe("R305 approvals correlation cross-status guards", () => {
  it("pairs the copy 单号 segment with the CSV correlation column on both status stations verbatim", async () => {
    stubClipboard();
    const stations = [
      { value: "approved", id: "ap_xa1", title: "跨站关联完整批单" },
      { value: "rejected", id: "ap_xr1", title: "跨站关联完整拒单" },
    ];
    for (const station of stations) {
      clearScreen();
      api.fetchJSON.mockReset();
      serve();
      await render(`/approvals?tab=history&status=${station.value}`);
      const last = String(api.fetchJSON.mock.calls[listCalls() - 1]?.[0] ?? "");
      expect(last, station.value).toContain(`status=${station.value}`);
      expect(last, station.value).not.toContain("cursor=");
      expect(rowIds(), station.value).toEqual([station.id]);
      expect(copyBtnCount(), `${station.value} two copy buttons`).toBe(2);
      const { grid } = await grabCsv();
      expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
      const full = grid.slice(1).find((r) => r[1] === station.title);
      expect(full, `${station.value}: full row in csv`).toBeTruthy();
      // 列间等式（R304 默认站已锁，此处在单状态站复验列位）与逐字段配对
      expect(full![5], station.value).toBe(full![0]);
      const lines = (await copyRowByIndex(0)).split("\n");
      expect(lines[0], `${station.value} 单号段↔col5`).toBe(`单号：${full![5]}`);
      expect(lines[0], station.value).toBe(`单号：${station.id}`);
    }
  });

  it("after a status switch the correlation column holds zero rows from the old station and the count recomputes", async () => {
    stubClipboard();
    serve();
    await render("/approvals?tab=history&status=approved");
    const first = await grabCsv();
    const firstIds = first.grid.slice(1).map((r) => r[5]);
    expect(firstIds, "approved station correlation set").toContain("ap_xa1");
    const before = clicks();
    await clickTestId("apv5-filter-status-rejected");
    await waitFor(() => rowIds().join(",") === "ap_xr1", "rejected rows on screen");
    const last = String(
      api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).slice(-1)[0]?.[0] ??
        "",
    );
    expect(last, "switch refetches server-side").toContain("status=rejected");
    expect(listCalls(), "status switch costs exactly one list read").toBe(before + 1 - 0);
    const second = await grabCsv();
    const secondIds = second.grid.slice(1).map((r) => r[5]);
    // correlation 列位数组：新站=完整行 id + 缺号行空字段，零旧站残留
    expect(secondIds, "rejected station correlation column").toEqual(["ap_xr1", ""]);
    expect(second.text, "旧站 correlation 不残留").not.toContain("ap_xa1");
    expect(second.text, "旧站行整行换代").not.toContain("跨站关联完整批单");
    // 行数与 apv5-count 同步重算
    const countEl = q("apv5-count");
    expect(countEl, "apv5-count present").toBeTruthy();
    const digits = /(\d+)/.exec(countEl!.textContent ?? "");
    expect(Number(digits?.[1]), "csv rows == apv5-count").toBe(second.grid.slice(1).length);
    expect(second.grid.slice(1).length, "two rows on the new station").toBe(2);
  });

  it("keeps the missing-correlation dash-vs-empty convention identically on both stations while export and copy add zero requests", async () => {
    stubClipboard();
    const gapTitles: Array<{ value: string; title: string }> = [
      { value: "approved", title: "跨站关联缺号批单" },
      { value: "rejected", title: "跨站关联缺号拒单" },
    ];
    const gapFirstLines: string[] = [];
    for (const station of gapTitles) {
      clearScreen();
      api.fetchJSON.mockReset();
      serve();
      await render(`/approvals?tab=history&status=${station.value}`);
      const { text, grid } = await grabCsv();
      const gapRow = grid.slice(1).find((r) => r[1] === station.title);
      expect(gapRow, `${station.value}: gap row in csv`).toBeTruthy();
      // CSV 侧：col0 与 col5 均为空字段（R107 禁把「—」写进数据）
      expect(gapRow![0], station.value).toBe("");
      expect(gapRow![5], station.value).toBe("");
      // 复制侧：缺号行按位置是第二钮（items 序），六段首行为「单号：—」
      const listsBefore = listCalls();
      const seg = await copyRowByIndex(1);
      const firstLine = seg.split("\n")[0] as string;
      expect(firstLine, station.value).toBe("单号：—");
      gapFirstLines.push(firstLine);
      expect(listCalls(), "导出与复制零新增列表请求").toBe(listsBefore);
      expect(text, "CSV 无破折号占位").not.toMatch(/—/);
      expect(text, "CSV 无调试残渣").not.toMatch(/undefined|null/);
    }
    // 两站一致：缺 correlation 行的复制首段文本逐字相同
    expect(gapFirstLines[1], "两站缺号复制一致").toBe(gapFirstLines[0]);
  });
});
