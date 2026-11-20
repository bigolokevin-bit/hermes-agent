// @vitest-environment jsdom
/**
 * R120 — 审批队列 ↔ 详情抽屉逐字同源护栏（纯测试，零产品改动）。
 *
 * 现场裁决（写入 commit/回执，禁臆造新文案）：
 * ② 详情不是复用列表行数据 —— 打开详情走独立详情读口 /api/approval?id=
 *   （恰 1 次详情取数），本护栏锁的是「列表腿计数不变」（列表数据从不重取）；
 * risk 在列表行卡没有展示位（行卡只渲标题/状态/时间/金额），两侧同源
 *   比较落在「预览 ↔ 详情」；rid 缺值句两侧同载体同常量（stateCopy 的
 *   APPROVAL_RID_MISSING），详情技术位 apd5-request-id-missing 另有
 *   FIELD_MISSING_SENTENCE 一句，按现状记录。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { useEffect } from "react";
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
import { APPROVAL_RID_MISSING, FIELD_MISSING_SENTENCE } from "@/modules/approvals/stateCopy";

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
  document.body.removeAttribute("data-r120-search");
});

function Probe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r120-search", loc.search);
  }, [loc.search]);
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
  renderInto(entry, (
    <>
      <ApprovalsHistoryModulePage />
      <Probe />
    </>
  ));

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const lastSearch = () => document.body.getAttribute("data-r120-search") ?? "";
const urlsAll: string[] = [];
const urls = () => urlsAll.slice();
const listCalls = () => urlsAll.filter((u) => u.includes("/api/approvals"));
const detailCalls = () => urlsAll.filter((u) => u.includes("/api/approval?id="));

const HOUR = 3_600_000;
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

const Q1 = {
  approvalId: "ap_q120",
  title: "季度预算复议",
  status: "approved",
  riskLevel: "medium",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-q120",
  reasonText: "护栏理由",
  createdAt: isoAgo(3 * HOUR),
  decidedAt: isoAgo(1 * HOUR),
};
const Q2 = {
  approvalId: "ap_q121",
  title: "密钥轮换",
  status: "pending",
  riskLevel: "high",
  approvers: [{ userId: "human:9", name: "阿朝" }],
  createdAt: isoAgo(2 * HOUR),
  // 故意没有 requestId —— 缺值两侧同句分支。
};
const Q3 = {
  approvalId: "ap_q122",
  title: "渠道发布",
  status: "approved",
  riskLevel: "low",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-q122",
  createdAt: isoAgo(24 * HOUR),
  decidedAt: isoAgo(12 * HOUR),
};

function serve(rows: unknown[]) {
  urlsAll.length = 0;
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = (rows as { approvalId?: string }[]).find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) return { items: rows };
    return {};
  });
}

/** status=pending 的两页夹具：第一页 Q1/Q2 带游标，第二页 Q3。 */
function servePaged() {
  urlsAll.length = 0;
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = [Q1, Q2, Q3].find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) {
      return u.includes("cursor=") ? { items: [Q3] } : { items: [Q1, Q2], nextCursor: "cg-120" };
    }
    return {};
  });
}

const openPreview = async (id: string) => {
  const btn = document.querySelector(`[data-testid^="apv9-toggle-"][data-record="${id}"]`) as HTMLButtonElement | null;
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

/** 行卡头部的状态徽标（title 按钮的兄弟 span）。 */
const rowBadge = (id: string) => {
  const title = q(`apv-trunc-row-title-${id}`);
  const header = title?.closest("button")?.parentElement;
  return (header?.lastElementChild?.textContent ?? "").trim();
};

/** 详情头部的两枚徽标 = [状态, 风险]（h2 之后的兄弟）。 */
const detailBadges = () => {
  const head = q("apv-trunc-detail-title")?.parentElement;
  const kids = head ? Array.from(head.children).slice(1) : [];
  return kids.map((el) => (el.textContent ?? "").trim());
};

/** 预览 dl 的 dd 顺序 = 状态 / 风险档 / 更新时间 / 审批人。 */
const previewDds = (id: string) =>
  Array.from(q(`apv9-preview-${id}`)?.querySelectorAll("dd") ?? []).map((el) => el.textContent ?? "");

/** RelativeTime 的 title 绝对句里取「YYYY-MM-DD HH:mm」（「绝对 」前缀 3 字符）。 */
const absMinute = (title: string | null) => (title ?? "").slice(3, 19);

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]')).map(
    (el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );

