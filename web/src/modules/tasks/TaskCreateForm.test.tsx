// @vitest-environment jsdom
// TaskCreateForm 契约（T-create）：提交必须走真端点
// POST /agent-api/api/tasks，带 Idempotency-Key 头（重试复用同键防双建）；
// 标题必填在前端拦截；成功显示新编号短码并回调 onCreated；失败人话 + 可复制请求编号。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchJSON } = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON }));

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";

import { ApiError } from "@/lib/api-error";

import { TaskCreateForm } from "./TaskCreateForm";

vi.mock("@nous-research/ui/ui/components/button", () => ({
  Button: ({
    children,
    ...rest
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button {...rest}>{children}</button>
  ),
}));
vi.mock("@nous-research/ui/ui/components/card", () => ({
  Card: ({ children, ...rest }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div {...rest}>{children}</div>
  ),
  CardContent: ({
    children,
    ...rest
  }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div {...rest}>{children}</div>
  ),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  // CSRF double-submit: give the session cookie unless a test clears it.
  document.cookie = "console_csrf=test-csrf-token; path=/";
});

afterEach(() => {
  root?.unmount();
  container.remove();
  document.body.innerHTML = "";
  document.cookie = "console_csrf=; path=/; max-age=0";
  fetchJSON.mockReset();
});

declare global {
  interface Window {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}
window.IS_REACT_ACT_ENVIRONMENT = true;

function renderForm(nameMap: Record<string, string> = {}) {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter>
        <TaskCreateForm nameMap={nameMap} onCreated={onCreated} onClose={onClose} />
      </MemoryRouter>,
    );
  });
  return { onCreated, onClose };
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function submit() {
  const btn = container.querySelector<HTMLButtonElement>('[data-testid="tsk4-create-submit"]');
  if (!btn) throw new Error("submit button is missing");
  act(() => {
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("TaskCreateForm (T-create)", () => {
  it("blocks empty titles client-side without hitting the endpoint", async () => {
    renderForm();
    expect(container.querySelector('[data-testid="tsk4-create-form"]')).not.toBeNull();
    submit();
    await flush();
    const alert = container.querySelector('[data-testid="tsk4-create-error"]');
    expect(alert?.textContent).toContain("标题是必填的");
    expect(fetchJSON).not.toHaveBeenCalled();
  });

  it("posts the contract body to /api/tasks with an idempotency key", async () => {
    fetchJSON.mockResolvedValue({ id: "tk_ABCDEF1234567890" });
    renderForm({ emp_1a2b3c4d: "小鲤" });
    setValue(
      container.querySelector<HTMLInputElement>('[data-testid="tsk4-create-title"]')!,
      "整理巡检报告",
    );
    setValue(
      container.querySelector<HTMLSelectElement>('[data-testid="tsk4-create-assignee"]')!,
      "emp_1a2b3c4d",
    );
    submit();
    await flush();

    expect(fetchJSON).toHaveBeenCalledTimes(1);
    const [url, init] = fetchJSON.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/agent-api/api/tasks");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBeTruthy();
    expect(headers["X-Console-CSRF"]).toBe("test-csrf-token");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.title).toBe("整理巡检报告");
    expect(body.source).toEqual({ kind: "manual" });
    expect(body.assignee).toEqual({ type: "employee", id: "emp_1a2b3c4d" });
    expect(body).not.toHaveProperty("createdBy");
  });

  it("refuses to send the write without the session cookie", async () => {
    document.cookie = "console_csrf=; path=/; max-age=0";
    renderForm({});
    setValue(
      container.querySelector<HTMLInputElement>('[data-testid="tsk4-create-title"]')!,
      "无会话写入",
    );
    submit();
    await flush();
    expect(fetchJSON).not.toHaveBeenCalled();
    const err = container.querySelector('[data-testid="tsk4-create-error"]');
    expect(err?.textContent).toContain("需要登录后才能提交");
    expect(err?.textContent).toContain("请先登录");
  });

  it("maps a CSRF 403 to a plain sentence with a copyable request id", async () => {
    const { ApiError } = await import("@/lib/api-error");
    fetchJSON.mockRejectedValue(
      new ApiError("forbidden", {
        status: 403,
        body: '{"code":"console.csrf_token_mismatch","rid":"csrf-rid-77"}',
        url: "/agent-api/api/tasks",
      }),
    );
    renderForm({});
    setValue(
      container.querySelector<HTMLInputElement>('[data-testid="tsk4-create-title"]')!,
      "过期会话写入",
    );
    submit();
    await flush();
    const err = container.querySelector('[data-testid="tsk4-create-error"]');
    expect(err?.textContent).toContain("登录状态已过期，写入被拦下了。请重新登录后再试。");
    expect(err?.textContent).toContain("csrf-rid-77");
    expect(err?.textContent).not.toContain("console.csrf_token_mismatch");
    expect(container.querySelector('[data-testid="req-copy"]')).toBeTruthy();
  });

  it("shows the new id and opens its detail on success", async () => {
    fetchJSON.mockResolvedValue({ id: "tk_ABCDEF1234567890" });
    const { onCreated } = renderForm();
    setValue(
      container.querySelector<HTMLInputElement>('[data-testid="tsk4-create-title"]')!,
      "冒烟任务",
    );
    submit();
    await flush();

    const ok = container.querySelector('[data-testid="tsk4-create-success"]');
    expect(ok?.textContent).toContain("任务已创建");
    expect(onCreated).toHaveBeenCalledWith("tk_ABCDEF1234567890");
    // 裸 id 只进 title，屏上是短码。
    const code = ok?.querySelector("code");
    expect(code?.getAttribute("title")).toBe("tk_ABCDEF1234567890");
    expect(code?.textContent).toBe("tk_ABC…7890");
    const clip = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clip } });
    const copyBtn = ok?.querySelector<HTMLButtonElement>('[data-testid="tsk4-copy-new-id"]');
    expect(copyBtn).toBeTruthy();
    await act(async () => {
      copyBtn!.click();
    });
    expect(clip).toHaveBeenCalledWith("tk_ABCDEF1234567890");
  });

  it("honestly says so when the backend confirms without an id", async () => {
    fetchJSON.mockResolvedValue({ ok: true });
    const { onCreated } = renderForm();
    setValue(
      container.querySelector<HTMLInputElement>('[data-testid="tsk4-create-title"]')!,
      "无回传编号",
    );
    submit();
    await flush();
    const ok = container.querySelector('[data-testid="tsk4-create-success"]');
    expect(ok?.textContent).toContain("没有回传任务编号");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows a plain error with a copyable request id and reuses the key on retry", async () => {
    fetchJSON.mockRejectedValue(
      new ApiError("服务在处理时出了错。", {
        status: 500,
        body: "",
        url: "/agent-api/api/tasks",
        requestId: "req-77",
      }),
    );
    renderForm();
    setValue(
      container.querySelector<HTMLInputElement>('[data-testid="tsk4-create-title"]')!,
      "会失败的",
    );
    submit();
    await flush();
    const alert = container.querySelector('[data-testid="tsk4-create-error"]');
    expect(alert?.textContent).toContain("任务没有创建成功");
    expect(alert?.textContent).toContain("req-77");
    expect(container.querySelector('[data-testid="req-copy"]')).not.toBeNull();

    submit(); // 失败重试：必须复用同一个幂等键，防双击双建。
    await flush();
    expect(fetchJSON).toHaveBeenCalledTimes(2);
    const key1 = (fetchJSON.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    const key2 = (fetchJSON.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(key2["Idempotency-Key"]).toBe(key1["Idempotency-Key"]);
  });
});
