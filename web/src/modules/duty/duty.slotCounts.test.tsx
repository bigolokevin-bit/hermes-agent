// @vitest-environment jsdom
// DU-02 三卡固定槽位＋「查看全部 (N)」的行级钉测。
// 判据四件（工单 DU-02①②③④）：
//   ① N 只来自服务端响应真带回的行数，与折叠区真数逐位一致；
//   ② 每卡恰一个主数字／一句状态／一个深链，主操作每卡 ≤1；
//   ③ 拿不到 N 就写「(数量未提供)」，缺数给「—」＋原因句，绝不画 0；
//   ④ 卡高与数据行数解耦：明细从 1 行长到 9 行，三卡 DOM 一字不变。
// 形制承 duty.slotClause5.test.tsx（同一夹具骨架；只动页面与计数腿）。
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import { ApiError } from "@/lib/api-error";
import DutyPage from "./DutyPage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  fetchJSON.mockReset();
});

const ASOF = "2026-11-18T06:00:00.000Z";

type Fixture = {
  /** /runs 响应 items 里可成形的行数。 */
  runs?: number;
  /** /runs 响应 items 里缺 runId 的行数（服务端给了、前端读不成形）。 */
  runsUnreadable?: number;
  /** /employees 响应 items 的行数。 */
  employees?: number;
  /** /budget-usage 响应 items 的行数。 */
  budget?: number;
  /** /budget-usage 的 missingEmployeeIds 长度（服务端自报缺人）。 */
  budgetMissing?: number;
  /** /runs 回一个没有 items 键的对象：形状漂移，不等于「0 行」。 */
  runsDrift?: boolean;
  /** /runs 直接失败。 */
  runsFail?: boolean;
};

function runRows(n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    runId: `run_${i + offset}`,
    employeeId: "emp_0",
    status: "completed",
    startedAt: "2026-11-18T02:00:00Z",
  }));
}

function ok(url: string, fx: Fixture): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: ASOF,
      asOfSource: "bff-aggregation-read-time",
      available: true,
      degraded: [],
      kpis: [
        { key: "runs", label: "运行数", unit: "次", value: 7, available: true },
        { key: "failed", label: "失败数", unit: "次", value: 2, available: true },
        { key: "failureRate", label: "失败率", unit: "ratio", value: 0.28, available: true },
        { key: "costUsd", label: "成本", unit: "USD", value: 1.5, available: true },
        { key: "activeEmployees", label: "在岗数字员工", unit: "个", value: fx.employees ?? 2, available: true },
        { key: "pendingApprovals", label: "待审批", unit: "条", value: 0, available: true },
      ],
    };
  }
  if (url.includes("/workbench/timeseries")) {
    return {
      asOf: ASOF,
      asOfSource: "bff-read-time",
      available: true,
      points: [
        { ts: "2026-11-17T00:00:00.000Z", label: "11-17", value: 3 },
        { ts: "2026-11-18T00:00:00.000Z", label: "11-18", value: 4 },
      ],
      totals: { metric: "runs", value: 7 },
    };
  }
  if (url.includes("/workbench/queue")) {
    return { asOf: ASOF, available: true, degraded: [], items: [], total: 0 };
  }
  if (url.includes("/employee-stats")) {
    const n = fx.employees ?? 2;
    return { total: n, byLifecycle: { active: n, paused: 0, offboarding: 0 } };
  }
  if (url.includes("/employees")) {
    const n = fx.employees ?? 2;
    return {
      items: Array.from({ length: n }, (_, i) => ({
        employeeId: `emp_${i}`,
        name: `员工${i}`,
        lifecycleState: "active",
        ownerUserId: "u_1",
      })),
    };
  }
  if (url.includes("/run-stats")) {
    return {
      totals: { runs: 7, succeeded: 5, failed: 2, running: 0, costUsd: 1.5 },
      buckets: [{ bucketStart: "2026-11-18T00:00:00Z", runs: 7, failed: 2 }],
    };
  }
  if (url.includes("/run-activity")) {
    return { max: 2, cells: [{ dow: 3, hour: 10, count: 2 }] };
  }
  if (url.includes("/budget-usage")) {
    return {
      items: Array.from({ length: fx.budget ?? 2 }, (_, i) => ({
        employeeId: `emp_${i}`,
        costUsd: 0.75,
      })),
      missingEmployeeIds: Array.from({ length: fx.budgetMissing ?? 0 }, (_, i) => `emp_missing_${i}`),
    };
  }
  if (url.includes("/approval-stats")) return { pending: 0, dueSoon: 0 };
  if (url.includes("/approvals")) return { items: [] };
  if (url.includes("/tasks")) return { items: [] };
  if (url.includes("/workstations")) {
    return { items: [{ bindingType: "group", status: "active", channel: "g_1" }] };
  }
  if (url.includes("/effective-config")) {
    return { resolvedAt: ASOF, version: { knowledgeScopes: ["kb_1"] }, grants: [] };
  }
  if (url.includes("/knowledge/citations")) {
    return { count: 3, rows: [], asOf: ASOF, source: "kb" };
  }
  if (url.includes("/runs")) {
    if (fx.runsFail) {
      throw new ApiError("runs upstream down", { status: 502, body: "", url, requestId: "req-runs-1" });
    }
    if (fx.runsDrift) return { rows: [], note: "形状漂移：响应没有 items 键" };
    const unreadable = Array.from({ length: fx.runsUnreadable ?? 0 }, (_, i) => ({
      startedAt: "2026-11-18T03:00:00Z",
      note: `没有 runId 的第 ${i + 1} 行`,
    }));
    return { items: [...runRows(fx.runs ?? 3), ...unreadable] };
  }
  return { items: [] };
}

