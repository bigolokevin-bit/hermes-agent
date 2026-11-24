// @vitest-environment jsdom
/**
 * PE-01 — 翻页位置进 URL + 刷新回同位（游标契约）。
 *
 * 锁四件事：
 *  ① 翻页成功 → URL 出现 cursor=<服务端给出的下一页游标>；到末页 → 键消失、
 *    「已到末页」在（口径与 employees.paging.test.tsx 同源，只多锁 URL 键位）。
 *  ② 挂载带 ?cursor= → 从第一页起按「每页响应自己给出的游标」逐页续取回原位，
 *    计数区出现 emp-list-cursor-restored 诚实说明；链接里那枚游标值本身
 *    一次都不发出去（fetch 调用序列断言 = 不做盲重放）。
 *  ③ 数据变短（链上游标耗尽）→ 诚实停在真实末页、清键、说明写明原因。
 *  ④ 续取腿失败 → 不碰 URL（失败态不写键位），错误卡与说明同时在场。
 *  ⑤ 翻页留下 cursor 键后，任何筛选/排序/清除都一并清键（防残留旧位）。
 *
 * 现网取证（同参重复游标可稳定取回同集合）见 docs/_artifacts/PE-01/DONE.md：
 * 正因为稳定，恢复口径升级为「按响应链确定性续取」而非只做状态回显。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The ui barrel pulls in .webp assets node cannot load; stub the four
// primitives the page uses (deep-path imports would change product code).
vi.mock("@nous-research/ui", () => ({
  Badge: (props: Record<string, unknown>) => <span {...drop(props, ["className"])} />,
  Button: (props: Record<string, unknown>) => <button {...drop(props, ["outlined", "size", "prefix"])} />,
  Card: (props: Record<string, unknown>) => <div {...drop(props, ["className"])} />,
  CardContent: (props: Record<string, unknown>) => <div {...drop(props, ["className"])} />,
}));

function drop(props: Record<string, unknown>, strip: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!strip.includes(k)) out[k] = v;
  }
  return out;
}

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import { ApiError } from "@/lib/api-error";
import { EmployeesModulePage } from "./EmployeesModulePage";
import { pickOption } from "@/shell/selectHarness";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const A = { employeeId: "emp_A1B2C3D4E5F6", name: "甲一", title: "增长", lifecycleState: "active", updatedAt: "2026-11-19T01:00:00Z", department: "增长组" };
const B = { employeeId: "emp_B2C3D4E5F6A7", name: "乙二", title: "运维", lifecycleState: "paused", updatedAt: null, department: "运维组" };
const C = { employeeId: "emp_C3D4E5F6A7B8", name: "丙三", title: "数据", lifecycleState: "active", updatedAt: "2026-11-18T00:00:00Z", department: "增长组" };
const D = { employeeId: "emp_D4E5F6A7B8C9", name: "丁四", title: "质检", lifecycleState: "active", updatedAt: "2026-11-17T00:00:00Z", department: "运维组" };

const PAGE1 = { items: [A, B], nextCursor: "pc-2" };
const PAGE2 = { items: [C], nextCursor: "pc-3" };
const PAGE3 = { items: [D] }; // 末页：服务端不给 nextCursor

let root: Root | null = null;

function LocProbe() {
  const loc = useLocation();
  useEffect(() => {
    document.body.setAttribute("data-last-search", loc.search);
  }, [loc.search]);
  return null;
}

beforeEach(() => {
  document.body.removeAttribute("data-last-search");
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  fetchJSON.mockReset();
});

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const search = (): string => document.body.getAttribute("data-last-search") ?? "";
const urlCursor = (): string | null => new URLSearchParams(search()).get("cursor");
const rowIds = (): string[] =>
  Array.from(document.querySelectorAll('[data-testid^="employees-row-emp_"]')).map((el) =>
    String(el.getAttribute("data-testid")).replace("employees-row-", ""),
  );
const urls = (): string[] => fetchJSON.mock.calls.map((c) => String(c[0]));
const listUrls = (): string[] => urls().filter((u) => u.includes("/api/employees?"));

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
  // MemoryRouter ignores initialEntries updates on an existing tree — a
  // remount (the refresh equivalent) must start from a fresh root.
  await act(async () => {
    root?.unmount();
  });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[entry]}>
        <EmployeesModulePage />
        <LocProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const renderList = (entry = "/employees") => render(entry);

/** 游标三页链：cursor=pc-2 → 第 2 页，cursor=pc-3 → 第 3 页（末页）。 */
function serveChain(): void {
  fetchJSON.mockImplementation(async (url: unknown) => {
    const u = String(url);
    if (u.includes("cursor=pc-3")) return PAGE3;
    if (u.includes("cursor=pc-2")) return PAGE2;
    if (u.includes("/api/employees?")) return PAGE1;
    return {};
  });
}

async function clickMore(): Promise<void> {
  const more = q("emp-list-page-more") as HTMLButtonElement | null;
  expect(more, "more button").toBeTruthy();
  expect(more!.disabled, "more enabled while a cursor is in hand").toBe(false);
  await act(async () => {
    more!.click();
  });
  await waitFor(() => (q("emp-list-page-more") as HTMLButtonElement).textContent === "加载更多", "more settled");
}

/** 挂载带游标时，等恢复链跑完（说明行是链路的最后一步）。 */
async function waitRestore(): Promise<void> {
  await waitFor(() => q("emp-list-cursor-restored") !== null, "restore note appeared");
}

