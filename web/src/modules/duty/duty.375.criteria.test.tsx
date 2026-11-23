// @vitest-environment jsdom
/**
 * DU-07「375 高频页判据」DOM 形制钉测（工单①②③④里 jsdom 可判的部分）。
 *
 * 分工（不许互相冒充）：
 *  - 本文件钉 **DOM 形制**：文字替代是否存在且与悬停原文同串、折叠态的
 *    判据是不是 aria-expanded/open（而不是宽度）、单列的 DOM 骨架、
 *    缺数是不是「—」＋原因而不是裸 0。
 *  - **像素**（逐卡 scrollWidth≤375、目标 boundingRect≥44×44 或间距≥44、
 *    根字号 15px、真浏览器重叠）jsdom 量不出来，归取图腿
 *    `evidence/du07-shoot.mjs`（真 BFF 反代＋opsadmin 登录），读数落
 *    `evidence/du07-375-readings.json` 并进 DONE。
 *
 * 台账（判据 ↔ 测试）：
 *  ① 热力/趋势文字替代 …… 「逐时文字替代与悬停 title 同串」＋「趋势五读数不劳而开」
 *  ② ≥44 ……………………… 形制腿：CSS 钉（44 规则在场且 .duty-range 紧贴 { 不破）；实值腿在测量
 *  ③ 无 hover-only ……… 「全页文本零『见 title』」＋「深链 title 句有屏上等价出口」
 *  ④ 折叠态判据 ………… 「aria-expanded 翻转开合」＋「details open 属性，非宽度」
 *  ⑤ 缺数≠0 ……………… 「空热力逐格 —」「趋势读败五格 —」
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import { ApiError } from "@/lib/api-error";
import DutyPage from "./DutyPage";
import { beijingHour } from "./format";

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

const WB_ASOF = "2026-11-18T06:00:00.000Z";

/** 花名册一行、活动格足料：每个 dow 0–6 × 24 小时都给 count，
 *  这样「今天」无论落在哪个 dow，热力都非空（future 时段由页面自己判）。 */
function ok(url: string, activity: "full" | "empty" = "full"): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: WB_ASOF,
      available: true,
      degraded: [],
      kpis: [
        { key: "runs", label: "运行数", unit: "次", value: 2, available: true },
        { key: "failed", label: "失败数", unit: "次", value: 1, available: true },
      ],
    };
  }
  if (url.includes("/workbench/timeseries")) {
    return {
      asOf: WB_ASOF,
      available: true,
      points: [
        { ts: "2026-11-16T00:00:00.000Z", label: "11-16", value: 1 },
        { ts: "2026-11-17T00:00:00.000Z", label: "11-17", value: 3 },
        { ts: "2026-11-18T00:00:00.000Z", label: "11-18", value: 2 },
      ],
      totals: { metric: "runs", value: 6 },
    };
  }
  if (url.includes("/workbench/queue")) {
    return { asOf: WB_ASOF, available: true, degraded: [], items: [], total: 0 };
  }
  if (url.includes("/employee-stats")) {
    return { byLifecycle: { active: 1, paused: 0, offboarding: 0 } };
  }
  if (url.includes("/employees")) {
    return { items: [{ employeeId: "emp_1", name: "陈可", lifecycleState: "active", ownerUserId: "u_1" }] };
  }
  if (url.includes("/run-activity")) {
    if (activity === "empty") return { max: null, cells: [] };
    const cells = [];
    for (let dow = 0; dow < 7; dow += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        cells.push({ dow, hour, count: (hour + dow) % 5 });
      }
    }
    return { max: 4, cells };
  }
  if (url.includes("/budget-usage")) {
    return { items: [{ employeeId: "emp_1", costUsd: 1.5 }], missingEmployeeIds: [] };
  }
  if (url.includes("/approval-stats")) return { pending: 0, dueSoon: 0 };
  if (url.includes("/approvals")) return { items: [] };
  if (url.includes("/tasks")) return { items: [] };
  if (url.includes("/runs")) {
    return {
      items: [
        { runId: "run_abcdef123456", employeeId: "emp_1", status: "failed", startedAt: "2026-11-18T02:00:00Z" },
      ],
    };
  }
  return { items: [] };
}

async function mountReady(activity: "full" | "empty" = "full"): Promise<void> {
  fetchJSON.mockImplementation((url: unknown) => Promise.resolve(ok(String(url), activity)));
  await act(async () => {
    root.render(<MemoryRouter><DutyPage /></MemoryRouter>);
  });
  await act(async () => {});
}

const q = (sel: string): Element | null => container.querySelector(sel);
const qa = (sel: string): Element[] => Array.from(container.querySelectorAll(sel));

async function tap(el: Element | null): Promise<void> {
  expect(el, `靶子在场: ${el}`).not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await act(async () => {});
}

