// @vitest-environment jsdom
// Chat module gate tests (PRD v4.1 §9.2-B: CHAT-01..04, CHAT-10/11).
// The chat host (upstream ChatPage) is the ONLY thing that requests /api/pty,
// so "host not rendered" is the exact assertion for "zero /api/pty calls" —
// the mock below fails loudly if it is ever mounted outside the armed path.

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import { useProfileScope } from "@/contexts/useProfileScope";

const fetchJSON = vi.fn();
const setManagementProfile = vi.fn();
const ptyAttachToken = vi.fn();
const hostEvents: string[] = [];

vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
  setManagementProfile: (...args: unknown[]) => setManagementProfile(...args),
}));

vi.mock("@/lib/pty-attach-token", () => ({
  ptyAttachToken: (...args: unknown[]) => ptyAttachToken(...args),
}));

const HOST_ATTR = ["data-chat", "host"].join("-");

// Sentinel for the single chat host: records mount/unmount and the scoped
// profile it sees, so keying + ProfileContext wiring are observable.
vi.mock("@/pages/ChatPage", () => ({
  default: function ChatHostSentinel({ isActive }: { isActive?: boolean }) {
    const { profile } = useProfileScope();
    useEffect(() => {
      hostEvents.push(`mount:${profile || "—"}`);
      return () => {
        hostEvents.push(`unmount:${profile || "—"}`);
      };
    }, [profile]);
    return <div data-active={String(isActive)} />;
  },
}));

import ChatModulePage from "@/modules/chat/ChatModulePage";
import { chatModuleManifest } from "@/modules/chat/chatNav";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ok = (detail: unknown = { id: "emp_9f3a4b7c", name: "小鲤" }) =>
  Promise.resolve(detail);
const settle = () => act(async () => {});

async function mount(entry: string, props?: { employeeId?: string | null }) {
  if (root) act(() => root.unmount());
  if (container) container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ChatModulePage {...props} />
      </MemoryRouter>,
    );
  });
  await settle();
}

const hosts = () => container.querySelectorAll(`[${HOST_ATTR}]`);

