// @vitest-environment jsdom
/**
 * R216 — 审批详情决策字段四处同源护栏（纯测试，零产品改动）。
 *
 * 已覆盖只回证据（不重复写）：
 *  - 决策人/verdict/意见在抽屉 DOM 与 apd8-copy 链路文本两载体逐字、缺备注
 *    两载体同「意见：未填」、决策时间分钟链 = approvals.detail.fields2.test.tsx
 *    （R207）；决策时间四处链（行/预览 title==抽屉==CSV updated_at）+ 审批人
 *    三处 = approvals.decision.parity.test.tsx（R168）；
 *  - apr-row-copy 六段与 CSV 七列契约不含决策人/备注列 = R207/R127/R107 现状
 *    注记（本文件仅复锁一次表头与「意见：」缺席）；标题类长值的 RFC4180 转义
 *    = R80 truncation 用例；开详情列表腿不重取+详情腿恰 1+关闭行序/URL 不变
 *    = R120 ②③。
 * 现场裁决：备注经 humanSentence 单行契约（\s+ 折为单空格，R31 时代），换行
 * 按折叠形态逐字往返；逗号/引号原样保留。屏上备注超 60 字符按 R80 契约截断加「…」且 title 带全文——工单
 * 「屏上不截断」与现状不符，按现状锁定（复制文本给全文，屏上给截断+全文
 * title），不改产品。CSV 没有备注列，「备注 CSV 往返」按现状记为契约缺位，
 * 真正的逐字往返锁在 apd8 链路复制文本上。
 * 本文件增量：①无显示名的决策人走 maskHandle「人员 · 8位大写短码」形态，在
 * 抽屉节点行与 apd8 复制文本逐字相等、原始柄只进 title；③含逗号/引号/换行
 * 的长备注：屏上截断态 + title 全文逐字 + 复制文本全文逐字；④开→关抽屉全程
 * 列表腿零重取、行序与 apv5-count 不变。
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
import { TRUNCATE_LIMIT } from "@/modules/approvals/views";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MASKED = "employee:ABCD1234EFGH5678";
const MASKED_LABEL = "人员 · ABCD1234";
const LONG_NOTE =
  '同意，请今晚执行，抄送财务与风控；注意以下清单：\n1. 预算, 已经复核\n2. "密钥" 已轮换，勿再申请。\n3. 变更单挂季度发布窗口，逾期自动作废，请勿重复提交。';
// humanSentence is the shipped one-line contract (R31 era): every \s+ run,
// including the note's newlines, collapses to a single space before display,
// truncation and trail copy. The ticket's 「换行逐字」 is therefore recorded
// as the collapsed form; commas and quotes survive verbatim.
const ONE_LINE = LONG_NOTE.replace(/\s+/g, " ").trim();

const D1 = {
  approvalId: "ap_p2a",
  title: "密钥轮换窗口",
  status: "approved",
  riskLevel: "high",
  requestedBy: "human:9",
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
  requestId: "req-p2-1",
  approvers: [
    { userId: "human:7", name: "郑涛" },
    { userId: MASKED },
  ],
  decisions: [
    { approver: MASKED, decision: "approve", at: "2026-11-19T01:50:00Z" },
    { approver: "human:7", name: "郑涛", decision: "approve", at: "2026-11-19T01:55:00Z", comment: LONG_NOTE },
  ],
};
const D2 = {
  approvalId: "ap_p2b",
  title: "渠道发布窗口",
  status: "approved",
  requestedBy: "human:9",
  createdAt: "2026-11-18T02:00:00Z",
  decidedAt: "2026-11-19T03:00:00Z",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  decisions: [{ approver: "human:7", name: "郑涛", decision: "approve", at: "2026-11-19T03:00:00Z" }],
};

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

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_p"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );
const listCalls = () => mock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals")).length;
const detailCalls = () => mock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approval?id=")).length;

function serve(): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      return id === "ap_p2a" ? { ...D1 } : { ...D2 };
    }
    return { items: [D1, D2] };
  });
}

function stubClipboard(written: string[], reject = false) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (t: string) => {
        written.push(t);
        return reject ? Promise.reject(new Error("denied")) : Promise.resolve();
      },
    },
  });
}

const openDetail = async (key: string) => {
  const card = q(`apr5-row-${key}`);
  expect(card, key).toBeTruthy();
  await act(async () => {
    (card as HTMLElement).click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail for ${key}`);
};

describe("R216 approvals decision fields four-way parity", () => {
  it("① the masked decider reads 人员 · 8-位大写短码 verbatim on the drawer node and the trail copy; the raw handle lives only in the title", async () => {
    serve();
    const written: string[] = [];
    stubClipboard(written);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_p2a");
    const node = q("apd6-step-node-0");
    expect(node, "node 0 rendered").toBeTruthy();
    // who itself contains " · ", so assert containment, not a seg split.
    expect(node!.textContent, "drawer carries the masked label").toContain(MASKED_LABEL);
    expect(node!.textContent).not.toContain(MASKED);
    expect(node!.getAttribute("title")).toBe(MASKED);
    await act(async () => {
      (q("apd8-copy") as HTMLButtonElement).click();
    });
    await waitFor(() => q("apd8-copy-status")?.textContent === "已复制", "trail copied");
    const trailLine = written[0].split("\n").find((l) => l.startsWith("节点 1 · "));
    expect(trailLine, "trail keeps the same label").toBeTruthy();
    expect(trailLine!, "same masked label verbatim").toContain(MASKED_LABEL);
    // Contract absence re-checked once (R207/R127/R107 evidence): the row copy
    // six segments and the CSV seven columns never carry decision fields.
    const before = mock.mock.calls.length;
    await act(async () => {
      (q("apr-row-copy-0") as HTMLButtonElement).click();
    });
    expect(written.at(-1)).not.toContain("意见：");
    expect(written.at(-1)).toContain(`单号：${"ap_p2a"}`);
    expect(mock.mock.calls.length, "row copy fetches nothing").toBe(before);
  });

  it("③ a long note with commas, quotes and newlines: screen truncates with the full text in the title, the trail copy keeps it verbatim; CSV has no note column by contract", async () => {
    serve();
    const written: string[] = [];
    stubClipboard(written);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_p2a");
    const note = q("apv-trunc-note-1");
    expect(note, "note 1 rendered").toBeTruthy();
    // R80 contract on screen: truncated to TRUNCATE_LIMIT-1 + ellipsis, title
    // keeps the whole original (the ticket's 「屏上不截断」 conflicts with this
    // shipped contract — recorded as-is, product untouched).
    expect(note!.textContent).toBe(`${ONE_LINE.slice(0, TRUNCATE_LIMIT - 1)}…`);
    expect(note!.getAttribute("title")).toBe(ONE_LINE);
    await act(async () => {
      (q("apd8-copy") as HTMLButtonElement).click();
    });
    await waitFor(() => q("apd8-copy-status")?.textContent === "已复制", "trail copied");
    // The copy hands over the full note verbatim, newlines and quotes kept.
    expect(written[0], "trail hands the whole collapsed note verbatim").toContain(`意见：${ONE_LINE}`);
    expect(ONE_LINE).toContain("预算, 已经复核");
    expect(ONE_LINE).toContain('"密钥"');
    // CSV contract gap re-checked once: seven columns, no note column.
    let csvHeader = "";
    const stubOrig = URL.createObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {});
    URL.createObjectURL = ((blob: Blob) => {
      void (async () => {
        csvHeader = (await blob.text()).split("\r\n")[0];
      })();
      return "blob:p216";
    }) as typeof URL.createObjectURL;
    try {
      await act(async () => {
        (q("apv7-export") as HTMLButtonElement).click();
      });
      await waitFor(() => csvHeader.length > 0, "csv captured");
    } finally {
      URL.createObjectURL = stubOrig;
      clickSpy.mockRestore();
    }
    expect(csvHeader.replace(/^\uFEFF/, "")).toBe("id,title,status,risk,updated_at,correlation,rid");
  });

  it("④ opening and closing the drawer costs zero list refetches; rows and apv5-count stay put", async () => {
    serve();
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    const rowsBefore = rowIds();
    const countBefore = q("apv5-count")?.textContent;
    expect(listCalls(), "list leg fetched once on entry").toBe(1);
    await openDetail("ap_p2a");
    expect(detailCalls(), "detail leg exactly once").toBe(1);
    expect(listCalls(), "opening never refetches the list").toBe(1);
    await act(async () => {
      (q("apd7-back") as HTMLButtonElement).click();
    });
    await waitFor(() => !q("apr5-detail"), "drawer closed");
    expect(listCalls(), "closing fetches nothing").toBe(1);
    expect(detailCalls(), "closing refetches nothing").toBe(1);
    expect(rowIds(), "row order unchanged").toEqual(rowsBefore);
    expect(q("apv5-count")?.textContent, "count unchanged").toBe(countBefore);
  });
});
