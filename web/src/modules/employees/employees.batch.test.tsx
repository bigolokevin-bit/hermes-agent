// @vitest-environment jsdom
/**
 * PE-09 · 员工批量操作（选择模型 + 批量导出/复制 + 批量流转预接）。
 *
 * 现网取证（2026-11-24 本机，原文见 DONE-PE-09.md）：
 *  - 域写口已活：services/domain/http_app.py:166-184 `POST /v1/employees/{id}/transitions`；
 *  - BFF 未注册：带会话 cookie 的 `POST /api/employee-transition` 实测回
 *    `405 {"code":"console.read_only","message":"first console is read-only; only GET/HEAD allowed"}`
 *    ⇒ 本套件钉的是**未接入期**的 DOM 契约（零请求零 toast），不是接入后的写成功。
 *
 * 钉住的条款：
 *  ① 选择模型：行级勾选 + 全选本页，计数只认屏上可见行；勾选本身零请求；
 *  ② 翻页即清空 + 口径句在场（不假装跨页记忆）；
 *  ③ 未接入期：批量流转钮 disabled + aria-disabled + title 原因逐字，
 *     两条点击路径（.click()/dispatchEvent）都零 fetchJSON、零 toast、零回执区；
 *  ④ 六态目标态文案取自 employee_models.py:102-108 冻结集，禁「启用/停用」臆造词；
 *  ⑤ 流转影响可上岗率分母的披露句在场（draft/onboarding/archived 不入分母）；
 *  ⑥ 批量复制/导出只作用勾选行且零新请求；
 *  ⑦ 逐 id 聚合形态（前端限并发 2、成功 n/失败 m + 逐字原因、一单失败不断批、
 *     400/409 不重试）—— 这条锁的是 employees-batch.ts 的执行器形状，
 *     现网在 UI 上不可达（按钮禁用），接入后无需再改聚合代码。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@nous-research/ui", () => ({
  Badge: (props: Record<string, unknown>) => <span {...drop(props, ["className", "tone"])} />,
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
import { pickOption } from "@/shell/selectHarness";
import { EmployeesModulePage } from "./EmployeesModulePage";
import {
  BATCH_CONCURRENCY,
  batchHeadline,
  batchLine,
  EMPLOYEE_TRANSITION_ENDPOINT,
  LIFECYCLE_TARGET_STATES,
  runBatchTransitions,
  TRANSITION_WRITE_NOTE,
} from "./employees-batch";

let container: HTMLDivElement;
let root: Root | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const toastNode = () => document.querySelector('[role="status"]');
const postCalls = () =>
  fetchJSON.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");

const ROW_A = {
  employeeId: "emp_A001",
  name: "小鲤",
  title: "内容编辑",
  lifecycleState: "active",
  ownerUserId: "1",
  updatedAt: "2026-11-17T05:52:48.030Z",
  department: "增长组",
};
const ROW_B = {
  employeeId: "emp_B002",
  name: "小录",
  title: "巡检助理",
  lifecycleState: "paused",
  ownerUserId: "2",
  updatedAt: "2026-11-18T05:52:48.030Z",
  department: "运维组",
};
const ROW_C = {
  employeeId: "emp_C003",
  name: "小拓",
  title: "渠道助理",
  lifecycleState: "draft",
  ownerUserId: "3",
  updatedAt: "2026-11-19T05:52:48.030Z",
  department: "增长组",
};
const PAGE1 = { items: [ROW_A, ROW_B], nextCursor: "pc-2" };
const PAGE2 = { items: [ROW_C] };

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  document.cookie = "console_csrf=pe09-test-token; path=/";
  fetchJSON.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes("cursor=")) return Promise.resolve(PAGE2);
    return Promise.resolve(PAGE1);
  });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  fetchJSON.mockReset();
  document.cookie = "console_csrf=; path=/; max-age=0";
});

async function render(entry = "/employees") {
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[entry]}>
        <EmployeesModulePage />
      </MemoryRouter>,
    );
  });
  await flush();
  // 批量动作默认收在页头「更多」入口里（不再占一块整高）：测试先展开再断言。
  click(q("emp-more-trigger"), "more menu");
  await flush();
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function click(el: Element | null, label: string) {
  const btn = el as HTMLButtonElement | null;
  if (!btn) throw new Error(`control missing: ${label}`);
  act(() => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function check(el: Element | null, label: string, value: boolean) {
  const box = el as HTMLInputElement | null;
  if (!box) throw new Error(`checkbox missing: ${label}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
  act(() => {
    setter?.call(box, value);
    box.dispatchEvent(new Event("click", { bubbles: true }));
    box.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const selectedRead = () => q("emp-batch-count")?.textContent ?? "";

describe("PE-09 ① selection model", () => {
  it("every loaded row carries a checkbox; ticking updates the count and sends nothing", async () => {
    await render();
    const before = fetchJSON.mock.calls.length;
    expect(q("emp-row-select-emp_A001"), "row A checkbox").toBeTruthy();
    expect(q("emp-row-select-emp_B002"), "row B checkbox").toBeTruthy();
    expect(selectedRead()).toBe("已选 0 / 2");

    check(q("emp-row-select-emp_A001"), "row A", true);
    expect(selectedRead()).toBe("已选 1 / 2");
    check(q("emp-row-select-emp_B002"), "row B", true);
    expect(selectedRead()).toBe("已选 2 / 2");
    expect(fetchJSON.mock.calls.length, "勾选本身零请求").toBe(before);
  });

  it("select-all covers the visible rows only and toggles back to zero", async () => {
    await render();
    click(q("emp-batch-select-all"), "select all");
    expect(selectedRead()).toBe("已选 2 / 2");
    expect((q("emp-row-select-emp_A001") as HTMLInputElement).checked).toBe(true);
    click(q("emp-batch-select-all"), "select all again");
    expect(selectedRead()).toBe("已选 0 / 2");
  });
});

describe("PE-09 ② cursor paging clears the selection", () => {
  it("appending page two clears the selection and states the caliber", async () => {
    await render();
    check(q("emp-row-select-emp_A001"), "row A", true);
    expect(selectedRead()).toBe("已选 1 / 2");

    // 列表腿单独数：门证据扇出（workstations/effective-config/approvals）不是续取。
    const listLegs = () =>
      fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/employees?")).length;
    const before = listLegs();
    click(q("emp-list-page-more"), "load more");
    await flush();

    expect(listLegs(), "翻页恰一次续取请求").toBe(before + 1);
    expect(selectedRead(), "翻页即清空选择").toBe("已选 0 / 3");
    const scope = q("emp-batch-scope")?.textContent ?? "";
    expect(scope).toContain("翻页即清空");
    expect(scope).toContain("不跨页记忆");
    expect(scope).toContain("已加载");
  });

  it("a filter change clears it too", async () => {
    await render();
    check(q("emp-row-select-emp_A001"), "row A", true);
    expect(selectedRead()).toBe("已选 1 / 2");
    await pickOption("emp-list-dept-select", "运维组");
    await flush();
    expect(
      fetchJSON.mock.calls.filter((c) => String(c[0]).includes("/api/employees?")).length,
      "部门是本地过滤，不发新的列表请求",
    ).toBe(1);
    // 桶里只剩一人：选择当场清空，屏上也只报这一桶的行数。
    expect(selectedRead()).toBe("已选 0 / 1");
  });
});

describe("PE-09 ③ batch transition is locked while the write route is unregistered", () => {
  it("button is disabled + aria-disabled and pins the 405 reason on the control", async () => {
    await render();
    click(q("emp-batch-select-all"), "select all");
    const btn = q("emp-batch-transition") as HTMLButtonElement;
    expect(btn.disabled, "写路由未注册 ⇒ 按钮 disabled").toBe(true);
    expect(btn.getAttribute("aria-disabled"), "aria-disabled 同步坐实").toBe("true");
    expect(btn.getAttribute("title"), "原因逐字钉在触点上").toContain(TRANSITION_WRITE_NOTE);
    expect(btn.getAttribute("title")).toContain("405 console.read_only");
    expect(btn.getAttribute("title")).toContain("T-PE-E");
    expect(btn.getAttribute("title")).toContain("已勾 2 行");
  });

  it("clicking it (both paths) sends zero POST and raises zero toast and zero receipt", async () => {
    await render();
    click(q("emp-batch-select-all"), "select all");
    const before = fetchJSON.mock.calls.length;
    const btn = q("emp-batch-transition") as HTMLButtonElement;
    btn.click();
    click(btn, "transition");
    await flush();
    expect(postCalls(), "未接入期零写请求").toHaveLength(0);
    expect(fetchJSON.mock.calls.length, "连读请求都不多发").toBe(before);
    expect(toastNode(), "零 toast（PRD §8.1-5 假成功禁令）").toBeNull();
    expect(q("emp-batch-result"), "不渲染回执区").toBeNull();
  });

  it("the reason sits on screen too, not only in the hover title (触屏无 hover)", async () => {
    await render();
    const note = q("emp-batch-write-note")?.textContent ?? "";
    expect(note).toContain(TRANSITION_WRITE_NOTE);
    expect(note).toContain("不发请求也不报成功");
  });

  it("the copy/export legs stay usable with nothing selected only after a tick", async () => {
    await render();
    expect((q("emp-batch-copy") as HTMLButtonElement).disabled, "零勾选时复制禁用").toBe(true);
    expect((q("emp-batch-export") as HTMLButtonElement).disabled, "零勾选时导出禁用").toBe(true);
    expect(q("emp-batch-copy")?.getAttribute("title")).toContain("没有勾选任何行");
    check(q("emp-row-select-emp_A001"), "row A", true);
    expect((q("emp-batch-copy") as HTMLButtonElement).disabled).toBe(false);
    expect((q("emp-batch-export") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("PE-09 ④ six frozen target states, no invented verbs", () => {
  it("the target picker offers exactly employee_models.py's six states", async () => {
    await render();
    click(q("emp-batch-target"), "open target picker");
    await flush();
    const labels = Array.from(document.querySelectorAll('[role="option"]')).map(
      (el) => el.textContent ?? "",
    );
    // 首项是「选择目标在职态」占位（disabled），其余正好是冻结六态。
    expect(labels).toHaveLength(LIFECYCLE_TARGET_STATES.length + 1);
    expect(labels[0]).toBe("选择目标在职态");
    expect(labels[0]?.includes("disabled") ?? false).toBe(false);
    expect((document.querySelectorAll('[role="option"]')[0] as HTMLButtonElement).disabled).toBe(true);
    const states = labels.slice(1);
    expect(states).toEqual([
      "草稿（draft）",
      "入职中（onboarding）",
      "在岗（active）",
      "已暂停（paused）",
      "离职中（offboarding）",
      "已归档（archived）",
    ]);
  });

  it("the action bar never says 启用 or 停用", async () => {
    await render();
    click(q("emp-batch-target"), "open target picker");
    await flush();
    const bar = q("emp-batch-bar")?.textContent ?? "";
    expect(bar).not.toContain("启用");
    expect(bar).not.toContain("停用");
  });
});

describe("PE-09 ⑤ readiness denominator disclosure", () => {
  it("states that draft/onboarding/archived stay out of the denominator", async () => {
    await render();
    const note = q("emp-batch-denominator")?.textContent ?? "";
    expect(note).toContain("可上岗率分母");
    expect(note).toContain("不入分母");
    expect(note).toContain("草稿");
    expect(note).toContain("入职中");
    expect(note).toContain("已归档");
  });

  it("flagging an out-of-denominator target says so on the spot", async () => {
    await render();
    click(q("emp-batch-target"), "open");
    await flush();
    const option = Array.from(document.querySelectorAll('[role="option"]')).find(
      (el) => (el.textContent ?? "").includes("已归档"),
    );
    click(option ?? null, "archived option");
    await flush();
    expect(q("emp-batch-target")?.getAttribute("data-value")).toBe("archived");
    expect(q("emp-batch-denominator-flag")?.textContent).toContain("不入分母");
  });
});

describe("PE-09 ⑥ batch copy/export are front-end only and scoped to the ticked rows", () => {
  it("writes exactly the selected rows to the clipboard and downloads their CSV, zero new request", async () => {
    await render();
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
    const captured: Blob[] = [];
    const downloads: string[] = [];
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    const orig = URL.createObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      captured.push(blob);
      return "blob:pe09";
    }) as typeof URL.createObjectURL;
    const before = fetchJSON.mock.calls.length;
    try {
      check(q("emp-row-select-emp_B002"), "row B", true);
      click(q("emp-batch-copy"), "batch copy");
      await flush();
      click(q("emp-batch-export"), "batch export");
      await flush();
    } finally {
      URL.createObjectURL = orig;
      clicks.mockRestore();
    }
    expect(fetchJSON.mock.calls.length, "复制/导出零新请求").toBe(before);
    expect(postCalls()).toHaveLength(0);
    expect(written).toHaveLength(1);
    const lines = written[0].split("\n").filter((l) => l !== "");
    expect(lines[0]).toBe("name,employee_no,lifecycle,last_active,department");
    expect(lines).toHaveLength(2);
    expect(lines[1], "只导出勾选的那一行").toContain("小录");
    const csv = (await captured[0].text()).split("\r\n").filter((l) => l !== "");
    expect(csv).toHaveLength(2);
    expect(csv[1]).toContain("小录");
    expect(downloads[0]).toMatch(/^employees-\d{8}-\d{4}\.csv$/);
    expect(q("emp-batch-copy-status")?.textContent).toBe("已复制 1 行");
  });
});

describe("PE-09 ⑦ per-id aggregation shape (executor contract)", () => {
  const body = (code: string, message: string) =>
    JSON.stringify({ code, message });

  it("reports 成功 n / 失败 m with each failure reason verbatim, and never aborts the batch", async () => {
    const seen: string[] = [];
    const summary = await runBatchTransitions(["emp_A001", "emp_B002", "emp_C003", "emp_D004"], {
      to: "paused",
      reason: "演练",
      post: async (employeeId) => {
        seen.push(employeeId);
        if (employeeId === "emp_B002") {
          throw new ApiError("nope", {
            status: 400,
            body: body("employee.invalid_transition", "active → paused is not allowed"),
            url: EMPLOYEE_TRANSITION_ENDPOINT,
          });
        }
        if (employeeId === "emp_D004") {
          throw new ApiError("nope", {
            status: 409,
            body: body("request.idempotency_conflict", "same key, different payload"),
            url: EMPLOYEE_TRANSITION_ENDPOINT,
          });
        }
        return Promise.resolve({ ok: true });
      },
    });
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(2);
    expect(summary.total).toBe(4);
    expect(batchHeadline(summary)).toBe("成功 2 / 失败 2");
    // 一单失败不断批：四单都真跑过，且没有第二趟。
    expect(seen).toEqual(["emp_A001", "emp_B002", "emp_C003", "emp_D004"]);
    const byId = new Map(summary.results.map((r) => [r.employeeId, r]));
    expect(byId.get("emp_B002")?.reason).toBe(
      "employee.invalid_transition：active → paused is not allowed",
    );
    expect(byId.get("emp_D004")?.reason).toBe(
      "request.idempotency_conflict：same key, different payload",
    );
    expect(byId.get("emp_A001")?.reason).toBeNull();
    expect(batchLine(byId.get("emp_B002")!, (id) => id)).toContain("employee.invalid_transition");
  });

  it("400 and 409 are semantic verdicts: exactly one attempt per id, never a retry", async () => {
    let calls = 0;
    const summary = await runBatchTransitions(["emp_A001", "emp_B002"], {
      to: "active",
      reason: "演练",
      post: async (employeeId) => {
        calls += 1;
        throw new ApiError("nope", {
          status: employeeId === "emp_A001" ? 400 : 409,
          body: body("employee.invalid_transition", "no"),
          url: EMPLOYEE_TRANSITION_ENDPOINT,
        });
      },
    });
    expect(calls, "两单各一趟，零重试").toBe(2);
    expect(summary.failed).toBe(2);
    expect(batchHeadline(summary)).toBe("成功 0 / 失败 2");
  });

  it("keeps at most BATCH_CONCURRENCY(2) writes in flight", async () => {
    let active = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    const summary = await runBatchTransitions(
      ["emp_1", "emp_2", "emp_3", "emp_4", "emp_5", "emp_6"],
      {
        to: "offboarding",
        reason: "演练",
        concurrency: BATCH_CONCURRENCY,
        post: () =>
          new Promise((resolve) => {
            active += 1;
            peak = Math.max(peak, active);
            release.push(() => {
              active -= 1;
              resolve({ ok: true });
            });
            if (release.length >= 2) {
              for (const done of release.splice(0, release.length)) done();
            }
          }),
      },
    );
    expect(peak, "并发上限 2").toBeLessThanOrEqual(BATCH_CONCURRENCY);
    expect(summary.total).toBe(6);
    expect(summary.succeeded).toBe(6);
    // 收尾：把还在等的单放掉，避免悬挂 Promise。
    while (release.length) {
      const done = release.shift();
      done?.();
    }
    await Promise.resolve();
  });

  it("an all-OK batch reads as 成功 n / 共 N 单, never as 「失败 0」", async () => {
    const summary = await runBatchTransitions(["emp_A001", "emp_B002"], {
      to: "active",
      reason: "演练",
      post: () => Promise.resolve({ ok: true }),
    });
    expect(batchHeadline(summary)).toBe("成功 2 / 共 2 单");
    expect(batchHeadline(summary)).not.toContain("失败 0");
  });

  it("a missing upstream reason is stated as missing, not invented", async () => {
    const summary = await runBatchTransitions(["emp_A001"], {
      to: "archived",
      reason: "演练",
      post: () => Promise.reject(new Error("")),
    });
    expect(summary.results[0]?.reason).toBe("上游未给出原因");
    expect(batchLine(summary.results[0]!, () => "小鲤")).toBe("小鲤：上游未给出原因");
  });
});
