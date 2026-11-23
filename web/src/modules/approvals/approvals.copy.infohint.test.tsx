// @vitest-environment jsdom
/**
 * DU-08 — 审批面解释性文字收口（InfoHint 新规）行为契约。
 *
 * 写域纪律：本件只钉**文案接线与 a11y 形制**，判定逻辑（gates.ts 的
 * `announcement()`／`DECISION_GATE`／batch.ts 门链）零改动，因此这里只做
 * 「同源与不被复制成第二套措辞」的护栏，不重复 AP-04/AP-07 的门判据。
 *
 * 四判（工单 DU-08 步骤①②④⑤，台账 COPY-INVENTORY-20261123.md A1/A3/A5/A8）：
 *   ① 源码契约：剥掉注释后，approvals 生产文件里 `口径|说明[:：]|注[:：]` 命中 0。
 *   ② 术语单源：「待处理」定义只在 glossary 一份，队列汇总条引 key；
 *      本地过滤/键盘指引三行（QueueMetaNotes）按 A3 判「留内联」，不得被收进 hover。
 *   ③ 折叠区键盘序：筛选面板钮与 chips 行的「同值 disclosure」用 Enter/Space 都能开，
 *      aria-expanded 与面板在场状态实测同步；新增提示钮自身 aria-expanded↔data-open 同帧。
 *   ④ 工程语言与裸 id 只进 title／详情披露，播报仍单点（新增件不得变成第二个 live 区）。
 *
 * 形制承 approvals.denominator.honesty.test.tsx（mock 只打在 @/lib/api 的 fetchJSON）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const BLURB = /口径|说明[:：]|注[:：]/;
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*\*?|\{\/\*|\*\/)/.test(line))
    .map((line) => (line.includes("://") ? line : line.replace(/\/\/.*$/, "")))
    .join("\n");

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsPendingModulePage from "./ApprovalsPendingModulePage";
import { announcement } from "./gates";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function mount(entry: string): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: string) => {
    if (String(url).includes("/api/approvals")) {
      return {
        items: [
          { approvalId: "ap_h1", title: "供应商报价", status: "pending", risk: "high", createdAt: "2026-11-19T01:00:00Z" },
          { approvalId: "ap_h2", title: "批量改价", status: "pending", createdAt: "2026-11-19T02:00:00Z" },
        ],
        nextCursor: null,
      };
    }
    if (String(url).includes("/api/approval")) {
      return { approvalId: "ap_h1", title: "供应商报价", status: "pending", decisions: [] };
    }
    return { items: [] };
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsPendingModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
  await waitFor(() => !!document.querySelector('[data-testid="apv6-summary"]'), "summary bar");
}

const unmountAll = () => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
};

afterEach(unmountAll);

const el = (testid: string): Element | null => document.querySelector(`[data-testid="${testid}"]`);
const key = (node: Element | null, kind: "Enter" | " " | "Escape"): void => {
  act(() => {
    node?.dispatchEvent(new KeyboardEvent("keydown", { key: kind, bubbles: true }));
  });
};
/** 屏上文本：InfoHint 弹层里的 glossary 定义是唯一合法载体，扫描时摘掉。 */
const screenText = (): string => {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".ui-hint-pop").forEach((n) => n.remove());
  return clone.textContent ?? "";
};

