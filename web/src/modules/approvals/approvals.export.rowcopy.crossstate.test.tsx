// @vitest-environment jsdom
/**
 * R258：审批导出×行复制跨态一致性护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 跨 ?status= 站六段复制逐字不变 = approvals.rowcopy.stability.test.tsx
 *    it①（R234，两站 pending↔approved，未涉 rejected、未与 CSV 首列同帧）；
 *  - pending↔approved 双站导出互不残留+行数三值 =
 *    approvals.export.multistatus.test.tsx it②（R246 L180）；
 *    「__nope__」空站 = 同文件 it③ L204 + approvals.export.bounds it①；
 *  - 缺值行七格逐格核对 = approvals.export.missing.fields.test.tsx it①/③
 *    （R257：默认站与 rejected 站的 blob 腿；复制段「—」双载体腿在
 *    approvals.rowcopy.stability it③ 与 R182 it③）；
 *  - 跨页同对象两腿渲染一致 = approvals.cross.page.test.tsx（R218，裁决先例：
 *    同一行对象注入多腿只锁渲染一致性，不断言上游状态机语义）。
 *  - 本文件真增量：三站（pending 队列 / history approved / history rejected）
 *    同帧「复制首段 == CSV 首列单号」集中锁（①）、三站轮转回到首站的复制
 *    文本与行序零残留且每步列表腿恰 1 次取数（②）、缺值行在三站各自口径
 *    （屏「—」/CSV 空字段/risk 人话）+ 七格不塌的合并站（③）。
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

async function mount(entry: string, Page: typeof ApprovalsHistoryModulePage): Promise<void> {
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

const renderHistory = (entry: string) => mount(entry, ApprovalsHistoryModulePage);
const renderPending = () => mount("/approvals?tab=pending", ApprovalsPendingModulePage);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
const clicks = (): number => api.fetchJSON.mock.calls.length;
const listCalls = (): number =>
  api.fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/approvals?")).length;

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
    return "blob:crossstate-258";
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

/** 按审批号定位行并复制该行；返回复制文本（复制零请求内置锁）。 */
async function copyRowById(id: string, written: string[]): Promise<string> {
  const index = rowIds().indexOf(id);
  expect(index, `row ${id} present`).toBeGreaterThanOrEqual(0);
  const before = clicks();
  const seen = written.length;
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `row copy button for ${id}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => written.length > seen, "copy landed");
  expect(clicks(), "row copy never refetches").toBe(before);
  return written[written.length - 1];
}

const RS = {
  approvalId: "ap_rs1",
  title: "跨态一致单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-rs-87654321",
};
const GAP = {
  approvalId: "ap_gap",
  title: "缺值主角单",
  status: "approved",
  createdAt: "2026-11-17T01:00:00Z",
  // 无 riskLevel / decidedAt / requestId：③的三站各口径主角
};

/** 三站注入同一集合：只锁渲染一致性，不断言上游状态机语义（R218 裁决先例）。 */
const serveThreeStations = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [RS, GAP].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    return { items: [RS, GAP] };
  });
};

describe("R258 approvals export×rowcopy cross-state guards", () => {
  it("keeps the copy head segment and the CSV first column byte-equal on all three stations", async () => {
    serveThreeStations();
    const written: string[] = [];
    stubClipboard(written);
    const stations = [
      async () => renderPending(),
      async () => renderHistory("/approvals?tab=history&status=approved"),
      async () => renderHistory("/approvals?tab=history&status=rejected"),
    ];
    for (const [index, enter] of stations.entries()) {
      clearScreen();
      api.fetchJSON.mockReset();
      serveThreeStations();
      await enter();
      expect(rowIds(), `station ${index} rows`).toEqual(["ap_rs1", "ap_gap"]);
      const { grid } = await grabCsv();
      const fullCopy = await copyRowById("ap_rs1", written);
      const gapCopy = await copyRowById("ap_gap", written);
      const headOf = (t: string): string => t.split("\n")[0];
      // 首段单号 == CSV 首列（同一行，同一站，当帧）
      expect(headOf(fullCopy), `station ${index} full row`).toBe("单号：ap_rs1");
      expect(grid[1][0]).toBe("ap_rs1");
      expect(headOf(gapCopy).replace("单号：", ""), `station ${index} gap row`).toBe(grid[2][0]);
      expect(headOf(gapCopy)).toBe("单号：ap_gap");
    }
  });

  it("round-rotates three stations and returns to the first with zero residue, one list read per step", async () => {
    serveThreeStations();
    const written: string[] = [];
    stubClipboard(written);
    await renderPending();
    const firstCopy = await copyRowById("ap_gap", written);
    const firstRows = rowIds();
    expect(listCalls(), "pending station settles with one list read").toBe(1);
    clearScreen();
    api.fetchJSON.mockReset();
    serveThreeStations();
    await renderHistory("/approvals?tab=history&status=approved");
    await copyRowById("ap_gap", written);
    expect(listCalls(), "approved station costs exactly one list read").toBe(1);
    clearScreen();
    api.fetchJSON.mockReset();
    serveThreeStations();
    await renderHistory("/approvals?tab=history&status=rejected");
    await copyRowById("ap_gap", written);
    expect(listCalls(), "rejected station costs exactly one list read").toBe(1);
    clearScreen();
    api.fetchJSON.mockReset();
    serveThreeStations();
    await renderPending();
    const backCopy = await copyRowById("ap_gap", written);
    expect(backCopy, "回到首站复制文本零残留，逐字相等").toBe(firstCopy);
    expect(rowIds()).toEqual(firstRows);
    expect(listCalls(), "return to the first station is again exactly one read").toBe(1);
  });

  it("keeps the missing-value row in its per-state wording across all three stations, seven cells deep", async () => {
    serveThreeStations();
    const written: string[] = [];
    stubClipboard(written);
    await renderPending();
    let gapCopy = await copyRowById("ap_gap", written);
    let { grid } = await grabCsv();
    let gapRow = grid.find((r) => r[0] === "ap_gap");
    expect(gapCopy).toContain("更新时间：—");
    expect(gapCopy).toContain("短码：—");
    expect(gapCopy).not.toMatch(/undefined|null/);
    expect(gapRow?.length, "pending 站七格不塌").toBe(7);
    expect(gapRow?.[3]).toBe("未标注风险");
    expect(gapRow?.[4]).toBe("");
    expect(gapRow?.[6]).toBe("");
    clearScreen();
    api.fetchJSON.mockReset();
    serveThreeStations();
    await renderHistory("/approvals?tab=history&status=approved");
    gapCopy = await copyRowById("ap_gap", written);
    ({ grid } = await grabCsv());
    gapRow = grid.find((r) => r[0] === "ap_gap");
    expect(gapCopy).toContain("更新时间：—");
    expect(gapRow?.length, "approved 站七格不塌").toBe(7);
    expect(gapRow?.[3]).toBe("未标注风险");
    clearScreen();
    api.fetchJSON.mockReset();
    serveThreeStations();
    await renderHistory("/approvals?tab=history&status=rejected");
    gapCopy = await copyRowById("ap_gap", written);
    ({ grid } = await grabCsv());
    gapRow = grid.find((r) => r[0] === "ap_gap");
    expect(gapCopy).toContain("短码：—");
    expect(gapRow?.length, "rejected 站七格不塌").toBe(7);
    expect(gapRow?.[4]).toBe("");
    expect(gapRow?.[6]).toBe("");
  });
});
