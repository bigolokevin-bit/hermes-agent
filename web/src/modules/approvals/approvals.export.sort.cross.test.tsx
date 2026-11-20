// @vitest-environment jsdom
/**
 * R248 — 审批导出跨页与排序交叉（纯测试，零产品改动，gap-only）。
 *
 * 已覆盖只回证据，不写重复用例：
 * ③ 风险人话列 = approvals.export.status.columns.test.tsx it L157
 *   （rejected 站：CSV risk 列==riskView 单点==预览 dd、缺值「未标注
 *   风险」人话非空字段、全文不落枚举原词）+ R231 it L157（desc 站缺
 *   值行同句）。本文件在 approved 深链两站顺带复锁同行现状。
 * ① 的 desc 三载体逐位 = approvals.export.order.test.tsx（R231）；
 *   asc 方向此前只锁两载体（export.filter it②：CSV 首行==屏上首行，
 *   无 apr-row-copy 逐位、无首/次行成对、无三值+risk 同帧）——
 *   本文件 it① = asc 站三路（CSV 首/次行==屏上==apr-row-copy-0/1）
 *   + 三值 + 缺 risk 行现状，为缺口站。
 * ② 「从 asc 现场切到 desc 再导出」此前从未锁：R231/R182 都是深链
 *   独立站（进页面就是目标方向），从未测排序钮切换动作本身与切换后
 *   重导出的序列反转关系。本文件 it② = 切换动作链：asc 首导出记序
 *   → 点 apv-sort-title（asc→desc 循环，R71）→ 列表腿计数不变
 *   （本地维零请求）+ 行集不变 → 再导出序列==前序反转 + 导出零取数。
 *
 * 现场事实：asort/adir 为本地维、从不进请求（R71/R186 契约）；
 * aria-sort 在排序钮自身（QueueSortBar，approvals 域）；localeCompare
 * 拼音序教训在案——ASCII 标题（Alpha/Beta/Gamma）使期望序无歧义。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

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
import { riskView } from "@/modules/approvals/model";

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

async function render(entry: string): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{<ApprovalsHistoryModulePage />}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
let urlsAll: string[] = [];
const listCalls = () => urlsAll.filter((u) => u.includes("/api/approvals"));

// ASCII 标题：asc 期望序 = Alpha, Beta, Gamma。
const X1 = {
  approvalId: "ap_xr1",
  title: "Alpha release",
  status: "approved",
  riskLevel: "high",
  requestId: "req-xr-11112222",
  createdAt: "2026-11-18T01:00:00Z",
  decidedAt: "2026-11-19T02:00:00Z",
};
// 缺 risk 主角（③ 顺带复锁行）。
const X2 = {
  approvalId: "ap_xr2",
  title: "Beta rotation",
  status: "approved",
  requestId: "req-xr-22223333",
  createdAt: "2026-11-18T02:00:00Z",
  decidedAt: "2026-11-19T03:00:00Z",
};
const X3 = {
  approvalId: "ap_xr3",
  title: "Gamma budget",
  status: "approved",
  riskLevel: "low",
  requestId: "req-xr-33334444",
  createdAt: "2026-11-18T03:00:00Z",
  decidedAt: "2026-11-19T04:00:00Z",
};

function serve() {
  urlsAll = [];
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urlsAll.push(u);
    if (u.includes("/api/approval?id=")) return {};
    if (u.includes("/api/approvals")) return { items: [X1, X2, X3] };
    return {};
  });
}

const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap"]'))
    .map((el) => String(el.getAttribute("data-testid")).replace("apr5-row-", ""))
    .filter((id) => !id.startsWith("details-"));

const ASC = "/approvals?tab=history&status=approved&asort=title&adir=asc";

describe("R248 ① asc 站三路逐位 + 三值 + 缺 risk 现状", () => {
  it("CSV 首/次行 == 屏上首/次行 == apr-row-copy-0/1 首段，行数三值一致，risk 列人话不落原词", async () => {
    serve();
    await render(ASC);
    await waitFor(() => rowIds().length === 3, "asc station shows three rows");

    expect(listCalls(), "首取只 1 条列表腿").toHaveLength(1);
    expect(listCalls()[0]).toContain("status=approved");
    expect(listCalls()[0], "排序参不进请求").not.toMatch(/asort=|adir=/);

    const sortBtn = q("apv-sort-title") as HTMLButtonElement | null;
    expect(sortBtn, "title sort button").toBeTruthy();
    expect(sortBtn!.getAttribute("aria-sort"), "asc 回填").toBe("ascending");

    const order = rowIds();
    expect(order, "屏上行序=asc").toEqual(["ap_xr1", "ap_xr2", "ap_xr3"]);

    // 三值同源。
    expect(q("apv5-count")?.textContent, "apv5-count==表体").toBe("3");
    expect(q("apv7-export-count")?.textContent).toContain("共 3 行");

    // 第三路：apr-row-copy-0/1/2 首段逐位 == 屏上。
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
    for (let i = 0; i < 3; i += 1) {
      const btn = q(`apr-row-copy-${i}`) as HTMLButtonElement | null;
      expect(btn, `row copy button ${i}`).toBeTruthy();
      await act(async () => {
        btn!.click();
      });
    }
    expect(written).toHaveLength(3);
    written.forEach((line, i) => {
      expect(line.startsWith(`单号：${order[i]}`), `copy ${i} 首段==屏上第 ${i} 行`).toBe(true);
    });
    expect(written[0], "首行成对").toContain("单号：ap_xr1");
    expect(written[1], "次行成对").toContain("单号：ap_xr2");
    expect(mock.mock.calls.length, "复制零取数").toBe(callsBeforeCopy);

    // 第一路 + ③ 现状：CSV 首/次行 id 逐位；risk 列人话（缺值=未标注风险）。
    const captured: Blob[] = [];
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:appr248a";
    }) as typeof URL.createObjectURL;
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const callsBeforeExport = mock.mock.calls.length;
    try {
      const btn = q("apv7-export") as HTMLButtonElement | null;
      expect(btn, "export button").toBeTruthy();
      await act(async () => {
        btn!.click();
      });
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(captured).toHaveLength(1);
    const lines = (await captured[0].text())
      .replace(/^\uFEFF/, "")
      .split("\r\n")
      .filter((line) => line !== "");
    expect(lines[0]).toBe("id,title,status,risk,updated_at,correlation,rid");
    const dataRows = lines.slice(1).map((line) => line.split(","));
    expect(dataRows).toHaveLength(3);
    expect(dataRows[0][0], "CSV 首行==屏上首行").toBe("ap_xr1");
    expect(dataRows[1][0], "CSV 次行==屏上次行").toBe("ap_xr2");
    expect(dataRows[2][0]).toBe("ap_xr3");
    // ③ 顺带复锁（主证据=R247 L157/R231 L246）：risk 列人话、原词不落。
    expect(dataRows[0][3], "high 行人话").toBe(riskView("high").label);
    expect(dataRows[1][3], "缺 risk 行人话非空字段（R107 现状）").toBe(riskView(null).label);
    expect(dataRows[2][3], "low 行人话").toBe(riskView("low").label);
    expect(lines.join("\n"), "CSV 全文不落枚举原词").not.toMatch(
      /\b(low|medium|high|critical)\b/,
    );
    expect(lines.join("\n"), "status 列非原词复锁").not.toMatch(/\b(approved|rejected)\b/);
    expect(mock.mock.calls.length, "导出零取数").toBe(callsBeforeExport);
  });
});

describe("R248 ② 排序切换动作链：desc 重导出序列反转、行集不变、全程零取数", () => {
  it("clicking the title sort flips asc→desc with no refetch, and the re-exported CSV reverses the order", async () => {
    serve();
    await render(ASC);
    await waitFor(() => rowIds().length === 3, "asc station shows three rows");

    const orderAsc = rowIds();
    expect(orderAsc).toEqual(["ap_xr1", "ap_xr2", "ap_xr3"]);

    // 先导出一次记录 asc 序。
    const grabIds = async (tag: string): Promise<string[]> => {
      const captured: Blob[] = [];
      const orig = URL.createObjectURL;
      URL.createObjectURL = ((blob: Blob) => {
        captured.push(blob);
        return `blob:${tag}`;
      }) as typeof URL.createObjectURL;
      const clicks = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => undefined);
      try {
        const btn = q("apv7-export") as HTMLButtonElement | null;
        expect(btn, "export button").toBeTruthy();
        await act(async () => {
          btn!.click();
        });
      } finally {
        URL.createObjectURL = orig;
        clicks.mockRestore();
      }
      expect(captured, "导出产生真实 Blob").toHaveLength(1);
      const rows = (await captured[0].text())
        .replace(/^\uFEFF/, "")
        .split("\r\n")
        .filter((line) => line !== "")
        .slice(1);
      return rows.map((line) => line.split(",")[0]);
    };

    const callsBefore = mock.mock.calls.length;
    const idsAsc = await grabIds("blob:appr248b1");
    expect(idsAsc).toEqual(orderAsc);
    expect(mock.mock.calls.length, "第一次导出零取数").toBe(callsBefore);

    // 切换动作：asc → desc（R71 三态循环第一步），列表腿绝不重取。
    const sortBtn = q("apv-sort-title") as HTMLButtonElement | null;
    expect(sortBtn, "title sort button").toBeTruthy();
    await act(async () => {
      sortBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await waitFor(
      () => q("apv-sort-title")?.getAttribute("aria-sort") === "descending",
      "aria-sort flips to descending",
    );
    expect(listCalls(), "切排序零请求（本地维）").toHaveLength(1);
    expect(mock.mock.calls.length, "切换动作零取数").toBe(callsBefore);

    // 行集不变（仅顺序翻转）。
    const orderDesc = rowIds();
    expect([...orderDesc].sort()).toEqual([...orderAsc].sort());
    expect(orderDesc).toEqual([...orderAsc].reverse());

    // 再导出：序列==前序反转、行数三值不变、导出零取数。
    const idsDesc = await grabIds("blob:appr248b2");
    expect(idsDesc, "desc 重导出==asc 序列反转").toEqual([...idsAsc].reverse());
    expect(q("apv5-count")?.textContent, "切换后计数仍 3").toBe("3");
    expect(q("apv7-export-count")?.textContent).toContain("共 3 行");
    expect(mock.mock.calls.length, "第二次导出仍零取数").toBe(callsBefore);
  });
});
