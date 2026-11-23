// @vitest-environment jsdom
// PE-08① 员工新建模态 + 编辑抽屉禁用预接（EMP-02 写路径契约钉）。
// 现网取证（docs/_artifacts/PE-08/DONE.md）：无 Idempotency-Key → 400
// request.missing_idempotency_key；仅 name 的体 → 域 400
// employee.invalid_initial_version: "title is required" 逐字透传；
// PATCH → 405 console.read_only。本套件钉前端侧：
//  ① 头三件套（Idempotency-Key/X-Request-Id/Content-Type）+ 契约体形状
//     （name/title/ownerUserId/initialVersion{jobDescription,…}）；
//  ② 成功语义 = 2xx 后重读列表、行在列才关表单；重读完成前表单不关、
//     按钮 disabled；禁乐观插入（验证 GET 落定前新行不得出现）；
//  ③ 502/503 ≠ 失败：「已提交状态未知，请刷新列表确认」+ 同键同体重试、
//     X-Request-Id 每趟新发；成功后换新一轮键；
//  ④ 上游 400 code/message 逐字；无会话 cookie 拒发；客户端必填拦截零请求；
//  ⑤ 编辑抽屉渲染、保存钮 disabled+aria-disabled+title 写明 405 现实，
//     点击零请求零 toast；
//  ⑥ 空态两分：筛选无匹配（清除筛选）vs 名册为空（新建入口直开模态）。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 与 employees.empty.test.tsx 同款：ui 桶拉入 node 载不动的 .webp，桩掉四原语。
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
import { EmployeesModulePage } from "./EmployeesModulePage";

let container: HTMLDivElement;
let root: Root | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-testid^="employees-row-"]')).map((el) =>
    (el.getAttribute("data-testid") ?? "").replace("employees-row-", ""),
  );

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // CSRF 双提交：写入腿需要会话 cookie（TaskCreateForm.test 同款）。
  document.cookie = "console_csrf=pe08-test-token; path=/";
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  fetchJSON.mockReset();
  document.cookie = "console_csrf=; path=/; max-age=0";
});

