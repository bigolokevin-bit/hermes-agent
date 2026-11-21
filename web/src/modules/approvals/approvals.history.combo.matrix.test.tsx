// @vitest-environment jsdom
/**
 * R272：审批历史页 window 伪参数 × 真实筛选组合矩阵（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 「window 不进请求/URL 逐字保留/控件不回填」= approvals.history.filters
 *    it① L176（R129）与 approvals.history.window it① L163（R233）已锁；
 *    「非法 window 空态可读」= filters it③ L225、window it③ L186。
 *  - 本文件三站增量：
 *    ①window+status+asort+adir 四维深链同帧——请求只带 status、屏上按 title
 *      升序（服务回序故意反序证明本地排序生效）、四值等式
 *      CSV 数据行==表体==apv5-count==导出「共 N 行」（此前 row/export/count
 *      三值在 filters it④ L246 锁于同 URL 重挂站，「共 N 行」读数位入等式为
 *      新腿，R269/R271 家族形态）；
 *    ②「仅改 window」的物理形态=控件恒 disabled：点它 URL 一字不动、零取数
 *      （selectHarness 读真实 disabled，wave-36 ConsoleSelect 迁移教训）；
 *    ③非法 window+合法 status 空腿组合：URL 逐字保留两参、服务端空态可读、
 *      导出 disabled 且强点零 Blob 零请求（blob 腿此前只锁单维空站
 *      bounds it① L148，双参非法+合法组合站为新）。
 */
import { act, useEffect } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
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

import { selectDisabled } from "@/shell/selectHarness";
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
  document.body.removeAttribute("data-r272-search");
};

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
});

function Probe(): ReactNode {
  const location = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r272-search", location.search);
  }, [location.search]);
  return null;
}

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
        <Probe />
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
const lastSearch = (): string => document.body.getAttribute("data-r272-search") ?? "";

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLElement | null;
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
    return "blob:combo-matrix-272";
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
  const text = await blobs[0].text();
  return { text, grid: parseCsv(text) };
}

const A1 = {
  approvalId: "ap_cm1",
  title: "Alpha 一号",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-cm-11112222",
};
const A2 = {
  approvalId: "ap_cm2",
  title: "Beta 二号",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T01:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
  requestId: "req-cm-22223333",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [A1, A2].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=approved")) {
      // 服务回序故意反序（A2,A1）：屏上 A1,A1 在前只能由本地 title 升序产生。
      return { items: [A2, A1] };
    }
    return { items: [] };
  });
};

describe("R272 approvals history window pseudo-param combo matrix", () => {
  it("① sends only status on the four-param deep link and the four counts agree with the local title order", async () => {
    serve();
    await render("/approvals?tab=history&window=7d&status=approved&asort=title&adir=asc");
    const urls = api.fetchJSON.mock.calls.map((c) => String(c[0]));
    const listUrl = urls.filter((u) => u.includes("/api/approvals?")).slice(-1)[0] ?? "";
    expect(listUrl).toContain("status=approved");
    expect(listUrl).not.toContain("window=");
    expect(listUrl).not.toContain("asort=");
    expect(listUrl).not.toContain("adir=");
    expect(listUrl).not.toContain("cursor=");
    // 本地 title 升序把反序服务回序翻正
    expect(rowIds()).toEqual(["ap_cm1", "ap_cm2"]);
    const { grid } = await grabCsv();
    expect(grid.length - 1).toBe(rowIds().length);
    expect(q("apv5-count")?.textContent).toBe(String(rowIds().length));
    expect(q("apv7-export-count")?.textContent).toBe(`共 ${rowIds().length} 行`);
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
  });

  it("② the permanently disabled window control answers clicks with nothing: URL and reads untouched", async () => {
    serve();
    await render("/approvals?tab=history&status=approved&window=7d");
    const before = clicks();
    const searchBefore = lastSearch();
    expect(selectDisabled("apv5-filter-window"), "window control stays disabled").toBe(true);
    // 物理尝试：dispatch 也点不动 disabled 的 trigger；URL 一字不动、零取数
    const trigger = q("apv5-filter-window") as HTMLElement | null;
    expect(trigger, "window control present").toBeTruthy();
    await act(async () => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(lastSearch()).toBe(searchBefore);
    expect(lastSearch()).toContain("window=7d");
    expect(clicks(), "a disabled window control never triggers a read").toBe(before);
    // 无排序参站保持服务回序（A2,A1），点击 disabled 控件不产生任何重排/重取
    expect(rowIds()).toEqual(["ap_cm2", "ap_cm1"]);
  });

  it("③ an invalid window beside a valid status keeps both params byte-for-byte and the empty leg exports nothing", async () => {
    serve();
    await render("/approvals?tab=history&window=__nope__&status=rejected");
    expect(lastSearch()).toBe("?tab=history&window=__nope__&status=rejected");
    expect(rowIds()).toEqual([]);
    expect(q("apv-state-empty-text")?.textContent).toContain("该条件下无审批");
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button present").toBeTruthy();
    expect(btn!.disabled, "empty leg disables export").toBe(true);
    const before = clicks();
    const created: string[] = [];
    const orig = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = ((blob: Blob) => {
      created.push(String(blob.size));
      return "blob:combo-forced-272";
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
    expect(created.length, "forced click on disabled export creates no blob").toBe(0);
    expect(clicks(), "forced click makes no request").toBe(before);
    expect(lastSearch(), "the invalid window is not rewritten away").toContain("window=__nope__");
  });
});
