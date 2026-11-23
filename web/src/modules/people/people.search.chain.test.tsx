// @vitest-environment jsdom
/**
 * PE-10 — 人员目录服务端检索链（keyword + cursor）。
 *
 * 钉四件事，全部对着「本地过滤已加载 20 行」这个旧缺陷：
 *  1) 300ms 防抖窗内至多 1 根检索请求，且关键词走 `keyword=` 参数；
 *  2) 翻页只用服务端 nextCursor，未点「加载更多」绝不多发游标请求；
 *  3) 关键词变化作废在途游标——不会出现双游标并发、旧页写新列表；
 *  4) 空结果三态互斥：未接入 / 检索空（带关键词）/ 真为空（无关键词）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick, ...rest }: { children?: ReactNode; onClick?: () => void; [k: string]: unknown }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>{children}</button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className, ...rest }: { children?: ReactNode; className?: string; [k: string]: unknown }) => (
    <div className={className} {...(rest as Record<string, never>)}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import PeopleModulePage from "@/modules/people/PeopleModulePage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const q = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);

/** 台账形制：第 index 名在册员工（服务端按 keyword 过滤，与 BFF 实测一致）。 */
function ledgerRow(index: number) {
  return {
    employeeId: `emp_rank_${String(index).padStart(3, "0")}`,
    name: `员工${String(index).padStart(3, "0")}`,
    lifecycleState: "active",
  };
}

const urls = (): string[] => vi.mocked(fetchJSON).mock.calls.map((call) => String(call[0]));

/** 假服务端：在册 25 人，limit/cursor/keyword 全在「服务端」算。 */
function mockLedger(opts: { pageSize?: number } = {}) {
  const pageSize = opts.pageSize ?? 20;
  const all = Array.from({ length: 25 }, (_, i) => ledgerRow(i + 1));
  vi.mocked(fetchJSON).mockImplementation(((url: string) => {
    if (!url.includes("/api/employees")) {
      return Promise.reject(new ApiError("not found", { status: 404, body: "", url }));
    }
    const params = new URL(url, "http://local.test").searchParams;
    const keyword = params.get("keyword") ?? "";
    const cursor = params.get("cursor");
    const pool = keyword ? all.filter((row) => row.name.includes(keyword)) : all;
    const start = cursor ? Number.parseInt(cursor.replace("c:", ""), 10) || 0 : 0;
    const items = pool.slice(start, start + pageSize);
    const next = start + pageSize < pool.length ? `c:${start + pageSize}` : null;
    return Promise.resolve(next ? { items, nextCursor: next } : { items });
  }) as never);
}

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await act(async () => {});
}

async function renderPage(): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/identity?tab=people"]}>
        <PeopleModulePage />
      </MemoryRouter>,
    );
  });
  await flush();
}