async function mount(fx: Fixture = {}): Promise<void> {
  // 每次都是全新页面：同一 root 上重渲染会复用 useDutyData 的旧批次，
  // 那时装的是上一批的行数，判据会读到脏数据。
  act(() => root.unmount());
  root = createRoot(container);
  fetchJSON.mockImplementation((u: unknown) => {
    try {
      return Promise.resolve(ok(String(u), fx));
    } catch (err) {
      return Promise.reject(err);
    }
  });
  await act(async () => {
    root.render(<MemoryRouter>{<DutyPage />}</MemoryRouter>);
  });
  await act(async () => {});
  expect(kpiCards(), "非空转闸：三卡必须渲染出来").toHaveLength(3);
}

function kpiCards(): HTMLElement[] {
  const sel = ".duty-grid-3 > [data-card=\"duty\"]";
  return Array.from(container.querySelectorAll<HTMLElement>(sel)).slice(0, 3);
}

function cardBy(testid: string): HTMLElement {
  const hit = kpiCards().find((c) => c.dataset.dutyTestid === testid);
  if (!hit) throw new Error(`卡 ${testid} 不在场`);
  return hit;
}

function linkText(card: HTMLElement): string {
  return (card.querySelector(".duty-card-foot")?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function linkCount(card: HTMLElement): string | null {
  const hit = /查看全部 \((\d+)\)/.exec(linkText(card));
  return hit ? hit[1] : null;
}

function noteText(testid: string): string {
  return (container.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function listedRunRows(): number {
  return container.querySelectorAll('[data-testid="duty-details-run-list"] > li').length;
}

describe("DU-02① 「查看全部 (N)」＝服务端真给的行数", () => {
  it("三卡 N 分别等于各自响应带回的行数", async () => {
    await mount({ runs: 3, employees: 2, budget: 2 });
    expect(linkCount(cardBy("duty-ready"))).toBe("2");
    expect(linkCount(cardBy("duty-today-runs"))).toBe("3");
    expect(linkCount(cardBy("duty-today-cost"))).toBe("2");
  });

  it("N 与折叠区真数一致（同一响应，两处同一个数）", async () => {
    await mount({ runs: 3, employees: 2, budget: 2 });
    expect(noteText("duty-details-readiness-count")).toContain("员工目录本轮返回 2 条");
    expect(noteText("duty-details-runs-count")).toContain("运行明细本轮返回 3 条");
    expect(noteText("duty-details-cost-count")).toContain("当日账本本轮返回 2 行");
    expect(listedRunRows(), "折叠区列出的行数＝卡上 N").toBe(3);
    // 打满请求上限要说非全量：这是响应自证的事实，不是「多半还有」的猜测。
    expect(noteText("duty-details-runs-count")).toContain("请求上限 3");
    expect(noteText("duty-details-runs-count")).toContain("非全量");
    expect(linkText(cardBy("duty-today-runs"))).toBe("查看全部 (3)");
    expect(cardBy("duty-today-runs").querySelector(".duty-card-foot")?.getAttribute("title")).toContain("非全量");
  });

  it("服务端给了读不成形的行：N 仍按响应行数，另处披露几条没读出来", async () => {
    await mount({ runs: 3, runsUnreadable: 1, employees: 2, budget: 2 });
    expect(linkCount(cardBy("duty-today-runs")), "响应给了 4 行就是 4").toBe("4");
    expect(listedRunRows(), "能读成形的只有 3 行，明细不硬凑").toBe(3);
    expect(noteText("duty-details-runs-count")).toContain("1 条读不成行形");
  });

  it("行数变多变少，卡上 N 跟着响应走（不是写死的样本数）", async () => {
    await mount({ runs: 1, employees: 1, budget: 1 });
    expect(linkCount(cardBy("duty-today-runs"))).toBe("1");
    expect(linkCount(cardBy("duty-ready"))).toBe("1");
    expect(linkCount(cardBy("duty-today-cost"))).toBe("1");
    await mount({ runs: 9, employees: 3, budget: 3 });
    expect(linkCount(cardBy("duty-today-runs"))).toBe("9");
    expect(linkCount(cardBy("duty-ready"))).toBe("3");
    expect(linkCount(cardBy("duty-today-cost"))).toBe("3");
  });
});

describe("DU-02② 固定槽位：每卡一个主数字／一句状态／一个深链", () => {
  it("三卡槽位计数恒等于 1/1/1，正常态卡内零按钮（主操作 ≤1）", async () => {
    await mount({ runs: 3, employees: 2, budget: 2 });
    for (const id of ["duty-ready", "duty-today-runs", "duty-today-cost"]) {
      const card = cardBy(id);
      expect(card.querySelectorAll(".duty-num").length, `${id} 主数字`).toBe(1);
      expect(card.querySelectorAll(".duty-say").length, `${id} 状态句`).toBe(1);
      expect(card.querySelectorAll(".duty-card-foot").length, `${id} 深链`).toBe(1);
      expect(card.querySelectorAll("a").length, `${id} 卡内链接数`).toBe(1);
      expect(card.querySelectorAll("button").length, `${id} 正常态不许摆按钮`).toBe(0);
      expect(linkText(card), `${id} 深链文案`).toMatch(/^查看全部 \((\d+|数量未提供)\)$/);
    }
  });

  it("今日运行的成功率/在跑/失败出卡进折叠区，一条不删", async () => {
    await mount({ runs: 3, employees: 2, budget: 2 });
    const card = cardBy("duty-today-runs");
    expect(card.querySelector(".duty-kpis"), "卡内不再摆 KPI 格").toBeNull();
    expect(card.querySelector('[data-testid="ov6-kpi-runs"]')?.textContent, "主数字＝服务端运行数").toBe("7");
    const moved = container.querySelector('[data-testid="duty-today-runs-kpis"]');
    expect(moved, "三格挪进了卡外折叠区").not.toBeNull();
    expect(container.querySelector('[data-testid="duty-details-runs"]')?.contains(moved as Node), "承接位=今日运行明细").toBe(true);
    const text = moved?.textContent ?? "";
    for (const label of ["成功率", "在跑", "失败"]) expect(text).toContain(label);
    expect(text, "totals 没带 succeeded 就不编成功率").toContain("—");
  });

  it("可上岗卡保留 DU-01 三分态主数字与分母披露，只换深链文案", async () => {
    await mount({ runs: 3, employees: 2, budget: 2 });
    const card = cardBy("duty-ready");
    expect(card.querySelector('[data-duty-testid="duty-ready-value"]')?.textContent).toContain("已确认");
    expect(noteText("duty-ready-denominator")).toContain("分母口径");
    expect(cardBy("duty-ready").querySelector("a")?.getAttribute("href")).toBe("/employees");
  });
});

describe("DU-02③ 缺数不画 0", () => {
  it("响应形状漂移：N 不给数字，写「数量未提供」", async () => {
    await mount({ runsDrift: true, employees: 2, budget: 2 });
    expect(linkText(cardBy("duty-today-runs"))).toBe("查看全部 (数量未提供)");
    expect(linkText(cardBy("duty-today-runs"))).not.toContain("(0)");
    expect(noteText("duty-details-runs-count")).toContain("本轮返回条数未提供");
    expect(container.querySelector('[data-testid="duty-details-run-list"]'), "没有行就不摆空列表").toBeNull();
  });

  it("读取失败：深链留在卡上且不带假数", async () => {
    await mount({ runsFail: true, employees: 2, budget: 2 });
    const card = cardBy("duty-today-runs");
    expect(card.querySelector('[data-testid="duty-route-today-runs"]'), "失败也要留出口").not.toBeNull();
    expect(linkText(card)).toBe("查看全部 (数量未提供)");
    expect(card.textContent ?? "", "卡面不出现 (0)").not.toContain("(0)");
  });

  it("服务端自报缺人 → partial → 合计 null → 屏上「—」＋原因句，绝不 $0.00", async () => {
    await mount({ runs: 3, employees: 2, budget: 2, budgetMissing: 1 });
    const card = cardBy("duty-today-cost");
    expect(card.querySelector('[data-testid="ov6-kpi-cost"]')?.textContent).toContain("—");
    expect(card.textContent ?? "", "缺数不画 0").not.toContain("$0.00");
    expect(noteText("duty-today-cost-say")).toContain("先不报合计");
    expect(linkCount(card), "合计给不出，不影响如实报响应行数").toBe("2");
    expect(noteText("duty-details-cost-count")).toContain("服务端报缺 1 人金额");
  });
});

describe("DU-02④ 卡高与数据行数解耦（DOM 结构判据）", () => {
  /** 固定槽位的可数判据：元素总数＋槽位类计数＋按行长出来的结构缺席
   * （深链里的箭头 svg 不算，它是槽位自带的图标而非明细）。 */
  function signature(card: HTMLElement) {
    return {
      all: card.querySelectorAll("*").length,
      slots: card.querySelectorAll(".duty-num, .duty-say, .duty-card-foot, .duty-note").length,
      rowGrown: card.querySelectorAll(
        "ul, .duty-list, .duty-kpis, .duty-gates, .duty-heat, .duty-chart, .duty-trend-table",
      ).length,
      links: card.querySelectorAll("a").length,
      buttons: card.querySelectorAll("button").length,
    };
  }

  it("明细从 1 行长到 9 行，三卡 DOM 一字不变；行数确实变了（判据不空转）", async () => {
    await mount({ runs: 1, employees: 1, budget: 1 });
    const thin = kpiCards().map(signature);
    const thinList = listedRunRows();

    await mount({ runs: 9, employees: 9, budget: 9 });
    const fat = kpiCards().map(signature);
    const fatList = listedRunRows();

    expect(thinList, "薄批只列 1 行明细").toBe(1);
    expect(fatList, "厚批的明细确实变长（折叠区封顶 8 条）").toBe(8);
    expect(fat, "卡内结构与明细行数无关").toEqual(thin);
    for (const s of fat) expect(s.rowGrown, "卡内不许有任何按行长出来的结构").toBe(0);
  });

  it("等高的机制在 CSS 里钉住：网格拉伸＋深链钉底＋卡外三格一行", () => {
    const css = readFileSync("src/modules/duty/duty.css", "utf8");
    expect(css).toMatch(/\.duty-grid\s*\{[^}]*align-items:\s*stretch/);
    expect(css).toMatch(/\.duty-card\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.duty-card-foot\s*\{[^}]*margin-block-start:\s*auto/);
    expect(css).toMatch(/\.duty-details-kpis\s*\{[^}]*grid-template-columns:\s*repeat\(3/);
  });
});

describe("DU-02 计数口径单源（dutySlots 纯函数）", () => {
  it("viewAllText：有数带数，没数只说没提供", async () => {
    const { viewAllText, truncationClause, detailsListNote, serverRowsOf } = await import("./dutySlots");
    expect(viewAllText(0)).toBe("查看全部 (0)");
    expect(viewAllText(null)).toBe("查看全部 (数量未提供)");
    expect(serverRowsOf({ items: [1, 2, 3] })).toBe(3);
    expect(serverRowsOf([1])).toBe(1);
    expect(serverRowsOf({ rows: [] })).toBeNull();
    expect(serverRowsOf(null)).toBeNull();
    expect(truncationClause({ serverRows: 3, unreadable: 0, requestLimit: 3 })).toContain("非全量");
    expect(truncationClause({ serverRows: 2, unreadable: 0, requestLimit: 3 })).not.toContain("非全量");
    expect(truncationClause({ serverRows: null, unreadable: null, requestLimit: 3 })).toBe("本轮返回条数未提供");
    expect(detailsListNote({ serverRows: 9, unreadable: 0, requestLimit: 3 }, 8)).toContain("这里列前 8 条");
    expect(detailsListNote({ serverRows: 1, unreadable: null, requestLimit: 3 }, 1)).not.toContain("这里列前");
  });
});
