// @vitest-environment jsdom
/**
 * R207 — 审批详情与导出字段完整性护栏（纯测试，零产品改动）。
 *
 * 现场裁决（禁臆造，按载体实存映射——R168/R182 先例）：
 * ①「决策人/决策时间/备注在四处逐字」：列表行卡与 apr-row-copy 六段
 *   （R127 契约：单号/标题/状态/风险/更新时间/短码）以及 CSV 七列
 *   （R107/R182 契约：id,title,status,risk,updated_at,correlation,rid）
 *   都不含决策人/备注字段——「四处」现场收敛为抽屉内的两副载体：
 *   apd6-step-node-<i> DOM 文本 vs apd8-copy 链路文本（trailToText），
 *   决策人/结论/意见三段逐字；决策时间两载体各有口径（DOM=相对词+
 *   title 绝对句，链路=绝对到分），用 title 前缀逐字对上（R168 同款）。
 *   缺备注两载体同为「未填」；who 缺名走 maskHandle 人话，原始
 *   human: 柄只进 title 不上屏。
 * ②同一单连开两次抽屉：现场无缓存——useApprovalDetail 每次 id 复位
 *   重新 fetchDetail，故每次打开恰 1 条 ?id= 请求（两次共 2），关闭
 *   （apd7-back）零请求、行序不变、字段不串。
 * ③详情 500：drawer 走 apr5-detail-error 卡（title=这条记录没能加载
 *   出来），rid 载体 apr5-request-id + 复制钮回环，列表行保留，重试
 *   （apr5-detail-error-retry=detail.reload）恰 +1 且成功回填。
 * ④?status=approved 导出三值+status 列人话——已覆盖只回证据，不写
 *   重复用例：approvals.export.filter.test.tsx L194（R182 it①：CSV 行
 *   ==表体==apv5-count、status 列==屏上 label 逐字）与
 *   approvals.decision.parity.test.tsx L347（R168 ④：count==rows==
 *   export count 同链）。
 *
 * 其余已覆盖证据：R120（详情腿恰 1/关闭行序 URL 保持/行-预览-详情
 * title/状态/rid 矩阵）、R162（apr-row-copy 抽屉开态逐字+零请求）、
 * R123/R99（缺值句 stateCopy 单点）、R168 ②（缺值三形态不互冒充）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

import { ApiError } from "@/lib/api-error";

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

const HOUR = 3_600_000;
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

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

const render = (entry = "/approvals?tab=history") =>
  renderInto(entry, <ApprovalsHistoryModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const text = (id: string): string => q(id)?.textContent ?? "";

const urls = (): string[] => mock.mock.calls.map((call) => String(call[0]));
const listCalls = (): number => urls().filter((u) => u.includes("/api/approvals?")).length;
const detailCalls = (id?: string): number =>
  urls().filter((u) => u.includes("/api/approval?id=") && (id === undefined || u.includes(id))).length;

const F1 = {
  approvalId: "ap_f1",
  title: "轮换生产密钥",
  status: "approved",
  riskLevel: "high",
  requestedBy: { type: "human", id: "human:9" },
  approvers: [
    { userId: "human:7", name: "郑涛" },
    { userId: "human:8", name: "阿朝" },
  ],
  decisions: [
    { userId: "human:7", name: "郑涛", verdict: "approve", decidedAt: "2026-11-19T01:50:00Z", comment: "可以，按计划执行" },
    { userId: "human:8", verdict: "approve", decidedAt: "2026-11-19T01:55:00Z" },
  ],
  createdAt: isoAgo(3 * HOUR),
  decidedAt: isoAgo(1 * HOUR),
  requestId: "req-f1-1",
};

const F3 = {
  approvalId: "ap_f3",
  title: "渠道发布窗口",
  status: "approved",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  decisions: [],
  createdAt: isoAgo(5 * HOUR),
  decidedAt: isoAgo(2 * HOUR),
  requestId: "req-f3-3",
};

/** 列表腿与详情腿回同一 body（两读口同真值）。detailFails=前 n 次详情腿 500。 */
function serve(rows: unknown[], detailFails = 0) {
  let failsLeft = detailFails;
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      if (failsLeft > 0) {
        failsLeft -= 1;
        throw new ApiError("boom", {
          status: 500,
          body: JSON.stringify({ message: "上游暂时没有响应" }),
          url: u,
          requestId: "req-apv-detail",
        });
      }
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = (rows as { approvalId?: string }[]).find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) return { items: rows };
    return {};
  });
}

const openRow = async (id: string) => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
};