describe("DU-07① 热力图文字替代：与悬停原文同串，点开即得", () => {
  it("24 格 title 逐格等于文字列表逐行（title 不再是唯一载体）", async () => {
    await mountReady();
    const cells = qa(".duty-heat .duty-cell");
    expect(cells, "热力 24 格").toHaveLength(24);
    for (const c of cells) expect(c.getAttribute("title"), "每格有读数原文").toBeTruthy();

    const toggle = q('[data-testid="duty-activity-text-toggle"]');
    expect(toggle?.getAttribute("aria-expanded"), "初始收起，判据是 aria-expanded").toBe("false");

    await tap(toggle);
    expect(q('[data-testid="duty-activity-text-toggle"]')?.getAttribute("aria-expanded")).toBe("true");
    const rows = qa('[data-testid="duty-activity-text-list"] li');
    expect(rows, "文字替代逐时 24 行").toHaveLength(24);
    const titles = cells.map((c) => c.getAttribute("title"));
    const texts = rows.map((r) => (r.textContent ?? "").trim());
    expect(texts, "列表与 title 同串（同一函数生成，杜绝两套话）").toEqual(titles);
    for (const t of texts) {
      expect(t).toMatch(/^\d{2}:00 · /);
      expect(t).toMatch(/(未发生|— 次|\d+ 次)$/);
    }

    await tap(q('[data-testid="duty-activity-text-toggle"]'));
    expect(q('[data-testid="duty-activity-text-toggle"]')?.getAttribute("aria-expanded")).toBe("false");
    expect(q('[data-testid="duty-activity-text-list"]'), "再点收起").toBeNull();
  });

  it("趋势卡五读数常驻屏上（不点开也有字面读数），表格钮走 aria-expanded", async () => {
    await mountReady();
    for (const key of ["first", "last", "peak", "low", "total"]) {
      expect(q(`[data-testid="duty-trend-${key}"]`), `五读数 duty-trend-${key}`).not.toBeNull();
    }
    const figure = q('[data-testid="duty-trend-figure"]');
    expect(figure?.getAttribute("role")).toBe("img");
    const descId = figure?.getAttribute("aria-describedby") ?? "";
    expect(container.querySelector(`#${descId}`), "svg 图形必须指向屏上文字替代").not.toBeNull();

    const tableToggle = q('[data-testid="duty-trend-table-toggle"]');
    expect(tableToggle?.getAttribute("aria-expanded")).toBe("false");
    await tap(tableToggle);
    expect(q('[data-testid="duty-trend-table-toggle"]')?.getAttribute("aria-expanded")).toBe("true");
    expect(q('[data-testid="duty-trend-table"]'), "展开出表格").not.toBeNull();
  });
});

describe("DU-07③ 无 hover-only 出口缺失", () => {
  it("全页可见文本零「见 title」句柄（回归钉）", async () => {
    await mountReady();
    expect(container.textContent ?? "", "结论不许外包给悬停").not.toContain("见 title");
  });

  it("阻塞深链 title 原句在卡上屏（title 是补充不是唯一出口）", async () => {
    await mountReady();
    const link = q('[data-testid="duty-route-blockers"]');
    const title = link?.getAttribute("title") ?? "";
    expect(title.length, "深链仍有 title 补充").toBeGreaterThan(0);
    const visible = q('[data-testid="duty-blockers-link-note"]')?.textContent ?? "";
    expect(visible, "title 原文有屏上等价句").toBe(title);
  });

  it("口径对照三 verdict 的屏上句都自足（缺数/未取/不同都不指向 title）", async () => {
    const { runsCaliber } = await import("./runsCaliber");
    for (const input of [
      { duty: null, metrics: null, dutyAsOfText: "—" },
      { duty: 3, metrics: null, dutyAsOfText: "x" },
      { duty: 3, metrics: 5, dutyAsOfText: "x" },
    ]) {
      const v = runsCaliber(input);
      expect(v.compare, `verdict=${v.verdict} 不许外包悬停`).not.toContain("见 title");
      expect(v.compare.length).toBeGreaterThan(0);
    }
  });
});