async function render(entry: string) {
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
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(el: Element | null, label: string) {
  const btn = el as HTMLButtonElement | null;
  if (!btn) throw new Error(`button missing: ${label}`);
  act(() => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

const ROW_A = {
  employeeId: "emp_A001",
  name: "小鲤",
  title: "内容编辑",
  lifecycleState: "active",
  ownerUserId: "1",
  updatedAt: "2026-11-17T05:52:48.030Z",
  department: null,
};
const ROW_NEW = {
  employeeId: "emp_NEW9001",
  name: "小录",
  title: "巡检助理",
  lifecycleState: "draft",
  ownerUserId: "u_zhang",
  updatedAt: "2026-11-24T05:52:48.030Z",
  department: "增长组",
};
const FULL = { items: [ROW_A] };

/** 读→ready（可换形），POST→由用例摆布。 */
function route(opts: { post?: (init: RequestInit) => Promise<unknown>; reads?: () => unknown }) {
  fetchJSON.mockImplementation((_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return (opts.post ?? (() => Promise.reject(new Error("unexpected POST"))))(init);
    return Promise.resolve((opts.reads ?? (() => FULL))());
  });
}

async function openModal() {
  click(q("employees-create-open"), "employees-create-open");
  await flush();
  expect(q("emp-create-modal"), "modal opens").toBeTruthy();
}

function fillForm(over: Partial<{ name: string; title: string; owner: string; job: string; dept: string }> = {}) {
  setValue(q("emp-create-name") as HTMLInputElement, over.name ?? "小录");
  setValue(q("emp-create-title") as HTMLInputElement, over.title ?? "巡检助理");
  setValue(q("emp-create-owner") as HTMLInputElement, over.owner ?? "u_zhang");
  setValue(q("emp-create-job") as HTMLTextAreaElement, over.job ?? "整理巡检周报并跟进异常。");
  if (over.dept !== undefined) setValue(q("emp-create-department") as HTMLInputElement, over.dept);
}

function lastPost(): { url: string; init: RequestInit } {
  const calls = fetchJSON.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
  const last = calls[calls.length - 1];
  return { url: String(last?.[0]), init: last?.[1] as RequestInit };
}
function postCalls() {
  return fetchJSON.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
}
function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}
function bodyOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("PE-08① create modal (EMP-02 write contract)", () => {
  it("① header entry opens the modal without firing any request", async () => {
    route({});
    await render("/employees");
    const before = fetchJSON.mock.calls.length;
    await openModal();
    expect(fetchJSON.mock.calls.length, "opening reads nothing").toBe(before);
    // 打开模态后提交钮可用（非 disabled）。
    expect((q("emp-create-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("② empty roster points at the real create entry; dead copy is gone", async () => {
    route({ reads: () => ({ items: [] }) });
    await render("/employees");
    expect(q("employees-empty"), "empty card").toBeTruthy();
    expect(q("emp-list-state-empty-text")?.textContent).toBe("还没有数字员工");
    expect(document.body.textContent, "no pointer to a nonexistent entry").not.toContain("员工创建后会出现在这里");
    const before = fetchJSON.mock.calls.length;
    click(q("employees-empty-create"), "employees-empty-create");
    await flush();
    expect(q("emp-create-modal"), "empty-state button opens the modal").toBeTruthy();
    expect(fetchJSON.mock.calls.length).toBe(before);
  });

  it("client-side required + 120 cap block the request; maxLength pinned", async () => {
    route({});
    await render("/employees");
    await openModal();
    expect((q("emp-create-name") as HTMLInputElement).getAttribute("maxLength"), "域实测上限 120").toBe("120");
    const before = fetchJSON.mock.calls.length;
    click(q("emp-create-submit"), "submit empty");
    await flush();
    expect(fetchJSON.mock.calls.length, "zero requests before validation passes").toBe(before);
    expect(q("emp-create-feedback")?.textContent).toContain("姓名是必填");
    expect(q("emp-create-feedback")?.textContent).toContain("120");
    // 必填四件之外的部门可选：齐了才发得出。
    fillForm({ job: "" });
    click(q("emp-create-submit"), "submit missing job");
    await flush();
    expect(fetchJSON.mock.calls.length).toBe(before);
    expect(q("emp-create-feedback")?.textContent).toContain("职责说明是必填");
  });

  it("without the CSRF cookie the write is refused, not sent", async () => {
    route({});
    await render("/employees");
    await openModal();
    document.cookie = "console_csrf=; path=/; max-age=0";
    fillForm();
    const before = fetchJSON.mock.calls.length;
    click(q("emp-create-submit"), "submit");
    await flush();
    expect(fetchJSON.mock.calls.length, "doomed write never hits the network").toBe(before);
    expect(q("emp-create-feedback")?.textContent).toContain("需要登录后才能提交");
  });

  it("③ success: three-piece headers + contract body; no optimistic insert; close only after refetch confirms the row", async () => {
    let resolvePost!: (v: unknown) => void;
    let resolveVerify!: (v: unknown) => void;
    let verifyGet = false;
    route({
      post: () => new Promise((res) => { resolvePost = res; }),
      reads: () => {
        if (verifyGet) {
          return new Promise((res) => { resolveVerify = res; }) as never;
        }
        return FULL;
      },
    });
    await render("/employees");
    await openModal();
    fillForm({ dept: "增长组" });
    click(q("emp-create-submit"), "submit");
    await flush();

    const { url, init } = lastPost();
    expect(url).toBe("/agent-api/api/employees");
    expect(init.method).toBe("POST");
    const h = headersOf(init);
    expect(h["Idempotency-Key"], "幂等门实测：缺键 400 request.missing_idempotency_key").toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(h["X-Request-Id"], "头三件套之一").toBeTruthy();
    expect(h["content-type"]).toBe("application/json");
    expect(h["X-Console-CSRF"]).toBe("pe08-test-token");
    const body = bodyOf(init);
    expect(body.name).toBe("小录");
    expect(body.title).toBe("巡检助理");
    expect(body.ownerUserId).toBe("u_zhang");
    expect(body.department, "部门是创建体的投影快照写入口（域 _build_records 实测）").toBe("增长组");
    const iv = body.initialVersion as Record<string, unknown>;
    expect(iv.jobDescription, "域实测 jobDescription 非空").toBe("整理巡检周报并跟进异常。");
    expect(iv.knowledgeScopes).toEqual([]);
    expect(iv.skillRefs).toEqual([]);
    expect(iv.grantIds).toEqual([]);
    const rp = iv.responsePolicy as Record<string, unknown>;
    expect(rp.mode).toBe("realtime");
    expect(rp.triggers).toEqual(["mention"]);
    expect(rp.fallback).toEqual({
      onUnknownSender: "deny_with_guidance",
      onLowConfidence: "ask_clarifying",
      onPolicyDeny: "explain_and_escalate",
      onBudgetExhausted: "denied_with_notification",
    });

    // 提交在途：按钮 disabled，防双提交。
    expect((q("emp-create-submit") as HTMLButtonElement).disabled, "in-flight submit is locked").toBe(true);
    click(q("emp-create-submit"), "double-click attempt");
    await flush();
    expect(postCalls().length, "double click never sends twice").toBe(1);

    // 2xx 到手、重读未落定：表单不关、新行绝不乐观插入。
    verifyGet = true;
    act(() => { resolvePost({ id: "emp_NEW9001" }); });
    await flush();
    expect(q("emp-create-modal"), "form stays open until the refetch lands").toBeTruthy();
    expect((q("emp-create-submit") as HTMLButtonElement).disabled, "verify phase keeps the button locked").toBe(true);
    expect(rowIds(), "no optimistic row before the refetch resolves").not.toContain("emp_NEW9001");
    expect(document.querySelector('[role="status"]'), "no success toast before confirmation").toBeNull();

    // 重读应答落定、行在列：才关表单、才出确认句。
    act(() => { resolveVerify({ items: [ROW_A, ROW_NEW] }); });
    await flush();
    expect(q("emp-create-modal"), "modal closes after the row is confirmed").toBeNull();
    expect(rowIds(), "the row comes from the refetch response").toContain("emp_NEW9001");
    const toast = document.querySelector('[role="status"]');
    expect(toast?.textContent, "success toast rides the confirmed refetch").toContain("小录");
  });

  it("④ 502 reads as unknown-status, not failure: same key + same body replay, fresh X-Request-Id", async () => {
    let n = 0;
    let firstRead = true;
    route({
      post: () => {
        n += 1;
        if (n === 1) {
          return Promise.reject(
            new ApiError("bad gateway", { status: 502, body: '{"code":"upstream.unavailable","message":"upstream service is not reachable"}', url: "/agent-api/api/employees", requestId: "req-502-1" }),
          );
        }
        return Promise.resolve({ id: "emp_NEW9001" });
      },
      reads: () => {
        if (firstRead) {
          firstRead = false;
          return FULL;
        }
        return { items: [ROW_A, ROW_NEW] }; // 重放成功后的重读：行在列
      },
    });
    await render("/employees");
    await openModal();
    fillForm();
    click(q("emp-create-submit"), "first submit");
    await flush();
    expect(q("emp-create-modal"), "unknown status never auto-closes").toBeTruthy();
    expect(q("emp-create-feedback")?.textContent).toContain("已提交状态未知，请刷新列表确认");
    expect(q("emp-create-feedback")?.textContent).toContain("同一幂等键");
    // 字段冻结：同键重放必须原体，改体在域侧会撞 409 idempotency_conflict。
    expect((q("emp-create-name") as HTMLInputElement).disabled, "body frozen while status unknown").toBe(true);

    const first = lastPost();
    click(q("emp-create-submit"), "same-key retry");
    await flush();
    const second = lastPost();
    expect(postCalls().length).toBe(2);
    expect(headersOf(second.init)["Idempotency-Key"], "retry keeps the round key").toBe(
      headersOf(first.init)["Idempotency-Key"],
    );
    expect(second.init.body, "replayed body is byte-identical").toBe(first.init.body);
    expect(headersOf(second.init)["X-Request-Id"], "request id is per-attempt").not.toBe(
      headersOf(first.init)["X-Request-Id"],
    );

    // 重放成功 → 重读确认 → 关闭。
    await flush();
    expect(q("emp-create-modal"), "confirmed on the verifying refetch").toBeNull();
    expect(rowIds()).toContain("emp_NEW9001");
  });

  it("⑤ upstream 400 code/message surface verbatim; no success anywhere", async () => {
    route({
      post: () =>
        Promise.reject(
          new ApiError("nope", {
            status: 400,
            body: '{"code":"employee.invalid_initial_version","message":"title is required"}',
            url: "/agent-api/api/employees",
            requestId: "req-400-1",
          }),
        ),
    });
    await render("/employees");
    await openModal();
    // 表单齐件过了本地拦截，上游仍回 400（模拟更严的域校验）：逐字透传。
    fillForm();
    click(q("emp-create-submit"), "submit accepted locally, rejected upstream");
    await flush();
    const fb = q("emp-create-feedback")?.textContent ?? "";
    expect(fb, "上游 code 逐字").toContain("employee.invalid_initial_version");
    expect(fb, "上游 message 逐字").toContain("title is required");
    expect(document.querySelector('[role="status"]'), "a rejected write never celebrates").toBeNull();
    expect(q("emp-create-modal"), "modal stays open for correction").toBeTruthy();
  });

  it("⑥ refetch that misses the row never fakes success and never closes", async () => {
    route({
      post: () => Promise.resolve({ id: "emp_GHOST" }),
      reads: () => ({ items: [ROW_A] }), // 重读回来还是没有TA
    });
    await render("/employees");
    await openModal();
    fillForm();
    click(q("emp-create-submit"), "submit");
    await flush();
    expect(q("emp-create-modal"), "unverified success keeps the form open").toBeTruthy();
    expect(document.querySelector('[role="status"]'), "no toast without confirmation").toBeNull();
    expect(q("emp-create-feedback")?.textContent).toContain("不要重复提交");
    expect(q("emp-create-feedback")?.textContent).toContain("草稿");
  });

  it("⑦ a new round after success gets a fresh idempotency key", async () => {
    let firstRead = true;
    route({
      post: () => Promise.resolve({ id: "emp_NEW9001" }),
      reads: () => {
        if (firstRead) {
          firstRead = false;
          return FULL;
        }
        return { items: [ROW_A, ROW_NEW] };
      },
    });
    await render("/employees");
    await openModal();
    fillForm();
    click(q("emp-create-submit"), "first round submit");
    await flush();
    const key1 = headersOf(lastPost().init)["Idempotency-Key"];
    // 第一轮走完整成功链：重读确认在列 → 关闭。
    expect(q("emp-create-modal"), "round one closes after confirmation").toBeNull();
    expect(rowIds()).toContain("emp_NEW9001");

    await openModal();
    fillForm();
    click(q("emp-create-submit"), "second round submit");
    await flush();
    const key2 = headersOf(lastPost().init)["Idempotency-Key"];
    expect(key2, "每轮编辑新会话生成新键").not.toBe(key1);
  });

  it("⑧ edit drawer renders with the save button pinned disabled; clicking sends nothing and toasts nothing", async () => {
    route({});
    await render("/employees");
    expect(rowIds()).toContain("emp_A001");
    const before = fetchJSON.mock.calls.length;
    click(q("emp-row-edit-emp_A001"), "row edit button");
    await flush();
    expect(q("emp-edit-drawer"), "drawer renders (write pre-wired, save locked)").toBeTruthy();
    const save = q("emp-edit-save") as HTMLButtonElement;
    expect(save.disabled, "保存钮 disabled").toBe(true);
    expect(save.getAttribute("aria-disabled"), "aria-disabled 同步坐实").toBe("true");
    expect(save.getAttribute("title"), "原因逐字钉在触点上").toContain(
      "写接口未接入（等 T-PE-D，PATCH 现 405 console.read_only）",
    );
    // 预填可读值。
    expect((q("emp-edit-name") as HTMLInputElement).value).toBe("小鲤");
    // 禁用钮点击（两条路径都试）：零请求。
    save.click();
    save.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush();
    expect(fetchJSON.mock.calls.length, "disabled save click = zero fetchJSON").toBe(before);
    expect(document.querySelector('[role="status"]'), "zero toast").toBeNull();
    click(q("emp-edit-close"), "close drawer");
    await flush();
    expect(q("emp-edit-drawer")).toBeNull();
    expect(fetchJSON.mock.calls.length, "closing writes nothing either").toBe(before);
  });

  it("⑨ header create entry carries a stated reason when the list is not usable", async () => {
    fetchJSON.mockImplementation(() =>
      Promise.reject(new ApiError("boom", { status: 500, body: "", url: "/agent-api/api/employees" })),
    );
    await render("/employees");
    const btn = q("employees-create-open") as HTMLButtonElement;
    expect(btn.disabled, "错误态下新建入口禁用而非隐身").toBe(true);
    expect(btn.getAttribute("title")).toContain("暂不能新建");
  });
});