describe("R120 ① same record reads identically across row / preview / detail", () => {
  it("title, status, risk, decided minute and rid are byte-equal on every surface", async () => {
    serve([Q1, Q2]);
    await render("/approvals?tab=history");
    const n0 = listCalls().length;
    await openPreview(Q1.approvalId);
    const [pvStatus, pvRisk] = previewDds(Q1.approvalId);
    const pvTitle = q(`apv-trunc-preview-title-${Q1.approvalId}`)?.textContent ?? "";
    const pvTime = q(`apv-time-preview-${Q1.approvalId}`)?.getAttribute("title");
    const pvRid = q(`apv9-preview-${Q1.approvalId}`)?.textContent ?? "";
    expect(listCalls().length, "preview never refetches").toBe(n0);

    await openDetail(Q1.approvalId);
    // Row vs detail.
    expect(q("apv-trunc-detail-title")?.textContent, "title row==detail").toBe(
      q(`apv-trunc-row-title-${Q1.approvalId}`)?.textContent,
    );
    expect(detailBadges()[0], "status row==detail").toBe(rowBadge(Q1.approvalId));
    // Preview vs detail (the list row has no risk slot — see file header).
    expect(pvStatus, "preview status == detail status badge").toBe(detailBadges()[0]);
    expect(pvRisk, "preview risk == detail risk badge").toBe(detailBadges()[1]);
    expect(pvTitle).toBe("季度预算复议");
    // decidedAt 同一时刻：行 title / 预览 title / 详情决定时间字段逐字同分。
    const dtDecided = q("apd5-field-decided-at")?.querySelector("dd")?.textContent ?? "";
    expect(dtDecided.length, "detail carries a decided minute").toBeGreaterThan(0);
    expect(absMinute(pvTime), "preview minute == detail decided").toBe(dtDecided);
    expect(absMinute(q(`apv-time-row-${Q1.approvalId}`)?.getAttribute("title")), "row minute == detail decided").toBe(dtDecided);
    // rid：详情技术位 code 与预览复制行同值。
    expect(q("apd5-request-id")?.textContent).toBe("req-q120");
    expect(pvRid, "preview rid line carries the same id").toContain("req-q120");
  });

  it("a missing rid falls to the same sentence on preview and detail (single stateCopy constant)", async () => {
    serve([Q1, Q2]);
    await render("/approvals?tab=history");
    await openPreview(Q2.approvalId);
    const pvText = q(`apv9-preview-${Q2.approvalId}`)?.textContent ?? "";
    expect(pvText, "preview missing rid uses APPROVAL_RID_MISSING").toContain(APPROVAL_RID_MISSING);
    await openDetail(Q2.approvalId);
    const corr = q("apd9-correlation")?.textContent ?? "";
    expect(corr, "detail rid line uses the same constant sentence").toContain(APPROVAL_RID_MISSING);
    // 现状记录：详情技术位的缺值句是另一个单点常量（wave-29 口径）。
    expect(q("apd5-request-id-missing")?.textContent).toBe(FIELD_MISSING_SENTENCE);
  });
});

