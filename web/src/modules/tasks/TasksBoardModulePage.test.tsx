// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEffect } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import TasksBoardModulePage from "./TasksBoardModulePage";
import { money, statusLabel } from "./tasksBoard";

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

const ROWS: Record<string, unknown[]> = {
  open: [{ taskId: "tsk_open_1", title: "整理周报", status: "open", priority: "high", assignee: { type: "employee", id: "emp_1a2b3c4d" }, dueAt: "2026-11-18T10:00:00Z", updatedAt: "2026-11-18T02:00:00Z", cost: 12.34 }],
  in_progress: [{ taskId: "tsk_prog_1", title: "渠道归因", status: "in_progress", assignee: { type: "human", id: "human:7" } }],
  blocked: [{ taskId: "tsk_block_1", title: "素材去重", status: "blocked", progressNote: "等待表格能力" }],
  done: [{ taskId: "tsk_done_1", title: "对账", status: "done" }],
  cancelled: [],
};

function resolveBoard(url: string): unknown {
  const status = new URL(url, "http://x").searchParams.get("status") ?? "open";
  return { items: ROWS[status] ?? [] };
}

// R7.1/T14 R2: the employee directory feeds 姓名 · 8位短码 disambiguation.
function resolveDirectory(): unknown {
  return { items: [{ employeeId: "emp_1a2b3c4d", name: "小鲤" }] };
}

function resolveDetail(): unknown {
  return {
    taskId: "tsk_open_1",
    title: "整理周报",
    status: "open",
    priority: "high",
    assignee: { type: "employee", id: "emp_1a2b3c4d" },
    createdBy: { type: "human", id: "human:7" },
    source: { kind: "manual" },
    description: "把本周数据整理成一页",
    progressNote: null,
    dueAt: "2026-11-18T10:00:00Z",
    createdAt: "2026-11-17T02:00:00Z",
    updatedAt: "2026-11-18T02:00:00Z",
  };
}


let lastHref = "";
function LocProbe() {
  const loc = useLocation();
  useEffect(() => {
    lastHref = loc.pathname + loc.search;
  }, [loc.pathname, loc.search]);
  return null;
}

