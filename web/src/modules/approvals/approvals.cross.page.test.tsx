// @vitest-environment jsdom
/**
 * R218 — 审批待处理队列与历史页跨页同值护栏（纯测试，禁改产品行为）。
 *
 * 已覆盖只回证据，不写重复用例：
 * 同一页面内 列表=预览=详情=CSV 的逐字矩阵 = approvals.parity(R120)、
 * approvals.detail.copy(R162)、approvals.decision.parity2(R216)、
 * approvals.csv.roundtrip(R217)、approvals.export.filter(R182)；
 * 六段 apr-row-copy 契约与排序同序 = R127/R162；七列 CSV 契约与
 * correlation/rid = R107；pending 进入即移除 status 的参数语义 =
 * R93b/approvals.filterurl(R98)；window 参=apv5-filter-window 恒
 * disabled 摆设（不进请求/不改写 URL）= R129/R139。
 * ⇒ 两个页面组件之间的跨页对照从未入库，本文件写缺口。
 *
 * 现场裁决（禁臆造第二套）：
 * ①「同一审批单在两页」由测试场景构造：同一行对象同时出现在
 *   status=pending 与 status=approved 两条腿的 mock 返回里——本护栏
 *   锁定的是两个页面组件对同一行数据的渲染一致性，不断言上游语义
 *   （真实数据里一单只在一个状态腿出现）。
 * ②风险档在两页行卡契约里都没有展示位（R162 先例）：跨页等值改由
 *   行内预览面板（两页 apv9-preview 整块文本逐字相等、含风险人话）
 *   与 apr-row-copy 的「风险：」段锁定。
 * ③两页在壳层是互斥挂载（同一 router 切 tab）；本测试用两个独立
 *   MemoryRouter 实例模拟「各自独立」：一页的筛选操作只动自己
 *   router 的 search，另一页的行集与读数不受累。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";

const api = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

function clearScreen(): void {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
}

afterEach(() => {
  clearScreen();
  api.mockReset();
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

function LocIn({ tag }: { tag: string }): ReactElement {
  const location = useLocation();
  return <span data-testid={tag}>{location.pathname + location.search}</span>;
}

async function renderPage(entry: string, node: ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        {node}
        <LocIn tag={`cp-loc-${entry.includes("tab=pending") ? "pend" : "hist"}`} />
      </MemoryRouter>,
    );
  });
  return container;
}

const settle = async (): Promise<void> => {
  await waitFor(
    () =>
      Array.from(document.querySelectorAll(".animate-pulse")).length === 0 &&
      Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_x"]')).length > 0,
    "both pages settled with rows",
  );
};

const textIn = (box: HTMLDivElement, testid: string): string => {
  const el = box.querySelector(`[data-testid="${testid}"]`);
  return el ? (el.textContent ?? "") : `<<missing ${testid}>>`;
};
const attrIn = (box: HTMLDivElement, sel: string, name: string): string => {
  const el = box.querySelector(sel);
  return el ? (el.getAttribute(name) ?? "") : `<<missing ${sel}>>`;
};
const clickIn = async (_box: HTMLDivElement, el: Element | null, label: string): Promise<void> => {
  expect(el, label).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
};
const rowsIn = (box: HTMLDivElement): string[] =>
  Array.from(box.querySelectorAll('[data-testid^="apr5-row-ap_"]'))
    .map((el) => (el.getAttribute("data-testid") ?? "").replace("apr5-row-", ""))
    .filter((t) => !t.includes("details"));
const openFiltersIn = async (box: HTMLDivElement): Promise<void> => {
  const toggle = box.querySelector('[data-testid="apv-filter-toggle"]') as HTMLButtonElement | null;
  expect(toggle, "filter disclosure present").toBeTruthy();
  await clickIn(box, toggle, "open filters");
  await waitFor(() => toggle!.getAttribute("aria-expanded") === "true", "filter panel opened");
};
const toggleFor = (box: HTMLDivElement, key: string): Element | null =>
  Array.from(box.querySelectorAll('[data-testid^="apv9-toggle-"]')).find(
    (el) => el.getAttribute("data-record") === key,
  ) ?? null;
const pvDds = (box: HTMLDivElement, key: string): string[] => {
  const pv = box.querySelector(`[data-testid="apv9-preview-${key}"]`);
  return pv
    ? Array.from(pv.querySelectorAll("dd")).map((dd) => (dd.textContent ?? "").trim())
    : ["<<no preview>>"];
};

const urls = (): string[] => api.mock.calls.map((c) => String(c[0]));
const listCalls = (): number => urls().filter((u) => u.includes("/api/approvals")).length;

// —— 夹具：同一行对象出现在两条状态腿里（裁决①的场景构造）——
const C1 = {
  approvalId: "ap_x1",
  title: "跨页同值单",
  status: "approved",
  riskLevel: "high",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  decisions: [
    { approver: "human:7", name: "郑涛", decision: "approve", at: "2026-11-19T02:00:00Z", comment: "同意" },
  ],
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
  requestId: "req-x-12345678",
};
const C2 = {
  approvalId: "ap_x2",
  title: "跨页待办单",
  status: "pending",
  approvers: [{ userId: "human:8", name: "阿朝" }],
  decisions: [],
  createdAt: "2026-11-18T03:00:00Z",
};

function serveBoth(): void {
  api.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) return C1;
    if (u.includes("status=approved")) return { items: [C1] };
    if (u.includes("status=pending")) return { items: [C1, C2] };
    if (u.includes("status=rejected")) return { items: [] };
    return { items: [C1, C2] };
  });
}

async function mountPair(): Promise<{ hist: HTMLDivElement; pend: HTMLDivElement }> {
  serveBoth();
  const hist = await renderPage(
    "/approvals?tab=history&status=approved&window=30d",
    <ApprovalsHistoryModulePage />,
  );
  const pend = await renderPage(
    "/approvals?tab=pending",
    <ApprovalsPendingModulePage />,
  );
  await settle();
  return { hist, pend };
}

describe("R218 approvals cross-page parity (pending vs history)", () => {
  it("① one record reads byte-identical on both pages: title, status, both times, record id; risk travels via the preview block (no row slot by contract)", async () => {
    const { hist, pend } = await mountPair();
    expect(textIn(hist, "apv-trunc-row-title-ap_x1")).toBe(
      textIn(pend, "apv-trunc-row-title-ap_x1"),
    );
    expect(textIn(hist, "apv-trunc-row-title-ap_x1")).toContain("跨页同值单");
    // 状态人话：行卡徽标=标题钮所在 header 容器最后一个元素（R120 同款读法）
    const badge = (box: HTMLDivElement): string => {
      const titleBtn = box.querySelector('[data-testid="apv-trunc-row-title-ap_x1"]')?.closest("button");
      const header = titleBtn?.parentElement;
      const last = header?.lastElementChild;
      return last ? (last.textContent ?? "").trim() : "<<no badge>>";
    };
    expect(badge(hist)).toBe(badge(pend));
    expect(badge(hist)).not.toMatch(/undefined|null/);
    // 提交/更新时间：title 的绝对句两页逐字
    for (const t of ["apv-time-row-submitted-ap_x1", "apv-time-row-ap_x1"]) {
      expect(attrIn(hist, `[data-testid="${t}"]`, "title")).toBe(
        attrIn(pend, `[data-testid="${t}"]`, "title"),
      );
      expect(attrIn(hist, `[data-testid="${t}"]`, "title")).toContain("2026-11");
    }
    // 屏上相对句也要求同分钟一致（固定历史时间，天然稳定）
    for (const t of ["apv-time-row-submitted-ap_x1", "apv-time-row-ap_x1"]) {
      expect(textIn(hist, t)).toBe(textIn(pend, t));
    }
    // 单号：toggle 的 data-record 两页同值
    const recH = toggleFor(hist, "ap_x1")?.getAttribute("data-record") ?? "<<no toggle>>";
    const recP = toggleFor(pend, "ap_x1")?.getAttribute("data-record") ?? "<<no toggle>>";
    expect(recH).toBe("ap_x1");
    expect(recP).toBe(recH);
    // 风险档：两页各自展开预览，整块文本逐字相等且含高风险
    await clickIn(hist, toggleFor(hist, "ap_x1"), "history preview toggle");
    await clickIn(pend, toggleFor(pend, "ap_x1"), "pending preview toggle");
    const pvH = hist.querySelector('[data-testid="apv9-preview-ap_x1"]');
    const pvP = pend.querySelector('[data-testid="apv9-preview-ap_x1"]');
    expect(pvH && pvP ? (pvH.textContent ?? "") : "<<missing>>").toBe(
      pvH && pvP ? (pvP.textContent ?? "") : "<<missing>>",
    );
    expect(pvDds(hist, "ap_x1").join("|")).toContain("高风险");
    expect(pvDds(pend, "ap_x1").join("|")).toBe(pvDds(hist, "ap_x1").join("|"));
    expect(pvDds(hist, "ap_x1").join("|")).not.toMatch(/undefined|null/);
  });

  it("② the row-copy text for the same record is byte-identical across pages, with zero extra requests", async () => {
    const { hist, pend } = await mountPair();
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
    const copyBtn = (box: HTMLDivElement): Element | null =>
      box.querySelector('[data-testid="apr5-row-ap_x1"]')?.querySelector('[data-testid^="apr-row-copy-"]') ??
      null;
    const before = api.mock.calls.length;
    await clickIn(hist, copyBtn(hist), "history row copy");
    await waitFor(() => written.length === 1, "history copy landed");
    await clickIn(pend, copyBtn(pend), "pending row copy");
    await waitFor(() => written.length === 2, "pending copy landed");
    expect(written[1]).toBe(written[0]);
    expect(written[0]).toContain("单号：ap_x1");
    expect(written[0]).toContain("标题：跨页同值单");
    expect(written[0]).toContain("风险：高风险");
    expect(written[0]).toContain("短码：12345678");
    expect(written[0]).not.toContain("req-x-12345678");
    expect(written[0]).not.toMatch(/undefined|null/);
    expect(api.mock.calls.length).toBe(before);
  });

  it("③ a filter change on one page moves only that page: the other page's URL and row set stay put", async () => {
    const { hist, pend } = await mountPair();
    const pendRowsBefore = rowsIn(pend);
    const pendLocBefore = textIn(pend, "cp-loc-pend");
    const histListCallsBefore = listCalls();
    await clickIn(hist, hist.querySelector('[data-testid="apr5-filter-rejected"]'), "history status switch");
    await waitFor(() => rowsIn(hist).length === 0, "history page emptied by the rejected filter");
    expect(listCalls()).toBe(histListCallsBefore + 1);
    expect(textIn(hist, "cp-loc-hist")).toContain("status=rejected");
    // 另一页完全不受累：行集与自身 URL 一字不变
    expect(rowsIn(pend)).toEqual(pendRowsBefore);
    expect(textIn(pend, "cp-loc-pend")).toBe(pendLocBefore);
    // 反向：pending 页挑审批人桶（本地维）也不得动历史页
    // 现场：审批人桶位于筛选折叠面板内（P0-③ 设计），先展开再点
    const histRowsBefore = rowsIn(hist);
    await openFiltersIn(pend);
    const bucket =
      Array.from(pend.querySelectorAll('button[data-testid^="apv-actor-bucket-"]')).find((el) =>
        (el.getAttribute("title") ?? "").includes("human:8"),
      ) ?? null;
    await clickIn(pend, bucket, "pending actor bucket (阿朝)");
    await waitFor(() => rowsIn(pend).join(",") === "ap_x2", "pending narrowed to the bucket");
    expect(rowsIn(hist)).toEqual(histRowsBefore);
    expect(listCalls(), "actor is a local dimension: never refetches").toBe(histListCallsBefore + 1);
    expect(textIn(pend, "cp-loc-pend")).toContain("actor=");
    expect(textIn(hist, "cp-loc-hist")).not.toContain("actor=");
  });

  it("④ the same record exports byte-identically from both pages; each export costs zero extra requests", async () => {
    const { hist, pend } = await mountPair();
    const blobs: Blob[] = [];
    const origCreate = URL.createObjectURL;
    const origClick = HTMLAnchorElement.prototype.click;
    const downloads: string[] = [];
    URL.createObjectURL = ((blob: Blob) => {
      blobs.push(blob);
      return "blob:cross-page";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    } as typeof HTMLAnchorElement.prototype.click;
    try {
      const callsBefore = api.mock.calls.length;
      await clickIn(hist, hist.querySelector('[data-testid="apv7-export"]'), "history export");
      expect(blobs.length).toBe(1);
      await clickIn(pend, pend.querySelector('[data-testid="apv7-export"]'), "pending export");
      expect(blobs.length).toBe(2);
      expect(api.mock.calls.length).toBe(callsBefore);
      const gridOf = async (blob: Blob): Promise<string[][]> => {
        const text = (await blob.text()).replace(/^\uFEFF/, "");
        return text
          .split("\r\n")
          .filter((line) => line !== "")
          .map((line) => line.split(","));
      };
      const gH = await gridOf(blobs[0]);
      const gP = await gridOf(blobs[1]);
      expect(gH[0].join(",")).toBe("id,title,status,risk,updated_at,correlation,rid");
      expect(gP[0].join(",")).toBe(gH[0].join(","));
      const rowH = gH.find((cells) => cells[0] === "ap_x1");
      const rowP = gP.find((cells) => cells[0] === "ap_x1");
      expect(rowH, "history csv carries the record").toBeTruthy();
      expect(rowP, "pending csv carries the record").toBeTruthy();
      expect(rowP).toEqual(rowH);
      expect(rowH?.[6]).toBe("req-x-12345678");
      // 两页文件名各按自己的 tab/status（同源契约，不互相冒充）
      expect(downloads[0]).toContain("-history-approved-");
      expect(downloads[1]).toContain("-pending-pending-");
    } finally {
      URL.createObjectURL = origCreate as typeof URL.createObjectURL;
      HTMLAnchorElement.prototype.click = origClick;
    }
  });
});