describe("R120 ②③ opening and closing the detail", () => {
  it("the list leg is never refetched; the detail uses its own read port exactly once", async () => {
    serve([Q1, Q2]);
    await render("/approvals?tab=history");
    const listBefore = listCalls().length;
    const totalBefore = urls().length;
    await openDetail(Q1.approvalId);
    expect(listCalls().length, "no extra list query when the detail opens").toBe(listBefore);
    expect(detailCalls().length, "one dedicated detail read").toBe(1);
    expect(urls().length).toBe(totalBefore + 1);
  });

  it("closing via apd7-back keeps filters, loaded pages and row order verbatim", async () => {
    servePaged();
    await render("/approvals?tab=history&status=pending");
    const more = q("apv-page-more") as HTMLButtonElement | null;
    expect(more, "cursor present enables more").toBeTruthy();
    await act(async () => {
      more!.click();
    });
    await waitFor(() => rowIds().includes("ap_q122"), "page two rows appended");
    const orderBefore = rowIds();
    const listBefore = listCalls().length;
    expect(orderBefore).toEqual(["ap_q120", "ap_q121", "ap_q122"]);

    await openDetail("ap_q120");
    expect(listCalls().length, "opening keeps the list leg").toBe(listBefore);
    const back = q("apd7-back") as HTMLButtonElement | null;
    expect(back, "back button").toBeTruthy();
    await act(async () => {
      back!.click();
    });
    await act(async () => {});
    expect(q("apr5-detail"), "detail closed").toBeNull();
    expect(rowIds(), "row order unchanged after return").toEqual(orderBefore);
    expect(listCalls().length, "returning never refetches the list").toBe(listBefore);
    expect(lastSearch(), "URL keeps the filter and drops only the id").toBe("?tab=history&status=pending");
  });
});

describe("R120 ④ CSV export mirrors both surfaces", () => {
  it("the exported row equals the row card, the preview and the detail values", async () => {
    serve([Q1, Q2]);
    await render("/approvals?tab=history");
    await openPreview(Q1.approvalId);
    const [pvStatus, pvRisk] = previewDds(Q1.approvalId);
    const rowTitle = q(`apv-trunc-row-title-${Q1.approvalId}`)?.textContent ?? "";
    const statusBadge = rowBadge(Q1.approvalId);
    await openDetail(Q1.approvalId);
    const dtDecided = q("apd5-field-decided-at")?.querySelector("dd")?.textContent ?? "";

    const downloads: string[] = [];
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr120";
    }) as typeof URL.createObjectURL;
    try {
      const btn = q("apv7-export") as HTMLButtonElement;
      expect(btn.disabled, "export enabled with loaded rows").toBe(false);
      await act(async () => {
        btn.click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured).toHaveLength(1);
    expect(downloads[0], "filename keeps the contract shape").toMatch(/^approvals-history-all-default-default-\d{8}-\d{4}\.csv$/);
    const text = await captured[0].text();
    const lines = text.split("\r\n").filter((l) => l !== "");
    // R107 契约：列头固定顺序不变、只追加 correlation/rid 两列。
    expect(lines[0]).toBe("id,title,status,risk,updated_at,correlation,rid");
    const q1line = lines.find((l) => l.startsWith("ap_q120"));
    expect(q1line, "the record is present in the export").toBeTruthy();
    const cells = q1line!.split(",");
    expect(cells[1], "csv title == on-screen title").toBe(rowTitle);
    expect(cells[2], "csv status == row badge == preview status").toBe(statusBadge);
    expect(cells[2]).toBe(pvStatus);
    expect(cells[3], "csv risk == preview risk (detail badge same source)").toBe(pvRisk);
    expect(cells[4], "csv updated_at == detail decided minute").toBe(dtDecided);
    // R107 追加列：correlation=审批单号（apd9 审计 resource 同源）、
    // rid=服务端请求编号（与详情 apd5-request-id 逐字相等）。
    expect(cells[5], "csv correlation == approval id (apd9 resource)").toBe("ap_q120");
    expect(cells[6], "csv rid == detail rid").toBe("req-q120");
  });
});
