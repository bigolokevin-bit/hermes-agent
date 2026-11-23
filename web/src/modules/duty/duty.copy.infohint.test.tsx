// @vitest-environment jsdom
/**
 * DU-08 — 值班台解释性文字收口（InfoHint 新规）行为契约。
 *
 * 五判（工单 DU-08 步骤①..⑤，台账见 docs/product/design/COPY-INVENTORY-20261123.md）：
 *   ① 源码契约：剥掉注释后，duty 生产文件里不得再出现 DoD 禁词词面
 *      （`口径|说明[:：]|注[:：]`）；命中即整行入失败信息，禁静默。
 *   ② 渲染契约：整页可见文本（InfoHint 弹层除外——那是 glossary 唯一合法载体）
 *      同样零命中。
 *   ③ 单源：一个 term 全站一份定义，页面只引 key；同一页同一 term 不得挂两次
 *      （InfoHint 弹层 id 由 term 决定，重复挂载会让 aria-describedby 指向别人）。
 *   ④ 键盘：提示触发器是真 button，focus 即展开、aria-expanded 与弹层 data-open
 *      同步、Esc 关闭并回焦；折叠区四把钮的 aria-expanded 必须与折叠态实测一致。
 *   ⑤ 不回退：DU-02 三卡固定槽位（卡内零按钮、零提示钮）与 DU-07 已交付的
 *      title 原文上屏句子（blockersLinkNote 动态句、「查看全部 (N)」真数）一字不动。
 *
 * 形制承 dutyPage.test.tsx / duty.slotCounts.test.tsx（同一 createRoot＋act＋原生事件骨架）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BLURB = /口径|说明[:：]|注[:：]/;
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*\*?|\{\/\*|\*\/)/.test(line))
    .map((line) => (line.includes("://") ? line : line.replace(/\/\/.*$/, "")))
    .join("\n");

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => api.fetchJSON(...args) }));

import DutyPage from "./DutyPage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASOF = "2026-11-18T06:00:00.000Z";

function ok(url: string): unknown {
  if (url.includes("/workbench/summary")) {
    return {
      asOf: ASOF,
      asOfSource: "bff-aggregation-read-time",
      available: true,
      degraded: [],
      kpis: [
        { key: "runs", label: "运行数", unit: "次", value: 2, available: true },
        { key: "failed", label: "失败数", unit: "次", value: 1, available: true },
        { key: "failureRate", label: "失败率", unit: "ratio", value: 0.5, available: true },
        { key: "costUsd", label: "成本", unit: "USD", value: 1.5, available: true },
        { key: "activeEmployees", label: "在岗数字员工", unit: "个", value: 1, available: true },
        { key: "pendingApprovals", label: "待审批", unit: "条", value: 1, available: true },
      ],
    };
  }
  if (url.includes("/workbench/timeseries")) {
    return {
      asOf: ASOF,
      asOfSource: "bff-read-time",
      available: true,
      points: [
        { ts: "2026-11-17T00:00:00.000Z", label: "11-17", value: 1 },
        { ts: "2026-11-18T00:00:00.000Z", label: "11-18", value: 2 },
      ],
      totals: { metric: "runs", value: 3 },
    };
  }
  if (url.includes("/workbench/queue")) {
    return { asOf: ASOF, available: true, degraded: [], items: [], total: 0 };
  }
  if (url.includes("/employee-stats")) return { byLifecycle: { active: 1, paused: 0, offboarding: 0 } };
  if (url.includes("/employees")) {
    return { items: [{ employeeId: "emp_0aaaabbbbccccdddd", name: "陈可", lifecycleState: "active", ownerUserId: "u_1" }] };
  }
  if (url.includes("/run-stats")) {
    return { totals: { runs: 2, succeeded: 1, failed: 1, running: 0, costUsd: 1.5 }, buckets: [{ bucketStart: "2026-11-18T00:00:00Z", runs: 2, failed: 1 }] };
  }
  if (url.includes("/run-activity")) return { max: 2, cells: [{ dow: 2, hour: 10, count: 2 }] };
  if (url.includes("/budget-usage")) return { items: [{ employeeId: "emp_0aaaabbbbccccdddd", costUsd: 1.5 }], missingEmployeeIds: [] };
  if (url.includes("/approval-stats")) return { pending: 1, dueSoon: 0 };
  if (url.includes("/approvals")) return { items: [] };
  if (url.includes("/tasks")) return { items: [{ taskId: "tsk_1", title: "整理周报", status: "blocked" }] };
  if (url.includes("/runs")) {
    return { items: [{ runId: "run_abcdef123456", employeeId: "emp_0aaaabbbbccccdddd", status: "failed", startedAt: "2026-11-18T02:00:00Z" }] };
  }
  return { items: [] };
}

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function mountDuty(): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: string) => ok(String(url)));
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/overview"]}>
        <DutyPage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !container.querySelector(".duty-skeleton"), "duty settled");
}

const q = (sel: string): Element | null => container.querySelector(sel);
const qa = (sel: string): Element[] => Array.from(container.querySelectorAll(sel));
const tap = (el: Element | null): void => {
  act(() => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("DU-08① 源码契约：duty 生产文件剥注释后禁词命中 0", () => {
  const files = readdirSync("src/modules/duty")
    .filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
    .map((f) => `src/modules/duty/${f}`);

  it("清单非空转：生产文件确实被读到（少于 20 个说明扫错了目录）", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it("可见文本与 CSS 里不存在「口径／说明：／注：」词面（glossary/InfoHint 除外）", () => {
    const hits: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const body = file.endsWith(".css")
        ? raw.replace(/\/\*[\s\S]*?\*\//g, "")
        : stripComments(raw);
      body.split("\n").forEach((line, i) => {
        if (BLURB.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits, `命中 ${hits.length} 处\n${hits.join("\n")}`).toEqual([]);
  });

  it("页面侧不得再自带解释句：术语只准引 glossary 的 key", () => {
    const page = readFileSync("src/modules/duty/DutyPage.tsx", "utf8");
    expect(page).toContain('from "@/components/ui/InfoHint"');
    for (const term of ["duty.ready", "duty.denominator", "duty.runsCaliber", "duty.cost", "duty.notes", "duty.blockerFields"]) {
      expect(page, `页面必须引 key ${term}`).toContain(`term="${term}"`);
    }
    // 单源：弹层正文只准来自 glossary，页面里不得出现任何一句 glossary 原文。
    const glossary = readFileSync("src/components/ui/glossary.ts", "utf8");
    const definitions = [...glossary.matchAll(/text:\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const text of definitions) {
      expect(page, `页面复写了 glossary 定义：${text}`).not.toContain(text);
    }
  });
});

describe("DU-08②③ 接线与单源（渲染态）", () => {
  it("卡外折叠区承接三卡取样句子，五个 term 各挂一次", async () => {
    await mountDuty();
    const terms = qa(".ui-hint").map((n) => n.getAttribute("data-hint-term"));
    for (const term of ["duty.ready", "duty.denominator", "duty.runsCaliber", "duty.cost", "duty.blockerFields", "duty.notes"]) {
      expect(terms.filter((t) => t === term), `${term} 必须恰挂一次`).toHaveLength(1);
    }
    // 折叠区承接（DU-02 明细出卡，DU-08 句子收进 InfoHint）：提示钮都在卡外。
    const details = q('[data-testid="duty-details"]');
    expect(details?.contains(q('[data-testid="hint-duty.denominator"]')!), "分母定义在卡外折叠区").toBe(true);
    expect(details?.contains(q('[data-testid="hint-duty.runsCaliber"]')!), "运行数对照在卡外折叠区").toBe(true);
    expect(details?.contains(q('[data-testid="hint-duty.cost"]')!), "账本定义在卡外折叠区").toBe(true);
  });

  it("三卡卡内零提示钮（DU-02 固定槽位不回退），整页可见文本禁词命中 0", async () => {
    await mountDuty();
    for (const id of ["duty-ready", "duty-today-runs", "duty-today-cost"]) {
      const card = q(`[data-duty-testid="${id}"]`);
      expect(card, `${id} 在场`).not.toBeNull();
      expect(card!.querySelectorAll(".ui-hint-trigger").length, `${id} 卡内不得摆提示钮`).toBe(0);
      expect(card!.querySelectorAll("button").length, `${id} 正常态零按钮`).toBe(0);
    }
    const visible = container.cloneNode(true) as HTMLElement;
    visible.querySelectorAll(".ui-hint-pop").forEach((n) => n.remove());
    expect(visible.textContent ?? "", "屏上文本不得再出现禁词词面").not.toMatch(BLURB);
  });

  it("解释句不再有两套措辞：原「各项检查独立判定」句只活在一处", async () => {
    await mountDuty();
    const hits = (container.textContent ?? "").split("既不算通过也不算不通过").length - 1;
    expect(hits, "同一条定义全站一份（glossary 弹层里那一份算唯一）").toBe(1);
  });
});

describe("DU-08④ 键盘序与 aria-expanded 同步", () => {
  it("提示触发器是真 button：focus 展开、aria-expanded 与 data-open 同步、Esc 关闭并回焦", async () => {
    await mountDuty();
    const trigger = q('[data-testid="hint-duty.notes"] button.ui-hint-trigger') as HTMLButtonElement;
    const pop = q('[data-testid="hint-duty.notes-pop"]');
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(pop?.getAttribute("data-open")).toBe("false");
    act(() => trigger.focus());
    act(() => trigger.dispatchEvent(new FocusEvent("focus")));
    expect(trigger.getAttribute("aria-expanded"), "focus 必须同步 aria-expanded").toBe("true");
    expect(pop?.getAttribute("data-open"), "data-open 必须与 aria-expanded 同帧").toBe("true");
    expect(trigger.getAttribute("aria-describedby")).toBe(pop!.id);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement, "关闭后焦点回到触发器").toBe(trigger);
  });

  it("折叠区四把钮：aria-expanded 与折叠态实测一致（读口清单／卡外明细／趋势表格／逐时文字）", async () => {
    await mountDuty();
    const notesToggle = q('[data-testid="duty-notes-toggle"]');
    expect(notesToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(q('[data-testid="duty-notes-body"]'), "收起时正文不在场").toBeNull();
    tap(notesToggle);
    expect(notesToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(q('[data-testid="duty-notes-body"]'), "展开即有正文").not.toBeNull();
    tap(notesToggle);
    expect(notesToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(q('[data-testid="duty-notes-body"]')).toBeNull();

    const details = q('[data-testid="duty-details"]') as HTMLDetailsElement;
    const summary = q('[data-testid="duty-details-toggle"]');
    expect(details.open, "卡外明细默认收起").toBe(false);
    act(() => {
      details.open = true;
    });
    expect(details.open, "开合判据是 open 属性（DU-07④，禁拿宽度判）").toBe(true);
    expect(summary?.tagName).toBe("SUMMARY");

    const tableToggle = q('[data-testid="duty-trend-table-toggle"]');
    expect(tableToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(q('[data-testid="duty-trend-table"]')).toBeNull();
    tap(tableToggle);
    expect(tableToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(q('[data-testid="duty-trend-table"]'), "表格随展开态出现").not.toBeNull();

    const textToggle = q('[data-testid="duty-activity-text-toggle"]');
    expect(textToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(q('[data-testid="duty-activity-text-list"]')).toBeNull();
    tap(textToggle);
    expect(textToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(q('[data-testid="duty-activity-text-list"]'), "逐时文字随展开态出现").not.toBeNull();
  });

  it("Tab 序覆盖控制带 strip／卡内深链／折叠区：按文档顺序，aria-pressed 与生效值同步", async () => {
    await mountDuty();
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"]),summary',
      ),
    );
    const pos = (node: Element | null) => focusables.indexOf(node as HTMLElement);
    const range = q('[data-testid="duty-range-14d"]');
    const deep = q('[data-testid="duty-route-today-runs"]');
    const summary = q('[data-testid="duty-details-toggle"]');
    const notes = q('[data-testid="duty-notes-toggle"]');
    for (const [name, node] of [
      ["时间范围 chip", range],
      ["卡内深链", deep],
      ["卡外明细 summary", summary],
      ["读口清单钮", notes],
    ] as const) {
      expect(node, `${name} 在场`).not.toBeNull();
      expect(pos(node), `${name} 落在 tab 序内`).toBeGreaterThan(-1);
    }
    expect(pos(deep), "深链在控制带之后").toBeGreaterThan(pos(range));
    expect(pos(summary), "折叠区在深链之后").toBeGreaterThan(pos(deep));
    expect(pos(notes), "清单在卡外明细之后").toBeGreaterThan(pos(summary));
    expect(range?.getAttribute("aria-pressed"), "默认窗口 chip 生效").toBe("true");
    tap(q('[data-testid="duty-range-7d"]'));
    expect(range?.getAttribute("aria-pressed"), "切窗后 aria-pressed 跟着翻").toBe("false");
    expect(q('[data-testid="duty-range-7d"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("键盘序覆盖清单钮→提示钮→深链：Tab 序里三者按文档顺序可达", async () => {
    await mountDuty();
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    );
    const index = (testid: string) => focusables.indexOf(container.querySelector(`[data-testid="${testid}"]`) as HTMLElement);
    const notes = index("duty-notes-toggle");
    const hint = focusables.indexOf(q('[data-testid="hint-duty.notes"] button.ui-hint-trigger') as HTMLButtonElement);
    const runsDeep = index("duty-route-today-runs");
    expect(notes, "读口清单钮在 tab 序内").toBeGreaterThan(-1);
    expect(hint, "提示钮在 tab 序内").toBeGreaterThan(-1);
    expect(runsDeep, "卡内深链在 tab 序内").toBeGreaterThan(-1);
    expect(hint, "提示钮排在清单钮之后").toBeGreaterThan(notes);
    expect(notes, "折叠区在卡内深链之后（DOM 序即 tab 序，无 tabindex 乱插）").toBeGreaterThan(runsDeep);
    for (const el of focusables) {
      expect(el.getAttribute("tabindex"), "本轮新增件不得用 tabindex 改序").not.toBe("-1");
    }
  });
});

describe("DU-08⑤ 工程语言与裸 id 只进 title／详情披露", () => {
  it("门码 V1…V6、E_NO_CITATION、GAP-01 上屏文本零命中，只活在 title", async () => {
    await mountDuty();
    const visible = container.cloneNode(true) as HTMLElement;
    visible.querySelectorAll(".ui-hint-pop").forEach((n) => n.remove());
    const text = visible.textContent ?? "";
    for (const engineering of ["E_NO_CITATION", "GAP-01", "V3", "unknown_route"]) {
      expect(text, `屏上不出现工程码 ${engineering}`).not.toContain(engineering);
    }
    const gateTitles = qa('[data-testid^="ov6-gate-"]').map((n) => n.getAttribute("title") ?? "");
    expect(gateTitles.some((t) => /V\d/.test(t)), "门码留在检查项行的 title 里").toBe(true);
  });

  it("原始 employee_id 全值只在折叠明细里，卡面走短码", async () => {
    await mountDuty();
    const rail = q('[data-testid="duty-fleet-id-list"]');
    expect(rail?.textContent ?? "", "折叠明细给全值").toContain("emp_0aaaabbbbccccdddd");
    const cardText = container.querySelector('[data-testid="duty-fleet-rail"]')?.textContent ?? "";
    expect(cardText).not.toContain("emp_0aaaabbbbccccdddd");
  });

  it("DU-02／DU-07 已交付句子不回退：blockersLinkNote 屏上句与 title 同串、「查看全部 (N)」真数在位", async () => {
    await mountDuty();
    const link = q('[data-testid="duty-route-blockers"]');
    const title = link?.getAttribute("title") ?? "";
    expect(title).toContain("不说「已逐条列出」");
    expect(q('[data-testid="duty-blockers-link-note"]')?.textContent, "title 原文有屏上等价句").toBe(title);
    expect(link?.textContent, "深链真数形制保持").toMatch(/查看全部 \(\d+\)/);
  });
});