async function type(text: string): Promise<void> {
  await act(async () => {
    const input = q("ppl5-search") as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("PE-10 人员目录服务端检索链", () => {
  it("防抖：连打字在 300ms 窗内零请求，过窗恰好 1 根 keyword 请求", async () => {
    mockLedger();
    await renderPage();
    const before = urls().length;
    for (const text of ["员", "员工", "员工0", "员工02", "员工021"]) await type(text);
    expect(urls().length - before, "防抖窗内不发检索请求").toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    const searchRequests = urls().filter((u) => u.includes("keyword="));
    expect(searchRequests, "一个防抖窗至多一根检索请求").toHaveLength(1);
    expect(searchRequests[0]).toContain("keyword=%E5%91%98%E5%B7%A5021");
    expect(q("ppl5-name")?.textContent).toContain("员工021");
  });

  it("未过滤首页带 limit，命中第 21+ 名靠服务端 keyword 而非本地切片", async () => {
    mockLedger();
    await renderPage();
    const first = urls()[0];
    expect(first).toContain("limit=20");
    expect(first, "无关键词不带 keyword").not.toContain("keyword=");
    expect(container.querySelectorAll('[data-testid="ppl5-row"]')).toHaveLength(20);
    expect(q("ppl5-more")).toBeTruthy();
    expect(container.textContent).toContain("服务端检索在册全量");

    await type("员工021");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    const names = Array.from(container.querySelectorAll('[data-testid="ppl5-name"]')).map((el) => el.textContent ?? "");
    expect(names, "第 21 名之后的人可被搜到").toEqual(["员工021 · PRANK021"]);
  });

  it("游标链：加载更多只用服务端 nextCursor 追加，不重发首页", async () => {
    mockLedger();
    await renderPage();
    const more = q("ppl5-more") as HTMLButtonElement;
    await act(async () => {
      more.click();
    });
    await flush();
    const cursorRequests = urls().filter((u) => u.includes("cursor="));
    expect(cursorRequests, "恰一根游标续页请求").toHaveLength(1);
    expect(cursorRequests[0]).toContain("cursor=c%3A20");
    expect(container.querySelectorAll('[data-testid="ppl5-row"]')).toHaveLength(25);
    expect(q("ppl5-more"), "已到末页不再给续页钮").toBeNull();
  });

  it("翻页在途时换关键词：旧游标结果作废，全程不出现双游标并发", async () => {
    let releasePage2: ((value: unknown) => void) | null = null;
    vi.mocked(fetchJSON).mockImplementation(((url: string) => {
      if (!url.includes("/api/employees")) {
        return Promise.reject(new ApiError("not found", { status: 404, body: "", url }));
      }
      const params = new URL(url, "http://local.test").searchParams;
      if (params.get("cursor")) {
        return new Promise((resolve) => {
          releasePage2 = resolve;
        });
      }
      const keyword = params.get("keyword") ?? "";
      const all = Array.from({ length: 25 }, (_, i) => ledgerRow(i + 1));
      const items = keyword ? all.filter((row) => row.name.includes(keyword)) : all.slice(0, 20);
      return Promise.resolve(keyword ? { items } : { items, nextCursor: "c:20" });
    }) as never);

    await renderPage();
    await act(async () => {
      (q("ppl5-more") as HTMLButtonElement).click();
    });
    await flush();
    expect((q("ppl5-more") as HTMLButtonElement).disabled, "续页在途钮禁用").toBe(true);

    await type("员工021");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    const cursorRequests = urls().filter((u) => u.includes("cursor="));
    expect(cursorRequests, "换关键词后仍只有那根已作废的游标请求").toHaveLength(1);
    expect(urls().filter((u) => u.includes("keyword="))).toHaveLength(1);

    // 迟到的旧游标页不许写回检索结果。
    await act(async () => {
      releasePage2?.({ items: [ledgerRow(21), ledgerRow(22)], nextCursor: null });
    });
    await flush();
    const names = Array.from(container.querySelectorAll('[data-testid="ppl5-name"]')).map((el) => el.textContent ?? "");
    expect(names, "检索结果不被旧游标污染").toEqual(["员工021 · PRANK021"]);
  });

  it("三态互斥：未接入 / 检索空 / 真为空 各有专属腿与原因句", async () => {
    // 未接入：候选端点全 404
    vi.mocked(fetchJSON).mockImplementation(((url: string) =>
      Promise.reject(new ApiError("not found", { status: 404, body: "", url }))) as never);
    await renderPage();
    expect(q("ppl5-unwired")?.textContent).toContain("人员目录未接入");
    expect(q("ppl5-empty")).toBeNull();
    expect(q("ppl5-nomatch")).toBeNull();
    vi.mocked(fetchJSON).mockReset();

    // 检索空：带关键词且服务端零命中
    mockLedger();
    await act(() => root.unmount());
    root = createRoot(container);
    await renderPage();
    await type("不存在的人");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    const nomatch = q("ppl5-nomatch");
    expect(nomatch?.textContent).toContain("没有匹配「不存在的人」的人员");
    expect(nomatch?.textContent).toContain("服务端已在在册全量里检索");
    expect(q("ppl5-empty"), "检索空不冒充真为空").toBeNull();
    expect(q("ppl5-nomatch-clear"), "筛空腿保留清空主操作").toBeTruthy();

    // 真为空：无关键词且台账本身没有行
    vi.mocked(fetchJSON).mockImplementation(((url: string) =>
      url.includes("/api/employees")
        ? Promise.resolve({ items: [] })
        : Promise.reject(new ApiError("not found", { status: 404, body: "", url }))) as never);
    await act(() => root.unmount());
    root = createRoot(container);
    await renderPage();
    expect(q("ppl5-empty")?.textContent).toContain("后台还没有登记在册人员");
    expect(q("ppl5-nomatch"), "真为空不带关键词文案").toBeNull();
    expect(q("ppl5-unwired"), "有响应就不是未接入").toBeNull();
    expect(container.textContent).not.toContain("共 0 人");
  });

  it("清空搜索回到在册全量，且不发双份请求", async () => {
    mockLedger();
    await renderPage();
    await type("员工021");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    const before = urls().length;
    const clear = q("ppl5-nomatch-clear") as HTMLButtonElement | null;
    await act(async () => {
      if (clear) clear.click();
      else await type("");
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    expect(urls().length - before, "清空只发 1 根无关键词请求").toBe(1);
    expect(urls()[urls().length - 1]).not.toContain("keyword=");
    expect(container.querySelectorAll('[data-testid="ppl5-row"]').length).toBeGreaterThan(0);
  });
});