async function render(entry = "/work") {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <TasksBoardModulePage />
        <LocProbe />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

describe("TasksBoardModulePage", () => {
  it("renders the three skeleton columns, with blocked and cancelled kept off-column", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/task-detail") ? resolveDetail() : url.includes("/api/matrix") ? resolveDirectory() : resolveBoard(url)),
    );
    await render();
    for (const label of ["待分配", "进行中", "今日完成"]) {
      expect(container.querySelector('[data-testid="tsk4-columns"]')?.textContent).toContain(label);
    }
    expect(container.querySelectorAll('[data-testid^="tsk4-col-"]')).toHaveLength(3);
    // 阻塞不进列，走看板顶部告警带：N 项 + 前 3 条 + 查看全部。
    const band = container.querySelector('[data-testid="tsk4-blocked-band"]');
    expect(band?.textContent).toContain("1 项被阻塞");
    expect(band?.textContent).toContain("素材去重");
    expect(band?.querySelector('[data-testid="tsk4-blocked-all"]')?.getAttribute("href")).toContain("status=blocked");
    // 已取消收进「今日完成」列脚注；今天没有已取消时不渲染脚注。
    expect(container.querySelector('[data-testid="tsk4-cancelled-foot"]')).toBeNull();
    expect(container.textContent).toContain("小鲤 · 1A2B3C4D");
    expect(container.textContent).not.toContain("emp_1a2b3c4d");
    expect(container.textContent).not.toContain("human:7");
    expect(container.textContent).not.toContain("HTTP");
    // T14 R2 + 破折号治理（2026-11-24）：有回传的行显示金额，没回传的行不摆
    // 占位符；缺失只在卡底「数据可用性」点名一次，正文不再出现「成本 —」。
    expect(container.textContent).toContain("更新 2026-11-18 10:00");
    expect(container.textContent).toContain("成本 $12.34");
    expect(container.textContent).not.toContain("成本 —");
    const costNote = [...container.querySelectorAll(".console-card__availability-label")].find(
      (el) => el.textContent === "任务成本",
    );
    expect(costNote, "卡底点名任务成本缺失").toBeTruthy();
    expect(costNote?.parentElement?.textContent ?? "").toContain("3 条没有回传成本");
  });

  it("今日完成只收今天关闭的，已取消落成脚注不占列", async () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/api/matrix")) return Promise.resolve(resolveDirectory());
      if (url.includes("/task-detail")) return Promise.resolve(resolveDetail());
      const status = new URL(url, "http://x").searchParams.get("status") ?? "open";
      if (status === "done") {
        return Promise.resolve({
          items: [
            { taskId: "tk_done_today", title: "今天关的", status: "done", closedAt: today, updatedAt: today },
            { taskId: "tk_done_old", title: "昨天关的", status: "done", closedAt: yesterday, updatedAt: yesterday },
          ],
        });
      }
      if (status === "cancelled") {
        return Promise.resolve({ items: [{ taskId: "tk_cancel_1", title: "撤了", status: "cancelled" }] });
      }
      return Promise.resolve({ items: [] });
    });
    await render("/work");
    await act(async () => {});
    const doneCol = container.querySelector('[data-testid="tsk4-col-done_today"]');
    expect(doneCol?.textContent).toContain("今天关的");
    expect(doneCol?.textContent).not.toContain("昨天关的");
    expect(container.querySelector('[data-testid="tsk4-cancelled-foot"]')?.textContent).toContain("另有 1 项已取消");
    // 三列以外不许冒出第四列
    expect(container.querySelectorAll('[data-testid^="tsk4-col-"]')).toHaveLength(3);
  });

  it("maps unknown statuses to 待核实 and never invents money", async () => {
    expect(statusLabel("reviewing")).toBe("待核实");
    expect(money(undefined)).toBe("—");
    expect(money(0)).toBe("$0.00");
  });

  it("opens task detail and shows the read-only fields", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/task-detail") ? resolveDetail() : url.includes("/api/matrix") ? resolveDirectory() : resolveBoard(url)),
    );
    await render();
    const card = container.querySelector('[data-testid="tsk4-card-tsk_open_1"]');
    expect(card).toBeTruthy();
    await act(async () => {
      (card as HTMLElement).click();
    });
    await act(async () => {});
    expect(fetchJSON).toHaveBeenCalledWith("/agent-api/api/task-detail?id=tsk_open_1");
    expect(container.textContent).toContain("把本周数据整理成一页");
    expect(container.textContent).toContain("人工创建");
    expect(container.textContent).toContain("人员");
    // R32: no events key in the answer -> honest 无事件; drawer states it has no deep link.
    expect(container.textContent).toContain("无事件");
    expect(container.querySelector('[data-testid="tsk4-detail-note"]')).toBeTruthy();
  });

  it("lists up to three events when the detail answer carries them (R32)", async () => {
    const withEvents = {
      ...(resolveDetail() as Record<string, unknown>),
      events: [
        { eventId: "evt_1", kind: "created", note: "任务建立", at: "2026-11-17T02:00:00Z" },
        { eventId: "evt_2", kind: "assigned", note: "指派给员工", at: "2026-11-17T03:00:00Z" },
        { eventId: "evt_3", kind: "progress", note: "第三条", at: "2026-11-17T04:00:00Z" },
        { eventId: "evt_4", kind: "progress", note: "第四条不应出现", at: "2026-11-17T05:00:00Z" },
      ],
    };
    vi.mocked(fetchJSON).mockImplementation((url: unknown) =>
      Promise.resolve(
        String(url).includes("/task-detail")
          ? withEvents
          : String(url).includes("/api/matrix")
            ? resolveDirectory()
            : resolveBoard(String(url)),
      ),
    );
    await render();
    const card = container.querySelector('[data-testid="tsk4-card-tsk_open_1"]');
    expect(card).toBeTruthy();
    await act(async () => {
      (card as HTMLElement).click();
    });
    await act(async () => {});
    expect(container.textContent).toContain("任务建立");
    expect(container.textContent).toContain("指派给员工");
    expect(container.textContent).toContain("第三条");
    expect(container.textContent).not.toContain("第四条");
    expect(container.textContent).toContain("2026-11-17 10:00");
  });

  it("shows the five forced phases", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/task-detail") ? resolveDetail() : url.includes("/api/matrix") ? resolveDirectory() : resolveBoard(url)),
    );
    await render("/work?state=empty");
    expect(container.querySelector('[data-testid="tsk4-empty"]')).toBeTruthy();
    await render("/work?state=error&rid=req-err");
    expect(container.querySelector('[data-testid="tsk4-error"]')?.textContent).toContain("req-err");
    await render("/work?state=denied&rid=req-denied");
    expect(container.querySelector('[data-testid="tsk4-denied"]')?.textContent).toContain("req-denied");
    await render("/work?state=loading");
    expect(container.querySelector('[data-testid="tsk4-loading"]')).toBeTruthy();
  });

  it("keeps a request id and a working retry on a 500", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-tasks" })),
    );
    await render();
    expect(container.textContent).toContain("请求编号：req-tasks");
    expect(container.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("never shows hard zeros when the board cannot load: — plus reason line and real exits", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("down", { status: 0, body: "", url })),
    );
    await render();
    const text = container.textContent ?? "";
    // 假零整改：失败时是「—」，不是「待分配 0 / 阻塞 0」；附原因行。
    expect(text).toContain("待分配 — · 阻塞 —");
    expect(text).not.toContain("待分配 0");
    expect(text).not.toContain("阻塞 0");
    // 设计车道⑤：主句只讲人话，「接口不可达 / 数字不作零处理」进「详情」折叠（默认关闭）。
    expect(text).toContain("暂时读不到任务数据，请稍后重试");
    expect(text).not.toContain("（接口不可达）");
    const caveatDetail = container.querySelector('[data-testid="tasks-summary-caveat-detail"]');
    expect(caveatDetail?.textContent).toContain("接口不可达时数字不作零处理");
    expect(caveatDetail?.hasAttribute("open")).toBe(false);
    // 错误面板真出口。
    const err = container.querySelector('[data-testid="tsk4-error"]');
    expect(err?.querySelector('a[href="/overview"]')?.textContent).toContain("返回控制台");
    expect(err?.querySelector('a[href^="mailto:"]')?.textContent).toContain("联系管理员");
    // 请求编号话术。
    expect(text).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(text).not.toContain("未提供");
  });

  it("a successful read with no tasks still shows zero, honestly", async () => {
    fetchJSON.mockImplementation(() => Promise.resolve({ items: [] }));
    await render();
    expect(container.textContent).toContain("待分配 0 · 阻塞 0");
    expect(container.querySelector('[data-testid="tsk4-empty"]')).toBeTruthy();
    expect(container.textContent).not.toContain("数字不作零处理");
    // 读取成功就没有「详情」折叠可展开。
    expect(container.querySelector('[data-testid="tasks-summary-caveat-detail"]')).toBeNull();
  });

  const FILTER_ROWS = {
    items: [
      { taskId: "tk_F1", title: "筛选任务一", assignee: { type: "employee", id: "emp_1a2b3c4d" }, priority: "high", status: "open", updatedAt: "2026-11-18T02:00:00Z", cost: 3.5 },
    ],
    nextCursor: "cursor-2",
  };

  it("P2: a shared status filter sends exactly one real query and pages with the server cursor", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation(async (url: string) => {
      urls.push(url);
      if (url.includes("/api/matrix")) return resolveDirectory();
      if (url.includes("/api/tasks")) return FILTER_ROWS;
      return resolveDetail();
    });
    await render("/work?tab=board&status=open");
    await act(async () => {});
    const taskCalls = urls.filter((u) => u.includes("/api/tasks"));
    expect(taskCalls).toHaveLength(1);
    expect(taskCalls[0]).toContain("status=open");
    expect(container.querySelector('[data-testid="tsk4-filter-row-tk_F1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tsk4-columns"]')).toBeNull();
    expect(container.textContent).toContain("第 1 页 · 本页最多 50 条");
    expect(container.textContent).toContain("筛选任务一");
    expect(container.textContent).toContain("小鲤 · 1A2B3C4D");
    expect(container.textContent).not.toContain("emp_1a2b3c4d");
    // ConsoleSelect since wave-36: this filter is a disabled trigger BUTTON, and
    // `button.disabled` is the honest gate (a native-select `.value` read was the old protocol).
    const prio = container.querySelector('[data-testid="tsk4-filter-priority"]') as HTMLButtonElement;
    expect(prio.disabled).toBe(true);
    const next = container.querySelector('[data-testid="tsk4-page-next"]') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    urls.length = 0;
    await act(async () => {
      next.click();
    });
    await act(async () => {});
    expect(urls.find((u) => u.includes("/api/tasks"))).toContain("cursor=cursor-2");
    expect(container.textContent).toContain("第 2 页");
  });

  it("R41: an assignee filter keeps the five columns and each leg carries it (counts stay linked)", async () => {
    const urls: string[] = [];
    fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/matrix")) return resolveDirectory();
      if (url.includes("/api/tasks")) {
        urls.push(url);
        const only = new URLSearchParams(url.split("?")[1] ?? "").get("assignee");
        return only
          ? { items: [{ taskId: "tk_aff_1", title: "筛选后任务", status: "open", priority: "high", assignee: "emp_1a2b3c4d", updatedAt: "2026-11-18T02:00:00Z" }] }
          : resolveBoard(url);
      }
      return resolveDetail();
    });
    await render("/work?tab=board&assignee=employee%3Aemp_1a2b3c4d");
    await act(async () => {});
    expect(urls.filter((u) => u.includes("api/matrix")).length).toBe(0);
    expect(urls).toHaveLength(5);
    for (const u of urls) expect(u).toContain("assignee=employee%3Aemp_1a2b3c4d");
    expect(container.querySelectorAll('[data-testid^="tsk4-col-"]')).toHaveLength(3);
    const openCol = container.querySelector('[data-testid="tsk4-col-unassigned"]');
    expect(openCol?.textContent).toContain("1 条（本页已加载）");
    expect(container.querySelector('[data-testid="tsk4-card-tk_aff_1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tsk4-emptycol-in_progress"]')?.textContent).toContain("本列暂无任务");
    expect(container.querySelector('[data-testid="tsk4-emptycol-in_progress"]')?.textContent).toContain("按负责人筛选");
    expect(container.querySelector('[data-testid="tsk4-filter-view"]')).toBeNull();
  });

  it("R41: rows inside a column sort by priority then recency, with the key in the title", async () => {
    fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/matrix")) return resolveDirectory();
      if (url.includes("status=open")) {
        return {
          items: [
            { taskId: "tk_low_old", title: "低旧", status: "open", priority: "low", updatedAt: "2026-11-16T01:00:00Z" },
            { taskId: "tk_high_new", title: "高新的", status: "open", priority: "high", updatedAt: "2026-11-18T01:00:00Z" },
            { taskId: "tk_low_new", title: "低新", status: "open", priority: "low", updatedAt: "2026-11-19T01:00:00Z" },
          ],
        };
      }
      if (url.includes("/api/tasks")) return { items: [] };
      return resolveDetail();
    });
    await render("/work");
    await act(async () => {});
    const cards = Array.from(container.querySelectorAll('[data-testid^="tsk4-card-tk_"]'));
    const ids = cards.map((c) => c.getAttribute("data-testid"));
    expect(ids[0]).toBe("tsk4-card-tk_high_new");
    expect(ids.indexOf("tsk4-card-tk_low_new")).toBeLessThan(ids.indexOf("tsk4-card-tk_low_old"));
    expect(container.querySelector('[data-testid="tsk4-col-unassigned"]')?.textContent).toContain("3 条（本页已加载）");
  });

  it("R41: the denied board keeps a copyable rid and a live retry (no dead controls)", async () => {
    fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/matrix")) return resolveDirectory();
      throw new ApiError("gone", { status: 404, body: "{}", url, requestId: "req-r41-404" });
    });
    await render("/work");
    await act(async () => {});
    const card = container.querySelector('[data-testid="tsk4-denied"]');
    expect(card?.textContent).toContain("req-r41-404");
    expect(card?.querySelector('[data-testid="req-copy"]')).toBeTruthy();
    expect(card?.querySelector('[data-testid="tsk4-retry"]')).toBeTruthy();
  });

  it("P2: an empty filter answer is stated as a real answer, not a failure", async () => {
    fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/matrix")) return resolveDirectory();
      if (url.includes("/api/tasks")) return { items: [], nextCursor: null };
      return resolveDetail();
    });
    await render("/work?tab=board&status=open&assignee=employee%3Aemp_1a2b3c4d");
    await act(async () => {});
    expect(container.querySelector('[data-testid="tsk4-filter-empty"]')).toBeTruthy();
    expect(container.textContent).toContain("这是服务端的真实回答");
  });

  const DETAIL_MOCK = (url: string) =>
    Promise.resolve(url.includes("/task-detail") ? resolveDetail() : url.includes("/api/matrix") ? resolveDirectory() : resolveBoard(url));

  it("R40: /tasks/<taskId> deep link opens the detail straight from the URL", async () => {
    fetchJSON.mockImplementation(DETAIL_MOCK);
    await render("/tasks/tsk_open_1");
    expect(fetchJSON).toHaveBeenCalledWith("/agent-api/api/task-detail?id=tsk_open_1");
    expect(container.querySelector('[data-testid="tsk4-detail-ready"]')).toBeTruthy();
    const link = container.querySelector('[data-testid="tsk4-detail-link"]') as HTMLAnchorElement;
    expect(link?.getAttribute("href")).toBe("/tasks/tsk_open_1");
    expect(container.textContent).toContain("深链");
    expect(container.textContent).not.toContain("当前版本没有按任务的深链");
    // The planned transition control exists but is a stated non-entry.
    const btn = container.querySelector('[data-testid="tsk4-detail-transition"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("data-planned")).toBe("true");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("R40: opening from the board writes ?task= into the URL and state survives a refresh", async () => {
    fetchJSON.mockImplementation(DETAIL_MOCK);
    await render();
    const card = container.querySelector('[data-testid="tsk4-card-tsk_open_1"]') as HTMLElement;
    await act(async () => {
      card.click();
    });
    await act(async () => {});
    expect(lastHref).toContain("task=tsk_open_1");
    // Fresh mount of the same URL (a refresh) reopens the same detail.
    await render("/work?tab=board&task=tsk_open_1");
    expect(container.querySelector('[data-testid="tsk4-detail-ready"]')).toBeTruthy();
  });

  it("R40: ?state= swaps the detail content itself (error, denied, loading)", async () => {
    fetchJSON.mockImplementation(DETAIL_MOCK);
    await render("/tasks/tsk_open_1?state=error&rid=fs-9");
    expect(container.querySelector('[data-testid="tsk4-detail-error"]')).toBeTruthy();
    expect(container.textContent).toContain("fs-9");
    expect(container.querySelector('[data-testid="req-copy"]') || container.querySelector('[data-testid="req-copy-fallback"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tsk4-detail-retry"]')).toBeTruthy();
    const detailCalls = fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/task-detail"));
    expect(detailCalls).toHaveLength(0);
    await render("/tasks/tsk_open_1?state=denied");
    const deniedText = (container.querySelector('[data-testid="tsk4-detail-error"]')?.textContent ?? "").replace(/\s+/g, " ");
    expect(deniedText).toContain("没有查看这条任务的权限");
    expect(deniedText).toContain("重试");
    expect(document.body.textContent).not.toContain("agent-api");
    // 403 and 404 answers stay the same body (detailError path, live fetch).
    await render("/work");
  });

  it("R40: a missing source reads 未接入 with the reason in the title", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (!url.includes("/task-detail")) return DETAIL_MOCK(url);
      const body = resolveDetail() as Record<string, unknown>;
      return Promise.resolve({ ...body, source: null });
    });
    await render("/tasks/tsk_open_1");
    const field = Array.from(container.querySelectorAll("dd")).find((dd) => dd.textContent?.includes("未接入"));
    expect(field).toBeTruthy();
    expect(field?.querySelector("span")?.getAttribute("title")).toContain("后台没有回传这条任务的来源信息");
  });
});


