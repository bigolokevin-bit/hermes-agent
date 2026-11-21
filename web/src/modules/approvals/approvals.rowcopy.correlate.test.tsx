// @vitest-environment jsdom
/**
 * R304：审批行复制 correlation 与 CSV 列配对（纯测试，零产品改动）。
 *
 * 先 git grep 查重，已覆盖只回证据（行号=当轮链上实读），禁重复写：
 *  - 工单②「第 2 页追加后复制钮与 CSV 行配对不错行」的 col0 腿 =
 *    approvals.export.rowcopy.same.test.tsx（R265）it② L291（segs["单号"]==csvIds[i]，
 *    csvIds 取 col0）；本文件只补 **correlation 列（col5）腿**（R304 增量）。
 *  - 工单③「开合详情前后复制文本不变、开态复制零额外请求、三值相等」=
 *    approvals.detail.copy.test.tsx（R162）L161（六段=行字段且抽屉开态 byte-equal）
 *    + L195（开态复制零请求）+ approvals.export.drawer.pairs.test.tsx（R275）
 *    it③ L305（三值同步+关闭行序不变）。整腿已覆盖，本文件不重写。
 *  - CSV correlation 列==审批单号对「屏上」的锁 = approvals.columns.lock.test.tsx
 *    L214（cells[5]=="ap_h1"，R107 契约）；但那是 CSV↔屏，不是 CSV↔复制段。
 *  - 真缺口（本文件两 it）：
 *    ①复制「单号」段 ↔ CSV correlation 列(col5) 逐字等式从未成对锁过——
 *      rowcopy.same it① L259 只把「单号」段对到 col0（id 列）；col5==col0 的
 *      列间等式（R107 同值异列契约）也无 CSV 内直接锁。缺 rawId 行三载体
 *      （复制「单号：—」/CSV col0 空/col5 空、禁「—」进 CSV）未锁——R265 的
 *      gap 行缺的是 risk/decided/rid，不是单号。
 *    ②追加后「逐行 单号段↔col5」位位对齐（钮 index↔CSV 行↔col5）未锁。
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
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
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
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .filter((el) => !String(el.getAttribute("data-testid")).includes("-details-"))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""));
/** 屏上行复制钮总数（含缺单号行——其 testid 不带 ap_ 前缀，rowIds 滤不到）。 */
const copyBtnCount = (): number =>
  Array.from(document.querySelectorAll("button")).filter((b) =>
    /^apr-row-copy-\d+$/.test(String(b.getAttribute("data-testid"))),
  ).length;

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

/** 简单 CSV 解析：本文件夹具标题不含逗号/引号（R243/R303 同款口径）。 */
function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .map((line) => line.split(","));
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
    return "blob:rowcopy-correlate-304";
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

const CR1 = {
  approvalId: "ap_cr1",
  title: "关联配对完整单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-cr-1111222233334444",
};
const CRG = {
  title: "关联配对缺单号单",
  status: "pending",
  riskLevel: "low",
  createdAt: "2026-11-17T01:00:00Z",
};
const CR2 = {
  approvalId: "ap_cr2",
  title: "关联配对追加单",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T05:00:00Z",
  createdAt: "2026-11-18T05:00:00Z",
  requestId: "req-cr-2222333344445555",
};

const serve = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("cursor=")) return { items: [CR2] };
    return { items: [CR1, CRG], nextCursor: "cr-2" };
  });
};

describe("R304 approvals rowcopy x CSV correlation pair guards", () => {
  it("pairs the copy 单号 segment with the CSV correlation column verbatim, locks col5==col0, and holds the missing-id dual convention", async () => {
    stubClipboard();
    serve();
    await render();
    expect(rowIds()).toEqual(["ap_cr1"]);
    expect(copyBtnCount(), "两行各一枚复制钮").toBe(2);
    const { text, grid } = await grabCsv();
    expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
    // 完整单：单号段 == col5(correlation) == col0(id)，全串非短码
    const row = grid.find((r) => r[1] === "关联配对完整单");
    expect(row, "完整单在 CSV").toBeTruthy();
    expect(row![5], "correlation==id 列（R107 同值异列）").toBe(row![0]);
    const lines = (await copyRowByIndex(0)).split("\n");
    expect(lines[0]).toBe(`单号：${row![5]}`);
    expect(lines[0]).toBe("单号：ap_cr1");
    // 缺单号行：复制「单号：—」、CSV col0/col5 均空字段（禁「—」进数据）
    const gapRow = grid.find((r) => r[1] === "关联配对缺单号单");
    expect(gapRow, "缺单号行在 CSV").toBeTruthy();
    expect(gapRow![0]).toBe("");
    expect(gapRow![5]).toBe("");
    const gapLines = (await copyRowByIndex(1)).split("\n");
    expect(gapLines[0]).toBe("单号：—");
    expect(text, "CSV 不把破折号写进数据").not.toMatch(/—/);
    expect(text, "无裸内部量泄漏").not.toMatch(/undefined|null/);
  });

  it("keeps every 单号↔correlation pairing row-aligned after appending page two with consecutive copy indexes", async () => {
    stubClipboard();
    serve();
    await render();
    await clickTestId("apv-page-more");
    await waitFor(() => rowIds().includes("ap_cr2"), "page two appended");
    expect(rowIds(), "行序=CR1、追加 CR2（CRG 无单号不入 rowIds）").toEqual(["ap_cr1", "ap_cr2"]);
    expect(copyBtnCount(), "三行钮序号连续 0..2").toBe(3);
    const { grid } = await grabCsv();
    const data = grid.slice(1);
    expect(data.length, "CSV 三数据行").toBe(3);
    // 位位对齐：第 i 枚钮的复制首段 == 第 i 行 CSV 的 correlation（缺单号行按双口径）
    const seg1 = (await copyRowByIndex(0)).split("\n")[0];
    expect(seg1).toBe(`单号：${data[0]![5]}`);
    expect(seg1).toBe("单号：ap_cr1");
    const seg2 = (await copyRowByIndex(1)).split("\n")[0];
    expect(data[1]![5], "CRG 站 col5 空").toBe("");
    expect(seg2, "CRG 站复制破折号").toBe("单号：—");
    const seg3 = (await copyRowByIndex(2)).split("\n")[0];
    expect(seg3).toBe(`单号：${data[2]![5]}`);
    expect(seg3).toBe("单号：ap_cr2");
    for (const r of data) {
      expect(r[5], "col5==col0 列间等式逐行").toBe(r[0]);
    }
  });
});
