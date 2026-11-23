// @vitest-environment jsdom
/**
 * w189 样板 A — AgentFleetRail 行级钉测（UI-DIRECTION v2 §4 舰队轨 / §6②③ / §7 H1·H3·I4）。
 *
 * 几何（H1 的 320×176 / 288×168 / 260×160 矩形）在 jsdom 里量不出来，归闸脚本
 * scripts/assert-agent-rail.mjs（UI-GATE 车道）与截图腿实测；本文件钉的是 DOM 合同、
 * 轮播时钟（H3 形制：5999 毫秒不动、6000 毫秒前进一张、末步钳位、到末回首）、
 * 五种不动情形、箭头出现门槛、键盘横滚、未知态破折号与「无进度条」（I4），
 * 以及「绝不裸内部 id 上屏」（承 a8b57f… 后的 duty 短码判定）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { readFileSync } from "node:fs";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import { AgentFleetRail } from "./AgentFleetRail";
import DutyPage from "./DutyPage";
import type { EmployeeRow, Loadable } from "./types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 合成花名册：中文占位名，与任何真人无关；id 全部 emp_st_ 前缀合成值。
function emp(i: number, over: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    employeeId: `emp_st_${String(i).padStart(4, "0")}`,
    name: `值班员${i}`,
    lifecycleState: "active",
    title: "客服专员",
    ...over,
  };
}

function roster(n: number): EmployeeRow[] {
  return Array.from({ length: n }, (_, i) => emp(i + 1));
}

function ready(rows: EmployeeRow[]): Loadable<EmployeeRow[]> {
  return { k: "ready", data: rows };
}

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom 没有布局：手动把滚动壳的几何钉住（clientWidth/scrollWidth/scrollLeft/setScroll）。
function stubScroller(vp: HTMLElement, opts: { client?: number; content?: number } = {}): { get: () => number } {
  const client = opts.client ?? 324;
  const content = opts.content ?? 2384;
  let sl = 0;
  Object.defineProperty(vp, "clientWidth", { value: client, configurable: true });
  Object.defineProperty(vp, "scrollWidth", { value: content, configurable: true });
  Object.defineProperty(vp, "scrollLeft", {
    configurable: true,
    get: () => sl,
    set: (v: number) => {
      sl = v;
    },
  });
  vp.scrollTo = ((arg?: ScrollToOptions | number) => {
    const left =
      typeof arg === "object" && arg !== null && "left" in arg ? Number((arg as ScrollToOptions).left ?? 0) : Number(arg ?? 0);
    sl = left;
  }) as HTMLElement["scrollTo"];
  return { get: () => sl };
}

function stubCardWidths(scope: HTMLElement, width: number): void {
  for (const card of scope.querySelectorAll("[data-fleet-card]")) {
    (card as HTMLElement).getBoundingClientRect = () =>
      ({
        width,
        height: 160,
        top: 0,
        left: 0,
        right: width,
        bottom: 160,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

function refreshOverflow(): void {
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  stubMatchMedia(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  fetchJSON.mockReset();
  vi.useRealTimers();
});

function mount(rows: EmployeeRow[]): void {
  act(() => root.render(<AgentFleetRail employees={ready(rows)} />));
}

function mountLoadable(state: Loadable<EmployeeRow[]>): void {
  act(() => root.render(<AgentFleetRail employees={state} />));
}

describe("AgentFleetRail DOM 合同（v2 §4/§7）", () => {
  it("在册几张就几张卡；指标是破折号；没有进度条；内部 id 不裸上屏", () => {
    mount(roster(7));
    const viewport = container.querySelector("[data-fleet-viewport]");
    expect(viewport).not.toBeNull();
    expect(container.querySelectorAll("[data-fleet-card]")).toHaveLength(7);
    const metrics = container.querySelectorAll("[data-metric-value]");
    expect(metrics.length).toBeGreaterThan(0);
    for (const m of metrics) expect(m.textContent).toBe("—");
    // I4：成功率未知 ⇒ 一条进度条都不许渲染
    expect(container.querySelectorAll("[role=progressbar]")).toHaveLength(0);
    // 屏上文本绝不出现裸 emp_ 内部 id（title/属性里保留全值不算上屏）
    expect(container.textContent).not.toMatch(/emp_[0-9A-Za-z]{6,}/);
  });

  it("缺名字用工 · 短码兜底，缺角色显示破折号，都不裸 id 也不露 undefined", () => {
    mount([emp(9, { employeeId: `emp_st_${"ab".repeat(5)}`, name: undefined, title: undefined, lifecycleState: undefined })]);
    const text = container.textContent ?? "";
    expect(text).toContain("员工 ·");
    expect(text).toContain("—");
    expect(text).not.toMatch(/emp_[0-9A-Za-z]{6,}/);
    expect(text).not.toContain("undefined");
  });

  it("loading / error / 空花名册都不渲染轨", () => {
    mountLoadable({ k: "loading" });
    expect(container.querySelector("[data-fleet-viewport]")).toBeNull();
    mountLoadable({ k: "error", status: 403, message: "console.forbidden", requestId: null });
    expect(container.querySelector("[data-fleet-viewport]")).toBeNull();
    mountLoadable({ k: "ready", data: [] });
    expect(container.querySelector("[data-fleet-viewport]")).toBeNull();
  });
});

describe("轮播时钟（v2 §4 交互 / 闸 H3 形制）", () => {
  function mountedRail(rows: EmployeeRow[], step: number) {
    vi.useFakeTimers();
    mount(rows);
    const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    const sc = stubScroller(vp);
    stubCardWidths(container, step - 8);
    refreshOverflow();
    return sc;
  }

  it("5999 毫秒不动，6000 毫秒前进一张；末步钳到最大滚动位；到末回首", () => {
    const sc = mountedRail(roster(7), 268);
    act(() => {
      vi.advanceTimersByTime(5999);
    });
    expect(sc.get()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sc.get()).toBe(268);
    // 钳位：接近末端一步只走到 max（2384-324=2060）
    act(() => {
      vi.advanceTimersByTime(42000); // 6 秒一张，268→2060 需 7 步，逐步钳位
    });
    expect(sc.get()).toBe(2060);
    // 下一张回首 0
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(sc.get()).toBe(0);
  });

  it("hover、焦点在轨内、按住拖动、手动暂停、减弱动效 —— 五种情形 12 秒都不动", () => {
    const legs: Array<{ label: string; arm: (vp: HTMLElement) => void; fake?: boolean }> = [
      { label: "hover", arm: (vp) => vp.dispatchEvent(new Event("pointerover", { bubbles: true })) },
      { label: "焦点在轨内", arm: (vp) => vp.dispatchEvent(new FocusEvent("focusin", { bubbles: true })) },
      { label: "按住拖动", arm: (vp) => vp.dispatchEvent(new Event("pointerdown", { bubbles: true })) },
      {
        label: "手动暂停",
        arm: () => {
          const btn = container.querySelector("[data-testid='duty-fleet-pause']") as HTMLElement;
          act(() => btn.click());
        },
      },
      { label: "减弱动效", arm: () => {}, fake: true },
    ];
    for (const leg of legs) {
      vi.useRealTimers();
      vi.useFakeTimers();
      if (leg.fake) stubMatchMedia(true);
      mount(roster(7));
      const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
      const sc = stubScroller(vp);
      stubCardWidths(container, 260);
      refreshOverflow();
      if (leg.fake) {
        // matchMedia 在挂载时读过：减弱动效分支重新挂载一次
        act(() => root.unmount());
        root = createRoot(container);
        mount(roster(7));
        const vp2 = container.querySelector("[data-fleet-viewport]") as HTMLElement;
        stubCardWidths(container, 260);
        const sc2 = stubScroller(vp2);
        refreshOverflow();
        act(() => {
          vi.advanceTimersByTime(12000);
        });
        expect(sc2.get()).toBe(0);
        stubMatchMedia(false);
        continue;
      }
      leg.arm(vp);
      act(() => {
        vi.advanceTimersByTime(12000);
      });
      expect(sc.get(), leg.label + " 期间不应自动滚动").toBe(0);
      stubMatchMedia(false);
    }
  });

  it("恢复后重新计时：解除 hover 后从头数 6 秒才走", () => {
    vi.useFakeTimers();
    mount(roster(7));
    const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    const sc = stubScroller(vp);
    stubCardWidths(container, 260);
    refreshOverflow();
    vp.dispatchEvent(new Event("pointerover", { bubbles: true }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    vp.dispatchEvent(new Event("pointerout", { bubbles: true }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(sc.get()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(sc.get()).toBe(268);
  });

  it("没溢出就不轮播、也不给暂停钮", () => {
    vi.useFakeTimers();
    mount(roster(2));
    const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    const sc = stubScroller(vp, { client: 1280, content: 648 });
    stubCardWidths(container, 320);
    refreshOverflow();
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(sc.get()).toBe(0);
    expect(container.querySelector("[data-testid='duty-fleet-pause']")).toBeNull();
  });
});

describe("箭头门槛与手动横滚（v2 §4 交互）", () => {
  it("溢出且 ≥8 张才有前后箭头；7 张没有", () => {
    mount(roster(7));
    let vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    stubScroller(vp);
    refreshOverflow();
    expect(container.querySelectorAll("[data-testid='duty-fleet-prev'],[data-testid='duty-fleet-next']")).toHaveLength(0);
    act(() => root.unmount());
    root = createRoot(container);
    mount(roster(8));
    vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    stubScroller(vp);
    refreshOverflow();
    expect(container.querySelectorAll("[data-testid='duty-fleet-prev'],[data-testid='duty-fleet-next']")).toHaveLength(2);
  });

  it("箭头钳位：开头往前仍 0，往后走一张；到头再走不过界", () => {
    mount(roster(9));
    const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    const sc = stubScroller(vp, { client: 324, content: 9 * 268 });
    stubCardWidths(vp, 260);
    refreshOverflow();
    const prev = container.querySelector("[data-testid='duty-fleet-prev']") as HTMLElement;
    const next = container.querySelector("[data-testid='duty-fleet-next']") as HTMLElement;
    act(() => prev.click());
    expect(sc.get()).toBe(0);
    act(() => next.click());
    expect(sc.get()).toBe(268);
    act(() => vp.scrollTo({ left: 9 * 268 - 324 }));
    act(() => next.click());
    expect(sc.get()).toBe(9 * 268 - 324);
  });

  it("视口聚焦后 ←→ 各走一张并钳位", () => {
    mount(roster(7));
    const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    const sc = stubScroller(vp);
    stubCardWidths(container, 260);
    refreshOverflow();
    const right = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
    const left = new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true });
    act(() => {
      vp.dispatchEvent(right);
    });
    expect(sc.get()).toBe(268);
    act(() => {
      vp.dispatchEvent(right);
    });
    expect(sc.get()).toBe(536);
    act(() => {
      vp.dispatchEvent(left);
    });
    expect(sc.get()).toBe(268);
    act(() => vp.scrollTo({ left: 0 }));
    act(() => {
      vp.dispatchEvent(left);
    });
    expect(sc.get()).toBe(0);
  });

  it("暂停/继续轮播按钮中文标签随状态切换", () => {
    mount(roster(7));
    const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    stubScroller(vp);
    refreshOverflow();
    const btn = container.querySelector("[data-testid='duty-fleet-pause']") as HTMLButtonElement;
    expect(btn.textContent).toContain("暂停轮播");
    act(() => btn.click());
    expect(btn.textContent).toContain("继续轮播");
    act(() => btn.click());
    expect(btn.textContent).toContain("暂停轮播");
  });
});

describe("DU-03 增量：①禁空壳 / ③键盘可见落点 / ④减动可手滚", () => {
  it("①第③层禁空壳：卡内只有 ①② 两层容器，部门/能力标签的占位元素一个都不存在", () => {
    mount(roster(4));
    const cards = Array.from(container.querySelectorAll("[data-fleet-card]"));
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      // 卡面只留 l1（身份）+ l2（未知指标）两层；第③层连空 div 都不给
      expect((card as HTMLElement).children).toHaveLength(2);
    }
    expect(
      container.querySelector("[data-fleet-l3],[data-fleet-dept],[data-fleet-tags],.duty-fleet-l3"),
    ).toBeNull();
  });

  it("③轨道可 Tab 进入（tabIndex=0＋中文组名），focus 有可见描边（CSS 源码契约，dutyPage.test 同形制）", () => {
    mount(roster(3));
    const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    expect(vp.getAttribute("tabindex")).toBe("0");
    expect(vp.getAttribute("role")).toBe("group");
    expect(vp.getAttribute("aria-label") ?? "").toContain("舰队");
    const css = readFileSync("src/modules/duty/duty.css", "utf8");
    expect(css, "DU-03③：轨道焦点必须可见，描边与前后箭头同值").toMatch(
      /\.duty-fleet-viewport:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-primary\)/,
    );
  });

  it("④减动偏好：时钟挂起 12 秒不自动走，但键盘 ←→ 与箭头钮仍可逐个换卡", () => {
    vi.useFakeTimers();
    stubMatchMedia(true);
    mount(roster(9));
    const vp = container.querySelector("[data-fleet-viewport]") as HTMLElement;
    const sc = stubScroller(vp, { client: 324, content: 9 * 268 });
    stubCardWidths(container, 260);
    refreshOverflow();
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(sc.get(), "reduced-motion：自动轮播必须挂起").toBe(0);
    act(() => {
      vp.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(sc.get(), "手动键盘横滚不受减动偏好限制").toBe(268);
    const next = container.querySelector("[data-testid='duty-fleet-next']") as HTMLElement;
    expect(next).not.toBeNull();
    act(() => next.click());
    expect(sc.get()).toBe(536);
    stubMatchMedia(false);
  });
});

describe("DU-03 页面级：折叠区承接第③层缺口说明（mock @/lib/api，形制照 duty.slotClause5）", () => {
  const rosterBody = {
    items: [
      { employeeId: "emp_st_0000123456789", name: "值班员1", lifecycleState: "active", title: "客服专员" },
      { employeeId: "emp_st_0000987654321", name: "值班员2", lifecycleState: "paused", title: "工单专员" },
    ],
  };

  async function renderPage(): Promise<void> {
    fetchJSON.mockImplementation(async (u: unknown) => {
      const url = String(u);
      if (url.includes("/employees")) return rosterBody;
      return { items: [] };
    });
    await act(async () => {
      root.render(
        <MemoryRouter>
          <DutyPage />
        </MemoryRouter>,
      );
    });
    await act(async () => {});
  }

  it("折叠区有第③层缺口说明（与真响应口径一致：无能力标签列、部门多空值、待 /api/matrix 扩列），轨实渲且页面零进度条、零裸 id", async () => {
    await renderPage();
    const rail = container.querySelector('[data-testid="duty-fleet-rail"]');
    expect(rail, "花名册 ready 时轨道必须实渲").not.toBeNull();
    expect(container.querySelectorAll("[data-fleet-card]")).toHaveLength(2);
    const note = container.querySelector('[data-testid="duty-fleet-l3-note"]');
    expect(note, "DU-03①：第③层缺口必须在卡外折叠区写明").not.toBeNull();
    expect(note!.textContent).toContain("舰队轨第③层未显示");
    expect(note!.textContent).toContain("花名册无能力标签列");
    expect(note!.textContent).toContain("待 /api/matrix 扩列");
    // 诚实红线：现网 department 有键且有值，屏上不得谎称「无数据源」
    expect(note!.textContent).not.toContain("无数据源");
    // 说明行属折叠区（details 内），不占卡面
    expect(container.querySelector("details [data-testid='duty-fleet-l3-note']")).not.toBeNull();
    // I4 页面级再钉一遍：未知态全页零进度条
    expect(container.querySelectorAll("[role=progressbar]")).toHaveLength(0);
    // 屏上无裸内部 id（含短码文本），全值只进 title（READY-BACKLOG L52 腿保持）
    expect(rail!.textContent).not.toMatch(/emp_[0-9A-Za-z]{6,}/);
    const cardTitle = container.querySelector("[data-fleet-card]")!.getAttribute("title") ?? "";
    expect(cardTitle).toContain("emp_st_0000123456789");
  });
});
