// @vitest-environment jsdom
/**
 * R306 — 审批导出与抽屉行复制的三站一致（纯测试，零产品改动）。
 *
 * 先 git grep 现查既有覆盖，已覆盖只回证据、本文件不写重复用例：
 * ③空站腿「disabled+title+未调 createObjectURL」=approvals.rowcopy.window.gap.test.tsx
 *   (R300) it③ L340 逐字已锁（railIds()==[] 钮位列表等式+export disabled+title
 *   「不能导出」+强点零 Blob 零请求+刷新钮可用现场裁决）；同族 bounds.test.tsx
 *   (R?) it① L148 再锁 pending 0 行 disabled+「—」非假 0。工单③完全覆盖=回证据。
 * ②主体=multistatus it② L180（pending↔approved 两站 blob col0 集互斥+每步无
 *   cursor=）+crossstate it② L268（三站轮换零残留，对象为复制文本与行序非
 *   blob）。「页码归 1」：status 为服务端维、每站首请求无 cursor、产品无页码态
 *   ——无追加站型不适用，按现状注记（R278/R280 先例）。
 * ①近亲=crossstate it① L241 三站复制首段==CSV 首列，但缺「行数==apv5-count」
 *   四值腿与「apr-row-copy-0 钮位形态」腿。
 * 本文件真增量：
 * ①三站 loop 四值集中站：CSV 首行单号==屏上首行==apr-row-copy-0 首段（钮位
 *   形态）+ CSV 数据行数==rowIds 数==apv5-count 数字 + 每站 blob id 集合恰等
 *   本站行集（三站版 blob 内容排他）。
 * ②单挂载快捷钮链式切三站：blob 互不残留（rejected 站排他也入列）+切换后
 *   列表请求不带 cursor=。
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

async function clickTestId(id: string): Promise<void> {
  const el = q(id);
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
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
    return "blob:export-drawer3-306";
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

/** 按屏上钮序号复制一行（锁钮位形态 apr-row-copy-<i> 与零额外请求）。 */
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

/** apv5-count 数字位解析（不含反斜杠正则的取数法）。 */
const countNumber = (): number =>
  Number((q("apv5-count")?.textContent ?? "").replace(/[^0-9]/g, ""));

const OS1 = {
  approvalId: "ap_os1",
  title: "三站导出待办甲",
  status: "pending",
  riskLevel: "high",
  createdAt: "2026-11-19T01:00:00Z",
  requestId: "req-os-11112222",
};
const OS2 = {
  approvalId: "ap_os2",
  title: "三站导出待办乙",
  status: "pending",
  riskLevel: "low",
  createdAt: "2026-11-19T02:00:00Z",
  requestId: "req-os-22223333",
};
const OA1 = {
  approvalId: "ap_os3",
  title: "三站导出已批甲",
  status: "approved",
  riskLevel: "medium",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T03:00:00Z",
  requestId: "req-os-33334444",
};
const OA2 = {
  approvalId: "ap_os4",
  title: "三站导出已批乙",
  status: "approved",
  riskLevel: "critical",
  decidedAt: "2026-11-19T04:00:00Z",
  createdAt: "2026-11-18T04:00:00Z",
  requestId: "req-os-44445555",
};
const OR1 = {
  approvalId: "ap_os5",
  title: "三站导出已拒甲",
  status: "rejected",
  riskLevel: "low",
  decidedAt: "2026-11-19T05:00:00Z",
  createdAt: "2026-11-18T05:00:00Z",
  requestId: "req-os-55556666",
};

const serve3 = (): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = [OS1, OS2, OA1, OA2, OR1].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=pending")) return { items: [OS1, OS2] };
    if (u.includes("status=approved")) return { items: [OA1, OA2] };
    if (u.includes("status=rejected")) return { items: [OR1] };
    return { items: [OS1, OS2, OA1, OA2, OR1] };
  });
};

const csvIds = (grid: string[][]): string[] => grid.slice(1).map((r) => r[0]);

describe("R306 approvals export drawer three-state guards", () => {
  it("holds the four-value equation on every status station: CSV head equals on-screen head equals apr-row-copy-0 head, row counts equal apv5-count, and each blob holds exactly its own station", async () => {
    stubClipboard();
    const stations = [
      { value: "pending", ids: ["ap_os1", "ap_os2"] },
      { value: "approved", ids: ["ap_os3", "ap_os4"] },
      { value: "rejected", ids: ["ap_os5"] },
    ];
    for (const station of stations) {
      clearScreen();
      api.fetchJSON.mockReset();
      serve3();
      await render(`/approvals?tab=history&status=${station.value}`);
      expect(rowIds(), `rows at ${station.value}`).toEqual(station.ids);
      const { grid } = await grabCsv();
      expect(grid[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
      // 值一/值二：CSV 首行单号 == 屏上首行
      expect(grid[1]?.[0], `csv head row id at ${station.value}`).toBe(station.ids[0]);
      // 值三：apr-row-copy-0 钮位形态首段逐字配对
      const head = await copyRowByIndex(0);
      expect(head.split("\n")[0], `copy #0 head at ${station.value}`).toBe(
        `单号：${station.ids[0]}`,
      );
      // 值四：CSV 数据行数 == 屏上行数 == apv5-count 数字
      expect(grid.slice(1).length, `csv rows at ${station.value}`).toBe(rowIds().length);
      expect(countNumber(), `apv5-count at ${station.value}`).toBe(station.ids.length);
      // 三站版 blob 内容排他：恰等本站行集
      expect(csvIds(grid), `blob ids exactly station ${station.value}`).toEqual(station.ids);
    }
  });

  it("swaps the export blob exclusively across a chained status switch on one mount with no cursor on any switch request", async () => {
    stubClipboard();
    serve3();
    await render("/approvals?tab=history&status=pending");
    expect(rowIds()).toEqual(["ap_os1", "ap_os2"]);
    const first = await grabCsv();
    expect(csvIds(first.grid)).toEqual(["ap_os1", "ap_os2"]);
    await clickTestId("apv5-filter-status-approved");
    await waitFor(() => rowIds().join(",") === "ap_os3,ap_os4", "approved rows");
    const second = await grabCsv();
    expect(csvIds(second.grid)).toEqual(["ap_os3", "ap_os4"]);
    expect(second.text, "approved blob holds no pending rows").not.toContain("ap_os1");
    expect(second.text).not.toContain("ap_os2");
    await clickTestId("apv5-filter-status-rejected");
    await waitFor(() => rowIds().join(",") === "ap_os5", "rejected rows");
    const third = await grabCsv();
    expect(csvIds(third.grid), "rejected blob exclusive even for the singleton station").toEqual([
      "ap_os5",
    ]);
    expect(third.text, "rejected blob holds no approved rows").not.toContain("ap_os3");
    expect(third.text).not.toContain("ap_os4");
    expect(third.text).not.toContain("ap_os1");
    // 切换后每一列表请求都不带 cursor=（页码归 1 的现势形态：服务端维单请求站）
    for (const call of api.fetchJSON.mock.calls) {
      const url = String(call[0]);
      if (url.includes("/api/approvals?")) {
        expect(url, `no cursor: ${url}`).not.toMatch(/cursor=/);
      }
    }
    expect(listCalls(), "one list read per station including switches").toBe(3);
    // rejected 站钮位形态仍配对
    const head = await copyRowByIndex(0);
    expect(head.split("\n")[0]).toBe("单号：ap_os5");
    // 「页码归 1」按现状注记：本产品无页码控件，游标腿以上一律 notMatch cursor= 锁定。
  });
});