describe("DU-07④ 折叠态判据与单列 DOM 骨架", () => {
  it("卡外明细是 details：开合判据是 open 属性，禁拿宽度判（translate 类假读数源头）", async () => {
    await mountReady();
    const details = q('[data-testid="duty-details"]');
    expect(details?.tagName, "折叠区用原生 details").toBe("DETAILS");
    const summary = q('[data-testid="duty-details-toggle"]');
    expect(summary?.tagName).toBe("SUMMARY");
    expect((details as HTMLDetailsElement)?.open, "默认收起").toBe(false);
    await tap(summary);
    expect((q('[data-testid="duty-details"]') as HTMLDetailsElement).open, "点开=open=true").toBe(true);
  });

  it("口径说明钮 aria-expanded 翻转，正文随展开态出现/移除", async () => {
    await mountReady();
    const toggle = q('[data-testid="duty-notes-toggle"]');
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(q('[data-testid="duty-notes-body"]'), "收起时正文不在场").toBeNull();
    await tap(toggle);
    expect(q('[data-testid="duty-notes-toggle"]')?.getAttribute("aria-expanded")).toBe("true");
    expect(q('[data-testid="duty-notes-body"]'), "展开有正文").not.toBeNull();
    await tap(q('[data-testid="duty-notes-toggle"]'));
    expect(q('[data-testid="duty-notes-toggle"]')?.getAttribute("aria-expanded")).toBe("false");
    expect(q('[data-testid="duty-notes-body"]'), "再点移除").toBeNull();
  });

  it("单列骨架：三卡一行×两行＋趋势两列区，折叠区居中（几何档由测量腿复核）", async () => {
    await mountReady();
    const grids = qa(".duty-grid");
    expect(grids, "grid-3(三卡)+grid-2(趋势活跃)+grid-3(阻塞待办最近)").toHaveLength(3);
    const row1 = Array.from(grids[0].children);
    expect(row1.map((c) => (c as HTMLElement).dataset.dutyTestid)).toEqual([
      "duty-ready",
      "duty-today-runs",
      "duty-today-cost",
    ]);
    const row2 = Array.from(grids[1].children);
    expect(row2.map((c) => (c as HTMLElement).dataset.dutyTestid)).toEqual(["duty-trend", "duty-activity"]);
    const row3 = Array.from(grids[2].children);
    expect(row3.map((c) => (c as HTMLElement).dataset.dutyTestid)).toEqual([
      "duty-blockers",
      "duty-pending",
      "duty-recent",
    ]);
  });

  it("44px 触控档在 CSS 里钉住，且原钉形（.duty-range 紧贴 {）未被本轮挤坏", () => {
    const css = readFileSync("src/modules/duty/duty.css", "utf8");
    const phone = css.slice(css.lastIndexOf("@media (max-width: 820px)"));
    expect(phone).toMatch(
      /\.duty-kpi[^{]*\.duty-card-foot[^{]*\.duty-details-summary[^{]*\.duty-range\s*\{[^}]*min-block-size:\s*44px/,
    );
    // DU-07② 新增档位与钉形同块（实值由测量腿报 px，jsdom 量不了几何）。
    for (const sel of [
      ".duty-refresh-btn",
      ".duty-notes-toggle",
      ".duty-disclosure-toggle",
      ".duty-fleet-arrow",
      ".duty-fleet-pause",
      ".duty-card-hd .duty-link",
      ".duty-gate",
      ".duty-list > li",
    ]) {
      expect(phone.includes(sel), `DU-07② 触控档选择器表含 ${sel}`).toBe(true);
    }
    expect(phone).toMatch(/\.duty-fleet-arrow\s*\{[^}]*min-inline-size:\s*44px/);
  });
});

describe("DU-07⑤ 缺数显示「—」＋原因，绝不裸 0", () => {
  it("热力无行可读：24 格全「—」或「未发生」，文字替代同串且不出现「· 0 次」", async () => {
    await mountReady("empty");
    const cur = beijingHour();
    const pad = (n: number) => String(n).padStart(2, "0");
    const expectText = (hh: number) => (hh > cur ? `${pad(hh)}:00 · 未发生` : `${pad(hh)}:00 · — 次`);
    const cells = qa(".duty-heat .duty-cell");
    expect(cells).toHaveLength(24);
    await tap(q('[data-testid="duty-activity-text-toggle"]'));
    const rows = qa('[data-testid="duty-activity-text-list"] li');
    expect(rows).toHaveLength(24);
    rows.forEach((r, hh) => {
      const t = (r.textContent ?? "").trim();
      expect(t, "缺读数画 —、未来时段画未发生，绝不 0").toBe(expectText(hh));
      expect(t).not.toMatch(/· 0 次/);
    });
    expect(cells.map((c) => c.getAttribute("title")), "title 与列表同串（空数据档也一样）").toEqual(
      rows.map((r) => (r.textContent ?? "").trim()),
    );
    expect(q('[data-testid="duty-activity-text-toggle"]')?.getAttribute("aria-expanded")).toBe("true");
  });

  it("趋势读败：五读数全「—」，不把缺数当 0", async () => {
    fetchJSON.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/workbench/timeseries")) {
        throw new ApiError("boom", { status: 500, body: "{}", url: u, requestId: "req-du07-trend" });
      }
      return ok(u);
    });
    await act(async () => {
      root.render(<MemoryRouter><DutyPage /></MemoryRouter>);
    });
    await act(async () => {});
    for (const key of ["first", "last", "peak", "low", "total"]) {
      expect(q(`[data-testid="duty-trend-${key}"]`)?.textContent, `duty-trend-${key}`).toBe("—");
    }
    const summary = q('[data-testid="duty-trend-summary"]')?.textContent ?? "";
    expect(summary).not.toMatch(/\d+ 次/);
    expect(summary, "五读数句式仍在（缺数画 — 而不是撤掉替代腿）").toContain("摘要：首日");
    // 读败的原因句不许只活在 title：StateLine 的卡内错误态给同层出口（标题＋详情折叠＋请求编号）。
    const card = q('[data-duty-testid="duty-trend"]');
    expect(card?.textContent ?? "", "错误态卡内必须有可读标题").toContain("这一块没有读取成功");
    expect(q('[data-testid="ov6-trend-stamp"]')?.textContent, "采集时刻诚实画 —").toContain("数据截至 —");
  });
});