beforeEach(() => {
  fetchJSON.mockReset();
  setManagementProfile.mockReset();
  ptyAttachToken.mockReset();
  ptyAttachToken.mockImplementation(() => Promise.resolve("tok-rotated"));
  hostEvents.length = 0;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe("chat module manifest", () => {
  it("follows the plugin-tab shape with the frozen fields", () => {
    expect(chatModuleManifest).toEqual({
      id: "chat",
      path: "/chat",
      label: "对话",
      icon: "MessageSquare",
    });
  });
});

describe("ChatModulePage", () => {
  it("CHAT-02 未绑定员工：空态面板，宿主不挂载（零 /api/pty），零取数零轮换", async () => {
    await mount("/chat");
    const text = container.textContent ?? "";
    expect(text).toContain("尚未绑定数字员工");
    expect(hosts().length).toBe(0);
    expect(hostEvents).toEqual([]);
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(ptyAttachToken).not.toHaveBeenCalled();
    expect(setManagementProfile).not.toHaveBeenCalled();
  });

  it("CHAT-01 绑定员工：详情通过后才挂宿主，作用域切到员工并轮换 attach token", async () => {
    fetchJSON.mockImplementation(() => ok());
    await mount("/chat?employee=emp_9f3a4b7c");

    expect(fetchJSON.mock.calls[0][0]).toBe("/agent-api/api/employees/emp_9f3a4b7c");
    expect(ptyAttachToken).toHaveBeenCalledWith(true);
    expect(hosts().length).toBe(1);
    expect(hostEvents).toEqual(["mount:emp_9f3a4b7c"]);
    expect(setManagementProfile).toHaveBeenCalledWith("emp_9f3a4b7c");
    // 页面上不得出现裸员工编号
    expect(container.textContent ?? "").not.toContain("emp_9f3a4b7c");
  });

  it("同员工重渲染不重建宿主（刷新态不断连）", async () => {
    fetchJSON.mockImplementation(() => ok());
    await mount("/chat", { employeeId: "emp_AAAA1111" });
    expect(hostEvents).toEqual(["mount:emp_AAAA1111"]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/chat"]}>
          <ChatModulePage employeeId="emp_AAAA1111" />
        </MemoryRouter>,
      );
    });
    await settle();
    expect(hostEvents).toEqual(["mount:emp_AAAA1111"]);
    expect(hosts().length).toBe(1);
  });

  it("CHAT-04 换员工：旧宿主先拆除，新宿主按新员工重新轮换 token", async () => {
    fetchJSON.mockImplementation(() => ok());
    await mount("/chat", { employeeId: "emp_AAAA1111" });
    expect(hostEvents).toEqual(["mount:emp_AAAA1111"]);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/chat"]}>
          <ChatModulePage employeeId="emp_BBBB2222" />
        </MemoryRouter>,
      );
    });
    await settle();

    expect(hosts().length).toBe(1); // 不留第二个宿主
    expect(hostEvents).toContain("unmount:emp_AAAA1111"); // 旧 WS 随卸载关闭
    expect(hostEvents[hostEvents.length - 1]).toBe("mount:emp_BBBB2222");
    expect(ptyAttachToken.mock.calls).toEqual([[true], [true]]);
  });

  it("CHAT-03 出错：人话 + 请求编号 + 重试；宿主不挂载", async () => {
    fetchJSON.mockImplementation(() =>
      Promise.reject(
        new ApiError("服务暂时无法访问。", {
          status: 500,
          body: JSON.stringify({ request_id: "req-77a1" }),
          url: "/agent-api/api/employees/emp_AAAA1111",
        }),
      ),
    );
    await mount("/chat?employee=emp_AAAA1111");

    const text = container.textContent ?? "";
    expect(text).toContain("对话暂时不可用");
    expect(text).toContain("请求编号：req-77a1");
    expect(text).toContain("重试");
    expect(text).not.toContain("HTTP 500");
    expect(hosts().length).toBe(0);

    fetchJSON.mockImplementation(() => ok());
    const retry = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("重试"),
    );
    expect(retry).toBeTruthy();
    await act(async () => (retry as HTMLElement).click());
    await settle();
    expect(hosts().length).toBe(1);
  });

  it("CHAT-10 denied(403)：「无权限或未开放」话术，不挂宿主不泄漏", async () => {
    fetchJSON.mockImplementation(() =>
      Promise.reject(
        new ApiError("forbidden", {
          status: 403,
          body: "",
          url: "/agent-api/api/employees/emp_AAAA1111",
        }),
      ),
    );
    await mount("/chat?employee=emp_AAAA1111");

    const text = container.textContent ?? "";
    expect(text).toContain("无法打开对话");
    expect(text).toContain("该数据源尚未开放，或你没有查看权限");
    expect(hosts().length).toBe(0);
  });

  it("?state= 四态可复现，且强制态不取数、不挂宿主", async () => {
    await mount("/chat?employee=emp_AAAA1111&state=loading");
    expect(container.querySelector('[data-testid="chat-forced-loading"]')).toBeTruthy();
    expect(hosts().length).toBe(0);
    expect(fetchJSON).not.toHaveBeenCalled();

    await mount("/chat?employee=emp_AAAA1111&state=empty");
    expect(container.textContent).toContain("还没有可打开的对话");
    expect(hosts().length).toBe(0);

    await mount("/chat?employee=emp_AAAA1111&state=error&rid=req-chat");
    expect(container.textContent).toContain("req-chat");
    expect(container.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
    expect(hosts().length).toBe(0);

    await mount("/chat?employee=emp_AAAA1111&state=denied&rid=req-denied");
    expect(container.textContent).toContain("无法打开对话");
    expect(container.textContent).toContain("req-denied");
    expect(hosts().length).toBe(0);
    expect(fetchJSON).not.toHaveBeenCalled();
  });

  it("详情未定（loading）：只显示忙碌态，绝不先挂宿主", async () => {
    let release: (v: unknown) => void = () => {};
    fetchJSON.mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );
    await mount("/chat?employee=emp_AAAA1111");
    expect(hosts().length).toBe(0);
    expect(container.textContent ?? "").toContain("正在打开对话");

    release({ id: "emp_AAAA1111", name: "小鲤" });
    await settle();
    expect(hosts().length).toBe(1);
  });
});
