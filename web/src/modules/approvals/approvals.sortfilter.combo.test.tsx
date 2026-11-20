// @vitest-environment jsdom
/**
 * R199 — 审批排序×筛选组合护栏（纯测试，零产品改动）。
 *
 * 现场裁决（按现状锁定，禁臆造第二套；差异在此点名）：
 * - 工单①的排序参 `sort=/dir=` 非现场参名：现场排序契约=**asort/adir**
 *   且为本地维（不进请求，R186 已锁）；`window=/from=/to=` 在 approvals 域
 *   **零消费**（window=apv5-filter-window 恒 disabled 摆设，from/to 无消费点，
 *   R129/R139 裁决先例）——深链携带时按现状锁「原样保留、不进请求、不改写 URL」。
 * - 工单③的 `aud5-row-count` 是 audit 域载体名；approvals 现场计数位=
 *   **apv5-count**（与表体/apv7-export-count 三值等，R182 同源契约）。
 * - 工单②「叠加顺序不影响行集」现场形态=本地 q/risk 过滤与本地排序可交换
 *   （两条交互顺序的路径得到同一行序）。
 *
 * 已覆盖只回证据，不写重复用例：R186（深链排序×筛选请求参组合+非法 asort
 * 整链）、R182（排序后 CSV 首行同源+导出零请求+三值计数）、R70/R44（非法
 * status 透传+unknown chip 提示+空集出口）、R98（chips==生效参）、
 * R129/R139（window 摆设/游标重置）。本文件增量=四组合面：全参深链的控件
 * 回填矩阵、过滤×排序交换律、筛选后三值计数、非法组合下 URL 保留+清除链回全量。
 */
import { act, useEffect } from "react";
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

const api = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

function Probe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-r199-search", loc.search);
  }, [loc.search]);
  return null;
}

function clearScreen(): void {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
  document.body.removeAttribute("data-r199-search");
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

const page = (entry: string) =>
  renderInto(
    entry,
    <>
      <ApprovalsHistoryModulePage />
      <Probe />
    </>,
  );

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const search = () => document.body.getAttribute("data-r199-search") ?? "";
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="apr5-row-ap_t"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("apr5-row-", ""),
  );
const listUrls = (): string[] =>
  api.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/api/approvals"));

// —— 夹具：risk 与 title 的排序方向刻意互相错开，交换律才测得出来。——
const T1 = {
  approvalId: "ap_t1",
  title: "甲乙丙",
  status: "pending",
  riskLevel: "low",
  approvers: [{ userId: "human:7", name: "郑涛" }],
  requestId: "req-t1-11111111",
  createdAt: "2026-11-19T02:00:00Z",
  decidedAt: "2026-11-19T03:00:00Z",
};
const T2 = {
  approvalId: "ap_t2",
  title: "预算追加",
  status: "pending",
  riskLevel: "critical",
  approvers: [{ userId: "human:8", name: "阿朝" }],
  requestId: "req-t2-22222222",
  createdAt: "2026-11-18T02:00:00Z",
  decidedAt: "2026-11-18T04:00:00Z",
};
const T3 = {
  approvalId: "ap_t3",
  title: "预算复核",
  status: "rejected",
  riskLevel: "high",
  approvers: [{ userId: "human:9", name: "阿象" }],
  requestId: "req-t3-33333333",
  createdAt: "2026-11-17T02:00:00Z",
  decidedAt: "2026-11-17T05:00:00Z",
};
const ALL = [T1, T2, T3];

/** 服务端只认 status（R44 白名单）；其它参数由前端各维自行处理。 */
function serve(): void {
  api.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("status=pending")) return { items: [T1, T2] };
    if (u.includes("status=")) return { items: [] }; // 未知/其它枚举：上游空集（R44 现状）
    return { items: ALL };
  });
}

const setInput = async (id: string, value: string): Promise<void> => {
  const input = q(id) as HTMLInputElement | null;
  expect(input, id).toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `set ${id}`);
};

