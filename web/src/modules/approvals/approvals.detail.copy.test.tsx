// @vitest-environment jsdom
/**
 * R162 — 审批详情抽屉与行复制同源护栏（纯测试，零产品改动）。
 *
 * 现场裁决（禁臆造）：详情抽屉=右侧 aside（apr5-detail）与列表并排，
 * apr-row-copy-<i> 挂在行卡内、与抽屉同屏共存——「抽屉内复制」的现场形态
=
 * 详情打开态下同一行的钮文本与列表态逐字相等（用例①锁此）。单号段 ap_ 上屏
 * 是 R127 六段契约的既有形态，本单按现状注记（工单「裸内部 id」指 requestId
 * 全串不得出现在文本里，用例③锁）。
 *
 * 已覆盖只回证据，不写重复用例：R127（apr-row-copy 六段文本+零请求+排序同序+
 * 剪贴板拒兜底）、R120（行/预览/详情 title/状态/rid 逐字矩阵+详情腿恰 1）、
 * R99/R123（缺值句单点 stateCopy）。
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

const C1 = {
  approvalId: "ap_c12",
  title: "季度预算复议",
  status: "approved",
  riskLevel: "high",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-c1-87654321",
  reasonText: "护栏理由",
  createdAt: isoAgo(3 * HOUR),
  decidedAt: isoAgo(1 * HOUR),
};
const C2 = {
  approvalId: "ap_c13",
  title: "密钥轮换",
  status: "pending",
  approvers: [{ userId: "human:9", name: "阿朝" }],
  createdAt: isoAgo(2 * HOUR),
  // 故意无 riskLevel / requestId / decidedAt —— 缺字段六段分支。
};

/** 列表行=详情读口=同一 body（两读口同真值，禁两副面孔）。 */
function serve(rows: unknown[]) {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = (rows as { approvalId?: string }[]).find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) return { items: rows };
    return {};
  });
}

const openDetail = async (id: string) => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

const clickCopy = async (index: number): Promise<void> => {
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `apr-row-copy-${index}`).toBeTruthy();
  await act(async () => {
    btn!.click();
  });
  await waitFor(() => true, "copy click settled");
};

const ariaTitle = (index: number): string => {
  const btn = q(`apr-row-copy-${index}`) as HTMLButtonElement | null;
  expect(btn, `copy button ${index}`).toBeTruthy();
  return btn!.getAttribute("aria-label") ?? "";
};

describe("R162 apr-row-copy text equals the row everywhere the drawer state is", () => {
  it("the six segments are the row's own fields, and stay byte-equal with the drawer open", async () => {
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
    serve([C1, C2]);
    await render();

    await clickCopy(0);
    expect(written).toHaveLength(1);
    const lines = written[0].split("\n");
    expect(lines).toHaveLength(6);
    expect(lines[0], "单号段=R127 六段契约（ap_ 前缀为既有形态）").toBe("单号：ap_c12");
    expect(lines[1]).toBe("标题：季度预算复议");
    expect(lines[2].startsWith("状态：")).toBe(true);
    expect(lines[2].slice("状态：".length).trim().length, "状态人话非空").toBeGreaterThan(0);
    expect(lines[3].startsWith("风险：")).toBe(true);
    expect(lines[4].startsWith("更新时间：")).toBe(true);
    expect(lines[5], "短码=requestId 后 8 位，全串不进文本").toBe("短码：87654321");
    expect(written[0]).not.toContain("req-c1-87654321");

    const listText = written[0];
    await openDetail(C1.approvalId);
    await clickCopy(0);
    expect(written).toHaveLength(2);
    expect(written[1], "抽屉打开态的行钮文本与列表态逐字相等").toBe(listText);
  });

  it("copying with the drawer open triggers no extra request", async () => {
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
    serve([C1, C2]);
    await render();
    await openDetail(C1.approvalId);
    const before = mock.mock.calls.length;
    await clickCopy(0);
    expect(written).toHaveLength(1);
    expect(mock.mock.calls.length, "复制零请求（详情腿在开抽屉时已计）").toBe(before);
  });

  it("a row missing risk/decided/requestId keeps the same gap words as the list and never leaks ids", async () => {
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
    serve([C1, C2]);
    await render();
    await openDetail(C2.approvalId);
    await clickCopy(1);
    expect(written).toHaveLength(1);
    const text = written[0];
    const lines = text.split("\n");
    expect(lines[0], "抽屉打开态下 C2 仍是同一 requestId 行").toBe("单号：ap_c13");
    expect(lines[1]).toBe("标题：密钥轮换");
    expect(lines[4], "更新时间缺值=与列表同句 —").toBe("更新时间：—");
    expect(lines[5], "短码缺值=—").toBe("短码：—");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
    expect(text).not.toContain("req-");
    // 风险段仍逐字存在（缺 riskLevel=未标注风险 单点词，非空段）。
    expect(lines[3].startsWith("风险：")).toBe(true);
    expect(lines[3].length, "风险段非空").toBeGreaterThan("风险：".length);
  });

  it("after a sort switch the button at index i still copies the row displayed at index i", async () => {
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
    serve([C1, C2]);
    await render();

    const sort = q("apv-sort-title") as HTMLButtonElement | null;
    expect(sort, "sort control").toBeTruthy();
    await act(async () => {
      sort!.click(); // asc：密钥轮换 vs 季度预算复议（localeCompare zh）
    });
    await waitFor(() => !document.querySelector(".animate-pulse"), "sort applied");
    const ascLabel = ariaTitle(0);
    await clickCopy(0);
    const ascText = written[written.length - 1];
    expect(ascText.split("\n")[1], "钮与行数据不串（asc）").toStrictEqual(`标题：${ascLabel.slice("复制".length, ascLabel.length - "这一行".length)}`);

    await act(async () => {
      sort!.click(); // desc
    });
    await waitFor(() => !document.querySelector(".animate-pulse"), "sort desc applied");
    const descLabel = ariaTitle(0);
    await clickCopy(0);
    const descText = written[written.length - 1];
    expect(descText.split("\n")[1], "钮与行数据不串（desc）").toStrictEqual(`标题：${descLabel.slice("复制".length, descLabel.length - "这一行".length)}`);
    expect(ascText, "两个方向的第 0 行确实换了数据").not.toBe(descText);
  });
});