const openDetail = async (id: string) => {
  await openRow(id);
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

function stubClipboard(written: string[], reject = false): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (value: string) =>
        reject ? Promise.reject(new Error("denied")) : (written.push(value), Promise.resolve()),
    },
  });
}

/** 抓一次导出的 CSV 文本行（拦 Blob+download；finally 还原）。 */
async function grabCsvLines(): Promise<string[]> {
  const captured: Blob[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (blob: Blob) => {
    captured.push(blob);
    return "blob:captured";
  };
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  try {
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export button").toBeTruthy();
    expect(btn!.disabled, "export enabled").toBe(false);
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => true, "export click settled");
  } finally {
    clicks.mockRestore();
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = originalCreate;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = originalRevoke;
  }
  expect(captured.length, "one blob").toBe(1);
  const body = await captured[0].text();
  return body.split("\r\n").filter((line) => line !== "");
}

/** 「A · B · C」串按 · 拆段（DOM 与链路文本共用）。 */
const segs = (line: string): string[] =>
  line
    .split(" · ")
    .map((s) => s.trim())
    .filter((s) => s !== "");

describe("R207 ① decision maker / verdict / note read the same across drawer carriers", () => {
  it("node DOM and apd8 trail text are byte-equal on who, verdict and note; the minute lines up via the title", async () => {
    serve([F1]);
    const written: string[] = [];
    stubClipboard(written);
    await render();
    await openDetail("ap_f1");

    const node0 = text("apd6-step-node-0");
    const node1 = text("apd6-step-node-1");
    expect(node0, "node 0 rendered").not.toBe("");
    expect(node1, "node 1 rendered").not.toBe("");

    const callsBefore = mock.mock.calls.length;
    const copyBtn = q("apd8-copy") as HTMLButtonElement | null;
    expect(copyBtn, "trail copy button").toBeTruthy();
    await act(async () => {
      copyBtn!.click();
    });
    await waitFor(() => text("apd8-copy-status").includes("已复制"), "trail copied");
    expect(mock.mock.calls.length, "copying the trail asks for nothing").toBe(callsBefore);

    const trailLines = written[written.length - 1].split("\n");
    const t0 = trailLines.find((l) => l.startsWith("节点 1 · "));
    const t1 = trailLines.find((l) => l.startsWith("节点 2 · "));
    expect(t0, "trail has node 1").toBeTruthy();
    expect(t1, "trail has node 2").toBeTruthy();

    const d0 = segs(node0);
    const s0 = segs(t0!);
    // 决策人 / 结论 / 意见三段逐字；时间两载体各有口径，用 title 对链路列。
    expect(d0[1]).toBe(s0[1]);
    expect(d0[1]).toBe("郑涛");
    expect(d0[2]).toBe(s0[2]);
    expect(d0[4]).toBe(s0[4]);
    expect(d0[4]).toBe("意见：可以，按计划执行");
    const nodeTitle = q("apd6-step-node-0")?.getAttribute("title") ?? "";
    expect(nodeTitle, "raw handle rides the title only").toContain("human:7");
    const titleMinute = (q("apv-time-detail-node-0")?.getAttribute("title") ?? "").slice(3, 19);
    expect(s0[3], `trail minute ${s0[3]} vs title ${titleMinute}`).toBe(titleMinute);
    expect(titleMinute).toBe("2026-11-19 09:50");

    // 缺备注：两载体同为「未填」；无名 who 落人话、原柄不上屏。
    const d1 = segs(node1);
    const s1 = segs(t1!);
    expect(d1[4]).toBe(s1[4]);
    expect(d1[4]).toBe("意见：未填");
    expect(d1[1]).toBe(s1[1]);
    expect(node1).not.toContain("human:");

    // 缺位现状注记：apr-row-copy 六段与 CSV 七列契约都不含决策人/备注。
    const rowWritten = written.length;
    const rowBtn = q("apr-row-copy-0") as HTMLButtonElement | null;
    expect(rowBtn, "row copy button").toBeTruthy();
    await act(async () => {
      rowBtn!.click();
    });
    await waitFor(() => written.length > rowWritten, "row copied");
    expect(written[written.length - 1]).not.toContain("意见：");
    expect(written[written.length - 1]).toContain(`标题：${F1.title}`);

    const csvLines = await grabCsvLines();
    expect(csvLines[0]).toBe("id,title,status,risk,updated_at,correlation,rid");
    expect(csvLines[0]).not.toMatch(/decided_by|comment|note/);
    expect(mock.mock.calls.length, "copy and export asked for nothing").toBe(callsBefore);
  });

  it("a pending approver keeps 未填 on both carriers with no fabricated time", async () => {
    serve([F3]);
    const written: string[] = [];
    stubClipboard(written);
    await render();
    await openDetail("ap_f3");
    expect(q("apd6-step-nodes-none"), "no acted nodes").toBeTruthy();
    const callsBefore = mock.mock.calls.length;
    const copyBtn = q("apd8-copy") as HTMLButtonElement | null;
    await act(async () => {
      copyBtn!.click();
    });
    await waitFor(() => text("apd8-copy-status").includes("已复制"), "trail copied");
    const trail = written[written.length - 1];
    expect(trail).toContain("审批节点 · 该段无记录");
    const pendingLine = q("apd6-step-pending-0");
    expect(pendingLine?.textContent ?? "").toContain("意见：未填");
    expect(trail).toContain("郑涛 · 待办 · 该段无记录 · 意见：未填");
    expect(mock.mock.calls.length).toBe(callsBefore);
  });
});