describe("DU-08① 源码契约：approvals 生产文件剥注释后禁词命中 0", () => {
  const files = readdirSync("src/modules/approvals")
    .filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
    .map((f) => `src/modules/approvals/${f}`);

  it("清单非空转", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it("可见文本与 CSS 里不存在「口径／说明：／注：」词面（glossary/InfoHint 除外）", () => {
    const hits: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const body = file.endsWith(".css") ? raw.replace(/\/\*[\s\S]*?\*\//g, "") : stripComments(raw);
      body.split("\n").forEach((line, i) => {
        if (BLURB.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits, `命中 ${hits.length} 处\n${hits.join("\n")}`).toEqual([]);
  });
});

describe("DU-08② 术语单源（待处理＝glossary 一份定义）", () => {
  it("队列汇总条引 key 挂一次，弹层正文＝glossary 定义", async () => {
    await mount("/approvals");
    const hints = Array.from(document.querySelectorAll(".ui-hint"));
    const terms = hints.map((n) => n.getAttribute("data-hint-term"));
    expect(terms.filter((t) => t === "approvals.pending"), "「待处理」定义全站一份").toHaveLength(1);
    const pop = el("hint-approvals.pending-pop");
    expect(hints.some((n) => n.contains(pop)), "正文只活在弹层里").toBe(true);
    expect(pop?.textContent ?? "").toContain("待处理＝已提交且尚未盖章或驳回");
    expect(screenText(), "屏上文本不得自带第二套定义").not.toContain("已提交且尚未盖章或驳回");
  });

  it("留内联的三行元说明没被收进 hover（A3 判定）", async () => {
    await mount("/approvals");
    await act(async () => {
      (el("apv-filter-toggle") as HTMLButtonElement).click();
    });
    for (const testid of ["apv-gates-note", "apv-nav-note", "apv-sort-scope-note"]) {
      const node = el(testid);
      expect(node, `${testid} 面板展开即在屏上`).not.toBeNull();
      expect((node?.textContent ?? "").length, `${testid} 文本自足`).toBeGreaterThan(10);
      expect(node?.getAttribute("title") ?? "").not.toContain("见 title");
    }
    expect(screenText()).toContain("Esc 收起并回到该行");
  });

  it("判定文案仍同源：播报句由 (phase,count) 派生，同状态同串", async () => {
    await mount("/approvals");
    const live = el("apv-live");
    expect(live?.getAttribute("role")).toBe("status");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toBe(announcement("ready", 2));
    expect(announcement("ready", 2), "同一状态未变化必须同串（R86 不重播）").toBe(announcement("ready", 2));
    const pop = el("hint-approvals.pending-pop");
    expect(pop?.getAttribute("role"), "提示弹层不是第二个 live 区").toBe("tooltip");
    expect(pop?.hasAttribute("aria-live"), "提示弹层不带 aria-live").toBe(false);
  });
});

describe("DU-08④ 折叠区键盘序与 aria-expanded 实测同步", () => {
  it("筛选面板钮 aria-expanded 与面板在场同帧，chips 行的同值 disclosure 一起翻", async () => {
    await mount("/approvals");
    const toggle = el("apv-filter-toggle");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(el("apv-filter-panel"), "收起时面板不在场").toBeNull();
    await act(async () => {
      (toggle as HTMLButtonElement).click();
    });
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(el("apv-filter-panel"), "展开即在场").not.toBeNull();
    const summary =
      document.querySelector('[data-testid="apv-filter-summary"]') ??
      document.querySelector('[data-testid="apv-filter-summary-all"]');
    expect(summary, "chips 行（无筛选时是「无筛选」把手）在场").not.toBeNull();
    expect(summary?.getAttribute("aria-expanded"), "chips 行与面板钮同一个 filtersOpen").toBe("true");
    expect(summary?.getAttribute("aria-controls")).toBe("apv-filter-panel");
    await act(async () => {
      key(summary, "Enter");
    });
    expect(toggle?.getAttribute("aria-expanded"), "键盘 Enter 收起，aria-expanded 跟着翻").toBe("false");
    expect(el("apv-filter-panel")).toBeNull();
  });

  it("提示钮键盘可达：focus 展开、aria-expanded↔data-open 同帧、Esc 关闭回焦", async () => {
    await mount("/approvals");
    const trigger = document.querySelector('[data-testid="hint-approvals.pending"] button.ui-hint-trigger') as HTMLButtonElement;
    const pop = el("hint-approvals.pending-pop");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(pop?.getAttribute("data-open")).toBe("false");
    act(() => trigger.focus());
    act(() => trigger.dispatchEvent(new FocusEvent("focus")));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(pop?.getAttribute("data-open")).toBe("true");
    expect(trigger.getAttribute("aria-describedby")).toBe(pop!.id);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("风险档 chips（strip）在 tab 序内且 aria-pressed 与生效值一致", async () => {
    await mount("/approvals");
    await act(async () => {
      (el("apv-filter-toggle") as HTMLButtonElement).click();
    });
    const all = el("apv-risk-all") as HTMLButtonElement;
    const medium = el("apv-risk-medium") as HTMLButtonElement;
    expect(all.tagName).toBe("BUTTON");
    expect(all.getAttribute("tabindex"), "chip 不用 tabindex 改序").not.toBe("-1");
    expect(all.getAttribute("aria-pressed"), "默认全部生效").toBe("true");
    await act(async () => {
      key(all, "Enter");
    });
    await act(async () => {
      medium.click();
    });
    expect(medium.getAttribute("aria-pressed"), "点中中风险后 aria-pressed 同步").toBe("true");
    expect(all.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("DU-08⑤ 工程语言与裸 id 只进 title／详情披露", () => {
  it("屏上没有 ap_ 裸单号／unknown／英文枚举，原值留在 title", async () => {
    await mount("/approvals");
    const text = screenText();
    for (const engineering of ["ap_h1", "ap_h2", "unknown", "pending\"", "business_action", "E_NO_CITATION"]) {
      expect(text, `屏上不出现工程原值 ${engineering}`).not.toContain(engineering);
    }
    const row = document.querySelector('[data-testid="apr5-row-ap_h1"]');
    expect(row, "行仍在（判据不空转）").not.toBeNull();
    const titles = Array.from(document.querySelectorAll("[title]"))
      .map((n) => n.getAttribute("title") ?? "")
      .join("｜");
    expect(titles.length, "title 侧仍有可读的补充说明").toBeGreaterThan(0);
  });

  it("汇总条原因句仍走单源 gateReason，未复制成第二套措辞", async () => {
    await mount("/approvals");
    const scopeNote = el("apv6-summary-scope");
    expect(scopeNote?.getAttribute("title") ?? "", "分母原因句在 title 里").toContain("total");
    expect(screenText()).not.toContain("keys=[items,nextCursor]");
    expect(screenText()).toContain("非全量");
  });
});
