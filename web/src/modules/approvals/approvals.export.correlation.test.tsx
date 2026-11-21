// @vitest-environment jsdom
/**
 * R266：审批导出 correlation/rid 组合护栏（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - 工单②「切 ?status=approved 后同单两列与行整体 toEqual 不漂移、
 *    行数==表体==apv5-count」= approvals.export.statusmatrix it② L246
 *    （轮转整 grid toEqual，grid 本就含七列）+ approvals.export.multistatus
 *    it②（换代零残留）回证据，不重写。
 *  - correlation 列==单号本身 = approvals.export.missing.fields L247/L271
 *    与 approvals.panel.detail.parity L314 已锁；但工单①点名「==屏上抽屉
 *    apd9 审计同源值」=CSV 列与 apd9-audit-link 的 resource 参数同帧互等，
 *    此前未锁=真增量；「rid 列==apd11 复制的完整请求号」=R100 七段契约与
 *    R257 全串列的分站锁，同帧互等=真增量。
 *  - 工单③「第 2 页追加后两列逐行配对不错位」=R265 it② 只锁 id/标题列，
 *    correlation/rid 两列逐行=增量，并入本文件第二站。
 *  - 「缺值=空字段，禁『—』」=missing.fields it① 已锁形态，本文件在同帧
 *    顺带复锁（成本低、语义同源）。
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

/** R52-obs：toggle 锚名是序号，全 id 在 data-record。 */
const openPreview = async (id: string): Promise<void> => {
  const toggle = document.querySelector(
    `[data-testid^="apv9-toggle-"][data-record="${id}"]`,
  ) as HTMLButtonElement | null;
  expect(toggle, `preview toggle for ${id}`).toBeTruthy();
  await act(async () => {
    toggle!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await waitFor(() => !!q(`apv9-preview-${id}`), `preview of ${id}`);
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
    return "blob:correlation-266";
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

const COR1 = {
  approvalId: "ap_cor1",
  title: "关联完整单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-cor-87654321",
};
const COR2 = {
  approvalId: "ap_cor2",
  title: "缺请求编号单",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
};
const COR3 = {
  approvalId: "ap_cor3",
  title: "第二页关联单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T04:00:00Z",
  createdAt: "2026-11-18T03:00:00Z",
  requestId: "req-cor-33334444",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [COR1, COR2, COR3].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("cursor=")) return { items: [COR3] };
    return { items: [COR1, COR2], nextCursor: "pc-266" };
  });
};

describe("R266 approvals export correlation/rid guards", () => {
  it("matches the correlation column with the drawer audit link and the rid column with the apd11 copy, byte-for-byte", async () => {
    serve();
    await render("/approvals?tab=history");
    const { text, grid } = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    const full = grid.find((r) => r[0] === "ap_cor1");
    const gap = grid.find((r) => r[0] === "ap_cor2");
    expect(full?.[5]).toBe("ap_cor1");
    expect(full?.[6]).toBe("req-cor-87654321");
    // 缺值=空字段（禁「—」）腿，与 missing.fields 同口径复锁
    expect(gap?.[6], "缺 rid 行 CSV 空字段").toBe("");
    expect(text, "CSV 不写占位破折号").not.toMatch(/,—(,|$)/);

    // apd11 腿：预览展开态复制七段里的完整请求号==CSV rid 列逐字
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (t: string) => {
          written.push(t);
          return Promise.resolve();
        },
      },
    });
    const beforeCopy = clicks();
    await openPreview("ap_cor1");
    await clickTestId("apd11-copy");
    await waitFor(() => written.length > 0, "apd11 copy landed");
    expect(clicks(), "apd11 copy never refetches").toBe(beforeCopy);
    const detailCopy = written[written.length - 1] ?? "";
    expect(detailCopy).toContain("请求编号：req-cor-87654321");
    const ridLine = detailCopy
      .split("\n")
      .find((line) => line.startsWith("请求编号："));
    expect(ridLine, "apd11 有请求编号段").toBeTruthy();
    expect(ridLine!.replace("请求编号：", ""), "CSV rid==apd11 完整请求号").toBe(full?.[6]);

    // apd9 腿：抽屉审计链接的 resource 参数==CSV correlation 列逐字
    await openDetail("ap_cor1");
    const link = q("apd9-audit-link") as HTMLAnchorElement | null;
    expect(link, "apd9 audit link").toBeTruthy();
    const href = link!.getAttribute("href") ?? "";
    const decoded = decodeURIComponent(href);
    expect(decoded).toContain("resource=ap_cor1");
    expect(
      decoded.split("resource=")[1]?.split("&")[0],
      "apd9 审计同源值==CSV correlation 列",
    ).toBe(full?.[5]);
  });

  it("pairs the correlation and rid rows on the appended second page without any shift", async () => {
    serve();
    await render("/approvals?tab=history");
    await clickTestId("apv-page-more");
    await waitFor(() => rowIds().join(",") === "ap_cor1,ap_cor2,ap_cor3", "page 2 appended");
    const { grid } = await grabCsv();
    const data = grid.slice(1);
    expect(data.map((r) => r[0])).toEqual(rowIds());
    // 逐行：correlation==该单号、rid==该行请求编号（缺值行=空字段）
    expect(data.map((r) => r[5])).toEqual(["ap_cor1", "ap_cor2", "ap_cor3"]);
    expect(data.map((r) => r[6])).toEqual(["req-cor-87654321", "", "req-cor-33334444"]);
    expect(q("apv5-count")?.textContent).toBe("3");
  });
});