describe("PE-01 cursor position in the URL", () => {
  it("writes the server's next-page cursor on every page and drops the key at the end", async () => {
    serveChain();
    await renderList();
    expect(rowIds()).toEqual(["emp_A1B2C3D4E5F6", "emp_B2C3D4E5F6A7"]);
    // 首页不宣称位置：没有翻页就没有键位可写。
    expect(search(), "first page claims no position").not.toContain("cursor=");

    await clickMore();
    expect(urlCursor(), "第 2 页写入服务端给出的下一页游标").toBe("pc-3");
    expect(rowIds()).toHaveLength(3);

    await clickMore();
    expect(urlCursor(), "末页没有游标即删键").toBeNull();
    expect(rowIds()).toEqual([
      "emp_A1B2C3D4E5F6",
      "emp_B2C3D4E5F6A7",
      "emp_C3D4E5F6A7B8",
      "emp_D4E5F6A7B8C9",
    ]);
    expect(q("emp-list-page-end")?.textContent).toBe("已到末页");
    expect(q("emp-list-page-count")?.textContent).toBe("总数不可用 · 已显示 4 人");
    expect(q("emp-list-cursor-restored"), "手动翻页不出现恢复说明").toBeNull();
  });

  it("replays the response chain back to the linked position and never sends the linked cursor itself", async () => {
    serveChain();
    await renderList("/employees?cursor=pc-3");
    await waitRestore();

    // 原位 = 甲一/乙二/丙三（pc-3 是第 2 页响应给出的下一页游标）。
    expect(rowIds()).toEqual(["emp_A1B2C3D4E5F6", "emp_B2C3D4E5F6A7", "emp_C3D4E5F6A7B8"]);
    expect(urlCursor(), "到位后键位仍是同一枚游标").toBe("pc-3");
    expect(q("emp-list-cursor-restored")?.textContent).toBe("已从链接位置恢复 · 自动续取 1 页");
    expect(q("emp-list-page-end"), "未到末页不宣称到末页").toBeNull();

    const legs = listUrls();
    expect(legs[0], "第一腿照常从首页取，不带 cursor").not.toContain("cursor=");
    expect(legs[1], "续取用第 1 页响应自己给出的游标").toContain("cursor=pc-2");
    expect(legs, "恰两腿：到位即停，不多猜一页").toHaveLength(2);
    expect(
      legs.filter((u) => u.includes("cursor=pc-3")),
      "链接里那枚游标从不外发（不做盲重放）",
    ).toHaveLength(0);
  });

  it("stops honestly at the real last page when the data got shorter than the link", async () => {
    fetchJSON.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("cursor=")) return { items: [C] }; // 数据变短：第二页就是末页
      if (u.includes("/api/employees?")) return PAGE1;
      return {};
    });
    await renderList("/employees?cursor=pc-9");
    await waitRestore();

    expect(rowIds()).toHaveLength(3);
    expect(q("emp-list-cursor-restored")?.textContent).toBe("原链接位置超出当前数据：已停在真实末页");
    expect(urlCursor(), "位置已不存在：键位如实清掉").toBeNull();
    expect(q("emp-list-page-end")?.textContent).toBe("已到末页");
    expect(listUrls().filter((u) => u.includes("cursor=pc-9")), "陈旧游标没有被赌一次").toHaveLength(0);
  });

  it("leaves the URL alone when a restore leg fails, and says so", async () => {
    fetchJSON.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("cursor=pc-2"))
        throw new ApiError("boom", { status: 500, body: JSON.stringify({ message: "上游炸了" }), url: u, requestId: "req-pe01" });
      if (u.includes("/api/employees?")) return PAGE1;
      return {};
    });
    await renderList("/employees?cursor=pc-3");
    await waitRestore();

    expect(q("emp-list-cursor-restored")?.textContent).toContain("续取失败");
    expect(q("emp-list-state-error"), "错误卡按既有形制上屏").toBeTruthy();
    expect(urlCursor(), "失败态不写 URL：键位保持挂载时的值").toBe("pc-3");
  });

  it("any filter, sort or clear click wipes a lingering cursor key before the next page is fetched", async () => {
    serveChain();
    // 每一档都从「刷新回首页 → 翻一页」的同一前置起，只验交互那一步清键。
    const wipe = async (label: string, entry: string, interact: () => Promise<void>) => {
      await renderList(entry);
      await clickMore();
      expect(urlCursor(), `${label}：翻页后 URL 有位`).toBe("pc-3");
      await interact();
      expect(urlCursor(), `${label} 变化必须清掉位置键`).toBeNull();
    };

    await wipe("部门筛选", "/employees", async () => {
      await pickOption("emp-list-dept-select", "增长组");
    });

    await wipe("排序", "/employees", async () => {
      await act(async () => {
        (q("emp-list-sort-name") as HTMLButtonElement).click();
      });
    });

    await wipe("lifecycle", "/employees", async () => {
      await pickOption("employees-lifecycle", "在岗");
    });
    const legs = listUrls();
    expect(legs[legs.length - 1], "lifecycle 换筛选的新腿不带旧 cursor").not.toContain("cursor=");

    await wipe("清除筛选", "/employees?q=zz", async () => {
      await act(async () => {
        (q("employees-clear") as HTMLButtonElement).click();
      });
    });
  });

  it("a refresh restarts at page one and voids the linked position instead of gambling on it", async () => {
    serveChain();
    await renderList("/employees?cursor=pc-3");
    await waitRestore();
    expect(rowIds()).toHaveLength(3);

    await act(async () => {
      (q("employees-refresh") as HTMLButtonElement).click();
    });
    await waitFor(() => rowIds().length === 2, "back to page one");
    const legs = listUrls();
    expect(legs.filter((u) => u.includes("cursor=pc-3")), "刷新不拿链接游标赌一次").toHaveLength(0);
    expect(urlCursor(), "刷新后位置键作废").toBeNull();
    expect(q("emp-list-cursor-restored"), "刷新后说明行随之消失").toBeNull();
  });
});
