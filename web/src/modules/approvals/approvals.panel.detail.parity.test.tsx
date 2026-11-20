// @vitest-environment jsdom
/**
 * R230 — 审批列表面板与详情同源护栏（纯测试，零产品改动，gap-only）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ① 同一单 标题/状态人话/更新时间/单号 在 行卡×预览×抽屉×行复制 逐字相等
 *   = approvals.parity.test.tsx it「title, status, risk, decided minute and
 *   rid are byte-equal on every surface」(L225) + approvals.detail.copy
 *   it「the six segments are the row's own fields…」(L161)；风险档行卡无位
 *   的既有裁决也在那两处（预览↔详情对照）。
 * ② 缺 risk/decided/rid 四处同句、禁 undefined/null/裸全 id
 *   = approvals.parity it L256（缺 rid 同句单常量）+ approvals.detail.copy
 *   it L215（gap words 不泄 id）+ approvals.detail.missing it L229/L284
 *   （四形态四载体集中矩阵）。
 * ③ 开抽屉恰 1 次 ?id=、列表腿不重取、关闭零请求、行序不变
 *   = approvals.parity it L271/L282 + approvals.detail.fields2 it L328。
 *   ——「关闭后 apv5-count 读数不变」这一格此前未点名，本文件 it① 补锁。
 * ④ 切 ?status=approved 后三处同源 + 导出 CSV 同单行逐字
 *   = 分散锁：parity it L311 锁 CSV==三处（无状态切换站）、export.filter
 *   锁 status 深链三值、detail.missing it L309 锁 status 深链缺值句；
 *   「先切站、再走三处+CSV 全矩阵」的单用例组合 = 本文件 it① 主体。
 *
 * 现场事实：DT=decidedAt 2026-11-19T02:00:00Z → 北京「2026-11-19 10:00」；
 * 预览/行时间载体=apv-time-* 的 title 绝对句（absMinute=slice(3,19)）；
 * 六段复制「更新时间」=row.clock（已批单与 decided 同源 R65）；短码=
 * requestId 后 8 位；CSV 七列 correlation=rawId。apr5-filter-<state>
 * 八态主组在面板外直接可点（R218 现场）。R60 互斥=开详情收预览，
 * 预览值先存变量。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

afterEach(() => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
  mock.mockReset();
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

async function renderInto(entry: string, node: ReactElement): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const render = (entry: string) =>
  renderInto(entry, <ApprovalsHistoryModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
let urlsAll: string[] = [];
const listCalls = () => urlsAll.filter((u) => u.includes("/api/approvals"));

const DT = "2026-11-19 10:00"; // decidedAt 2026-11-19T02:00:00Z 的北京到分句
const P1 = {
  approvalId: "ap_pd1",
  title: "季度预算复议",
  status: "approved",
  riskLevel: "high",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-pd-12345678",
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};
const P2 = {
  approvalId: "ap_pd2",
  title: "密钥轮换",
  status: "approved",
  riskLevel: "low",
  createdAt: "2026-11-18T02:00:00Z",
  decidedAt: "2026-11-19T03:00:00Z",
};
const N1 = {
  approvalId: "ap_n9",
  title: "例行工单",
  status: "pending",
  createdAt: "2026-11-18T09:00:00Z",
};

function serveCombo() {
  urlsAll = [];
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = [P1, P2, N1].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("status=approved")) return { items: [P1, P2] };
    if (u.includes("/api/approvals")) return { items: [N1] };
    return {};
  });
}

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]'))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""))
    .filter((id) => !id.startsWith("details-"));

const openPreview = async (id: string) => {
  const btn = document.querySelector(
    `[data-testid^="apv9-toggle-"][data-record="${id}"]`,
  ) as HTMLButtonElement | null;
  expect(btn, `toggle of ${id}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => !!q(`apv9-preview-${id}`), `preview of ${id}`);
};

const openDetail = async (id: string) => {
  const card = document.querySelector(`[data-testid="apr5-row-${id}"]`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

const rowBadge = (id: string) => {
  const title = q(`apv-trunc-row-title-${id}`);
  const header = title?.closest("button")?.parentElement;
  return (header?.lastElementChild?.textContent ?? "").trim();
};

const detailBadges = () => {
  const head = q("apv-trunc-detail-title")?.parentElement;
  const kids = head ? Array.from(head.children).slice(1) : [];
  return kids.map((el) => (el.textContent ?? "").trim());
};

const previewDds = (id: string) =>
  Array.from(q(`apv9-preview-${id}`)?.querySelectorAll("dd") ?? []).map((el) => el.textContent ?? "");

const absMinute = (title: string | null) => (title ?? "").slice(3, 19);

describe("R230 ③④ combo — switch to ?status=approved keeps every carrier in lockstep", () => {
  it("row×preview×drawer×row-copy×CSV read one record identically after a server-side status switch; closing keeps apv5-count", async () => {
    serveCombo();
    await render("/approvals?tab=history");
    await waitFor(() => rowIds().includes("ap_n9"), "default station shows the pending row");
    expect(q("apv5-count")?.textContent).toBe("1");

    // 切站：八态主组在面板外直接可点（R218 现场）。
    const chip = q("apr5-filter-approved") as HTMLButtonElement | null;
    expect(chip, "approved quick filter").toBeTruthy();
    const listsBeforeSwitch = listCalls().length;
    await act(async () => {
      chip!.click();
    });
    await waitFor(() => rowIds().join(",") === "ap_pd1,ap_pd2", "approved station rows");
    expect(listCalls().length, "status switch costs exactly one list read").toBe(
      listsBeforeSwitch + 1,
    );
    expect(listCalls()[listCalls().length - 1]).toContain("status=approved");
    expect(q("apv5-count")?.textContent).toBe("2");

    // 预览先读（R60 互斥：随后开详情会收起预览）。
    await openPreview("ap_pd1");
    const dds = previewDds("ap_pd1");
    const pvStatus = dds[0] ?? "";
    const pvRisk = dds[1] ?? "";
    const pvTime = absMinute(q("apv-time-preview-ap_pd1")?.getAttribute("title"));
    expect(pvTime, "预览更新时间的绝对分钟").toBe(DT);

    // 抽屉同帧对照。
    await openDetail("ap_pd1");
    const rowTitle = (q("apv-trunc-row-title-ap_pd1")?.textContent ?? "").trim();
    const drawerTitle = (q("apv-trunc-detail-title")?.textContent ?? "").trim();
    expect(drawerTitle, "抽屉标题==行卡标题逐字").toBe(rowTitle);
    expect(rowTitle).toBe("季度预算复议");
    const badge = rowBadge("ap_pd1");
    expect(pvStatus, "预览状态==行徽标").toBe(badge);
    const dBadges = detailBadges();
    expect(dBadges[0], "抽屉状态徽标==行徽标").toBe(badge);
    expect(pvRisk, "预览风险==抽屉风险徽标").toBe(dBadges[1] ?? "");
    const dtDecided = (q("apd5-field-decided-at")?.querySelector("dd")?.textContent ?? "").trim();
    expect(dtDecided, "抽屉决定时间==预览绝对分钟").toBe(DT);
    expect(absMinute(q(`apv-time-row-${"ap_pd1"}`)?.getAttribute("title")), "行时间绝对分钟").toBe(DT);

    // ③增量格：关闭抽屉零请求，行序与 apv5-count 都不动。
    const callsBeforeClose = mock.mock.calls.length;
    const back = q("apd7-back") as HTMLButtonElement | null;
    expect(back, "back button").toBeTruthy();
    await act(async () => {
      back!.click();
    });
    await act(async () => {});
    expect(q("apr5-detail"), "detail closed").toBeNull();
    expect(mock.mock.calls.length, "closing asks for nothing").toBe(callsBeforeClose);
    expect(rowIds(), "row order unchanged after closing").toEqual(["ap_pd1", "ap_pd2"]);
    expect(q("apv5-count")?.textContent, "apv5-count 读数不变（③补格）").toBe("2");

    // 行复制六段与屏上值逐字。
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
    const callsBeforeCopy = mock.mock.calls.length;
    const copyBtn = q("apr-row-copy-0") as HTMLButtonElement | null;
    expect(copyBtn, "row copy button 0").toBeTruthy();
    await act(async () => {
      copyBtn!.click();
    });
    expect(written).toHaveLength(1);
    expect(written[0]).toContain("单号：ap_pd1");
    expect(written[0]).toContain(`标题：${rowTitle}`);
    expect(written[0]).toContain(`状态：${badge}`);
    expect(written[0]).toContain(`风险：${pvRisk}`);
    expect(written[0]).toContain(`更新时间：${DT}`);
    expect(written[0]).toContain("短码：12345678");
    expect(written[0]).not.toContain("req-pd-12345678"); // 全串只走短码
    expect(mock.mock.calls.length, "copy costs no request").toBe(callsBeforeCopy);

    // ④收口格：CSV 同单行与以上全部载体逐字。
    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr230";
    }) as typeof URL.createObjectURL;
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const callsBeforeExport = mock.mock.calls.length;
    try {
      const btn = q("apv7-export") as HTMLButtonElement | null;
      expect(btn, "export button").toBeTruthy();
      expect(btn!.disabled, "export enabled with loaded rows").toBe(false);
      await act(async () => {
        btn!.click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured).toHaveLength(1);
    const grid = (await captured[0].text())
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter((line) => line !== "")
      .map((line) => line.split(","));
    expect(grid[0]).toEqual(["id", "title", "status", "risk", "updated_at", "correlation", "rid"]);
    const p1 = grid.find((r) => r[0] === "ap_pd1");
    expect(p1, "csv row ap_pd1").toBeTruthy();
    expect(p1![1], "CSV title==屏上标题").toBe(rowTitle);
    expect(p1![2], "CSV status==行徽标").toBe(badge);
    expect(p1![3], "CSV risk==预览风险人话").toBe(pvRisk);
    expect(p1![4], "CSV updated_at==决定分钟").toBe(DT);
    expect(p1![5], "CSV correlation==单号").toBe("ap_pd1");
    expect(p1![6], "CSV rid==全串（数据列非复制位）").toBe("req-pd-12345678");
    expect(mock.mock.calls.length, "export costs no request").toBe(callsBeforeExport);
  });
});