describe("R199 sort × filter combination guards", () => {
  it("① a full-parameter deep link backfills every control and leaks nothing into the request", async () => {
    serve();
    await page(
      "/approvals?tab=history&window=custom&from=2026-11-18T00%3A00%3A00Z&to=2026-11-19T00%3A00%3A00Z&status=pending&asort=risk&adir=desc&q=%E9%A2%84%E7%AE%97",
    );
    // 服务端维进请求；本地/未消费维不进请求（R186/R129 契约的集中复锁）。
    const last = listUrls().at(-1) ?? "";
    expect(last, "status rides the request verbatim").toContain("status=pending");
    expect(last).not.toContain("window=");
    expect(last).not.toContain("from=");
    expect(last).not.toContain("to=");
    expect(last).not.toContain("q=");
    expect(last).not.toContain("keyword=");
    expect(last).not.toContain("asort=");
    expect(last).not.toContain("adir=");
    // 控件回填：搜索框=关键词；状态快捷钮=pending 高亮；风险排序=descending。
    expect((q("apv8-search") as HTMLInputElement | null)?.value).toBe("预算");
    expect(q("apv5-filter-status-pending")?.getAttribute("aria-pressed")).toBe("true");
    expect(q("apv-sort-risk")?.getAttribute("aria-sort")).toBe("descending");
    // 行集=服务端 pending 腿 ∩ 本地 q「预算」（T2/T1 中只有 T2 命中标题）。
    expect(rowIds(), "本地 q 过滤叠加服务端 status").toEqual(["ap_t2"]);
    // URL 原样保留，未被改写（window/from/to 等未消费参仍在）。
    expect(search()).toContain("window=custom");
    expect(search()).toContain("from=2026-11-18T00%3A00%3A00Z");
    expect(search()).toContain("status=pending");
    expect(search()).toContain("asort=risk");
  });

  it("② filtering then sorting lands on the same rows as sorting then filtering", async () => {
    serve();
    // 路径 A：先本地过滤（q），再点风险排序（desc）。
    await page("/approvals?tab=history");
    await setInput("apv8-search", "预算");
    const riskA = q("apv-sort-risk") as HTMLButtonElement | null;
    expect(riskA, "risk sort").toBeTruthy();
    await act(async () => {
      riskA!.click(); // asc
    });
    await waitFor(() => q("apv-sort-risk")?.getAttribute("aria-sort") === "ascending", "asc applied");
    await act(async () => {
      riskA!.click(); // desc
    });
    await waitFor(() => q("apv-sort-risk")?.getAttribute("aria-sort") === "descending", "desc applied");
    const orderA = rowIds();
    const searchA = search();
    expect(orderA.length, "q 命中两行").toBe(2);

    // 路径 B：先点风险排序（desc），再输入同一关键词。
    clearScreen(); // 单 it 内二次挂载：先清掉路径 A 的实例，document 级查询才不串台。
    await page("/approvals?tab=history");
    const riskB = q("apv-sort-risk") as HTMLButtonElement | null;
    await act(async () => {
      riskB!.click();
    });
    await waitFor(() => q("apv-sort-risk")?.getAttribute("aria-sort") === "ascending", "b asc");
    await act(async () => {
      riskB!.click();
    });
    await waitFor(() => q("apv-sort-risk")?.getAttribute("aria-sort") === "descending", "b desc");
    await setInput("apv8-search", "预算");
    const orderB = rowIds();
    // 交换律：两条路径行序一致（同一 q ∩ 同一 risk desc）。
    expect(orderB, "过滤与排序的叠加顺序不改变结果行集").toEqual(orderA);
    // 路径 B 的 URL 参数集与路径 A 相同（键值集合一致，写入顺序不参与断言）。
    const ka = [...new URLSearchParams(searchA).keys()].sort();
    const kb = [...new URLSearchParams(search()).keys()].sort();
    expect(kb).toEqual(ka);
  });

  it("③ after filtering, apv5-count == table body == export count (the aud5-row-count name is the audit domain's; on this surface it is apv5-count)", async () => {
    serve();
    await page("/approvals?tab=history&status=pending");
    // 服务端筛后 2 行（serve 契约）；三值==筛选后行集。
    const rows = rowIds().length;
    expect(rows, "pending 腿 2 行").toBe(2);
    expect(q("apv5-count")?.textContent).toBe(String(rows));
    expect(q("apv7-export-count")?.textContent).toBe(`共 ${rows} 行`);
    // 叠加本地风险维（critical/high/low → none 之外），三值随同一集合重算。
    const high = q("apv-risk-high") as HTMLButtonElement | null;
    if (high) {
      await act(async () => {
        high.click();
      });
      await waitFor(() => !document.querySelector(".animate-pulse"), "risk filter");
      const filtered = rowIds().length;
      expect(q("apv5-count")?.textContent, "计数与表体同源").toBe(String(filtered));
      expect(q("apv7-export-count")?.textContent, "导出与表体同源").toBe(`共 ${filtered} 行`);
    }
  });

  it("④ invalid combinations keep the address verbatim, land on a stated empty state, and clearing returns the full set", async () => {
    serve();
    await page("/approvals?tab=history&window=__nope__&status=__notastate__&from=zzz");
    // 不改写 URL：非法值原样在地址里。
    expect(search()).toContain("window=__nope__");
    expect(search()).toContain("status=__notastate__");
    expect(search()).toContain("from=zzz");
    // 未知 status 现状=原样透传给服务端（R44），上游空集 + unknown 提示（R70/R44 证据面）。
    expect(q("apr5-filter-unknown"), "未知 status 提示仍在").toBeTruthy();
    expect(rowIds(), "空集可达").toHaveLength(0);
    // 清除链回全量：清筛选只动它负责的参数。
    const clear = q("apv-state-clear") as HTMLButtonElement | null;
    expect(clear, "空态出口").toBeTruthy();
    const callsBefore = api.mock.calls.length;
    await act(async () => {
      clear!.click();
    });
    await waitFor(() => rowIds().length === 3, "full set back");
    expect(search(), "status 被清除").not.toContain("status=");
    expect(search(), "未消费参不被代删").toContain("window=__nope__");
    const fresh = listUrls().slice(callsBefore);
    expect(fresh.length, "清除只重取一次").toBe(1);
    expect(fresh[0]).not.toContain("status=");
    expect(fresh[0], "未消费参不进请求").not.toContain("window=");
  });
});