describe("R207 ② opening the same ticket twice", () => {
  it("each open fetches its own detail exactly once; closing asks for nothing and the rows keep their order", async () => {
    serve([F1]);
    await render();
    await openDetail("ap_f1");
    expect(detailCalls("ap_f1"), "first open = one detail read").toBe(1);
    const order1 = Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_f"]')).map(
      (el) => el.getAttribute("data-testid"),
    );
    expect(text("apr5-detail")).toContain("轮换生产密钥");
    expect(text("apr5-detail")).toContain("req-f1-1");

    const afterFirst = mock.mock.calls.length;
    const back = q("apd7-back") as HTMLElement | null;
    expect(back, "back to list button").toBeTruthy();
    await act(async () => {
      back!.click();
    });
    await waitFor(() => !q("apr5-detail"), "drawer closed");
    expect(mock.mock.calls.length, "closing fetched nothing").toBe(afterFirst);
    expect(detailCalls("ap_f1"), "closing fetched no detail").toBe(1);

    await openDetail("ap_f1");
    expect(detailCalls("ap_f1"), "second open = one more detail read").toBe(2);
    // 字段不串：抽屉还是同一单的同一标题与请求编号，行序一字不变。
    expect(text("apr5-detail")).toContain("轮换生产密钥");
    expect(text("apr5-detail")).toContain("req-f1-1");
    const order2 = Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_f"]')).map(
      (el) => el.getAttribute("data-testid"),
    );
    expect(order2).toEqual(order1);
    expect(listCalls(), "the list leg was never refetched").toBe(1);
  });
});

describe("R207 ③ a 500 on the detail leg", () => {
  it("shows a plain sentence with a copyable rid, keeps the rows, and retries exactly once", async () => {
    serve([F3], 1);
    const written: string[] = [];
    stubClipboard(written);
    await render();
    await openRow("ap_f3");
    await waitFor(() => !!q("apr5-detail-error"), "detail error panel");

    const card = q("apr5-detail-error") as HTMLElement;
    expect(card.textContent ?? "", card.textContent ?? "").toContain("这条记录没能加载出来");
    expect(text("apv-state-rid")).toContain("req-apv-detail");
    // 列表行保留：错误只发生在详情腿。
    expect(q("apr5-row-ap_f3"), "row still on screen").toBeTruthy();
    const listBefore = listCalls();

    const copyRid = q("apr5-copy-request-id") as HTMLButtonElement | null;
    expect(copyRid, "rid copy button").toBeTruthy();
    await act(async () => {
      copyRid!.click();
    });
    await waitFor(() => !!q("apr5-copy-state"), "copied feedback");
    expect(text("apr5-copy-state")).toContain("已复制");
    expect(written[written.length - 1]).toBe("req-apv-detail");

    const callsBefore = mock.mock.calls.length;
    const retry = q("apr5-detail-error-retry") as HTMLButtonElement | null;
    expect(retry, "retry button").toBeTruthy();
    await act(async () => {
      retry!.click();
    });
    await waitFor(() => !!q("apr5-detail"), "detail opened after retry");
    expect(mock.mock.calls.length, "retry is exactly one more read").toBe(callsBefore + 1);
    expect(detailCalls("ap_f3"), "two detail reads in total").toBe(2);
    expect(listCalls(), "the list leg never re-ran").toBe(listBefore);
    expect(text("apr5-detail")).toContain("渠道发布窗口");
    expect(q("apr5-detail-error"), "error carrier gone").toBeNull();
  });
});
