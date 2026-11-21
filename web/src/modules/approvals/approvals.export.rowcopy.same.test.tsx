// @vitest-environment jsdom
/**
 * R265：审批导出与行复制同源（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 工单③「导出前后 fetchJSON 计数不变」= 每个 grabCsv 的内置计数锁
 *    （家族自 R182 起逐文件复用）；「空集 disabled+title 零 Blob」
 *    = approvals.export.bounds.test.tsx it① L148（R229，history 强点）
 *    + approvals.export.tab.rowcopy.test.tsx it②（R260，pending 组件站）
 *    + approvals.empty.test.tsx it②。均不重写。
 *  - 首段腿=已锁：crossstate it① L241 三站复制首段==CSV 首列；翻页首行腿
 *    =export.paged it①（R235）/export.triple it②（R253）。
 *  - 真增量①=同一行六段与 CSV 该行对应列逐格成对（含缺值映射「—」↔空字段、
 *    短码=全串后 8 位、风险缺值两侧同写「未标注风险」的 R107 现状）——
 *    此前六段腿与 CSV 列腿各自锁过，从未在同一行逐格配对。
 *  - 真增量②=第 2 页追加后「逐行」复制与 CSV 数据行 id 列全列配对不错位
 *    （翻页站此前只锁首行/整体行序，未锁逐行六段头段）。
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

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

function parseCsv(body: string): string[][] {
  const src = body.replace(/^\uFEFF/, "");
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
    return "blob:rowcopy-same-265";
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
  const body = await blobs[0].text();
  return { text: body, grid: parseCsv(body) };
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

/** 六段/列的差分等待法（R258 教训：防上一站残留假绿）。 */
async function copyRowById(id: string): Promise<string> {
  const index = rowIds().indexOf(id);
  expect(index, `row ${id} present`).toBeGreaterThanOrEqual(0);
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `copy button for ${id}`).toBeTruthy();
  const before = clicks();
  const seen = written.length;
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => written.length > seen, `clipboard write for ${id}`);
  expect(clicks(), "row copy never refetches").toBe(before);
  return written[written.length - 1];
}

const segments = (copy: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of copy.split("\n")) {
    const at = line.indexOf("：");
    if (at > 0) out[line.slice(0, at)] = line.slice(at + 1);
  }
  return out;
};

const SFULL = {
  approvalId: "ap_sx1",
  title: "配对完整单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-sx-11112222",
};
const SGAP = {
  approvalId: "ap_sx2",
  title: "配对缺值单",
  status: "approved",
  createdAt: "2026-11-18T02:00:00Z",
};
const SP3 = {
  approvalId: "ap_sx3",
  title: "第二页配对单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T04:00:00Z",
  createdAt: "2026-11-18T03:00:00Z",
  requestId: "req-sx-33334444",
};

const serveSix = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [SFULL, SGAP, SP3].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("cursor=")) return { items: [SP3] };
    return { items: [SFULL, SGAP], nextCursor: "pc-265" };
  });
};

describe("R265 approvals export x rowcopy same-source guards", () => {
  it("pairs every copy segment against the same CSV row cell by cell, missing values included", async () => {
    serveSix();
    stubClipboard();
    await render("/approvals?tab=history");
    expect(rowIds()).toEqual(["ap_sx1", "ap_sx2"]);
    const { grid } = await grabCsv();
    const full = grid.find((r) => r[0] === "ap_sx1");
    const gap = grid.find((r) => r[0] === "ap_sx2");
    expect(full, "full row in CSV").toBeTruthy();
    expect(gap, "gap row in CSV").toBeTruthy();

    const fullSegs = segments(await copyRowById("ap_sx1"));
    expect(fullSegs["单号"]).toBe(full![0]);
    expect(fullSegs["标题"]).toBe(full![1]);
    expect(fullSegs["状态"]).toBe(full![2]);
    expect(fullSegs["风险"]).toBe(full![3]);
    expect(fullSegs["更新时间"]).toBe(full![4]);
    expect(fullSegs["短码"]).toBe(full![6].slice(-8));
    expect(fullSegs["风险"]).toBe("高风险");

    const gapSegs = segments(await copyRowById("ap_sx2"));
    // 缺值映射：复制写「—」，CSV 写空字段；风险两侧同写「未标注风险」（R107 现状）
    expect(gapSegs["更新时间"]).toBe("—");
    expect(gap![4]).toBe("");
    expect(gapSegs["短码"]).toBe("—");
    expect(gap![6]).toBe("");
    expect(gapSegs["风险"]).toBe("未标注风险");
    expect(gap![3]).toBe("未标注风险");
    expect(gapSegs["标题"]).toBe(gap![1]);
    expect(gapSegs["状态"]).toBe(gap![2]);
  });

  it("pairs copy buttons with CSV rows across the appended second page without any shift", async () => {
    serveSix();
    stubClipboard();
    await render("/approvals?tab=history");
    await clickTestId("apv-page-more");
    await waitFor(() => rowIds().join(",") === "ap_sx1,ap_sx2,ap_sx3", "page 2 appended");
    const { grid } = await grabCsv();
    const csvIds = grid.slice(1).map((r) => r[0]);
    expect(csvIds).toEqual(rowIds());
    for (let i = 0; i < csvIds.length; i += 1) {
      const segs = segments(await copyRowById(csvIds[i]));
      expect(segs["单号"], `pair ${i}`).toBe(csvIds[i]);
      expect(segs["标题"], `title ${i}`).toBe(grid[i + 1][1]);
    }
    expect(q("apv5-count")?.textContent).toBe(String(csvIds.length));
  });
});
