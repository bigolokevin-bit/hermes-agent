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
import { ProfileContext } from "@/contexts/profile-context";

const fetchJSON = vi.fn();
const setManagementProfile = vi.fn();
const ptyAttachToken = vi.fn();
const hostEvents: string[] = [];

// The root profile scope the page reads to resolve a legal profile. `/api/
// profiles` always lists at least "default"; the ids below stand in for the
// profiles that genuinely exist on the host's disk. Tests that exercise the
// fallback leave the employee's resolved name out of this list.
const DEFAULT_PROFILES = ["default", "emp_9f3a4b7c", "emp_aaaa1111", "emp_bbbb2222"];

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

async function mount(
  entry: string,
  props?: { employeeId?: string | null },
  opts?: { profiles?: string[] },
) {
  const profiles = opts?.profiles ?? DEFAULT_PROFILES;
  if (root) act(() => root.unmount());
  if (container) container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <ProfileContext.Provider
        value={{ profile: "", currentProfile: "default", profiles, setProfile: () => {} }}
      >
        <MemoryRouter initialEntries={[entry]}>
          <ChatModulePage {...props} />
        </MemoryRouter>
      </ProfileContext.Provider>,
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
  /**
   * 2026-11-26 契约变更（用户拍板 A：每员工独立 profile）：
   * 打开员工对话时确保 `emp-<8位小写>` 这个 Hermes profile 存在（不存在就用
   * clone_from_default 建一个），然后宿主在该 profile 里跑。
   * 所以 fetchJSON 会先打 GET /api/profiles，可能再打 POST /api/profiles，
   * 之后才是员工详情。这里的 route() 就是按这个顺序分流的桩。
   */
  const route = (opts?: {
    profiles?: string[];
    createFails?: boolean;
    employees?: (url: string) => Promise<unknown>;
  }) =>
    fetchJSON.mockImplementation((url: string, init?: { method?: string }) => {
      if (url === "/api/profiles") {
        if (init?.method === "POST")
          return opts?.createFails
            ? Promise.reject(new Error("profile write denied"))
            : Promise.resolve({ ok: true, name: "created" });
        return Promise.resolve({ profiles: (opts?.profiles ?? []).map((name) => ({ name })) });
      }
      return (opts?.employees ?? defaultFacts)(url);
    });

  /**
   * 人设素材的默认桩：建档前要先读员工档案与最近一版岗位职责（soul 不能继承）。
   * 缺这两样，独立档就不会建 —— 所以任何「期望建档成功」的用例都必须供给它们。
   */
  const defaultFacts = (url: string) => {
    if (url.startsWith("/agent-api/api/employees/"))
      return Promise.resolve({ name: "契约测试员工", title: "质量岗", department: "质量部" });
    if (url.startsWith("/agent-api/api/employee-versions"))
      return Promise.resolve({
        items: [
          {
            effectiveFrom: "2026-11-20T00:00:00Z",
            jobDescription: "验证控制台契约与回归。",
            responsePolicy: { triggers: ["被指派"], mode: "sync" },
          },
        ],
      });
    return ok();
  };

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

  it("CHAT-01 绑定员工：自动确保独立档存在，宿主在该档里挂载", async () => {
    route({ profiles: ["default"] });
    await mount("/chat?employee=emp_9f3a4b7c");

    const urls = fetchJSON.mock.calls.map((c) => [c[0], (c[1] as { method?: string } | undefined)?.method]);
    expect(urls[0]).toEqual(["/api/profiles", undefined]);
    // 磁盘上没有 → 建一个（POST 可能排在员工详情之后：两腿并行，谁先 await 完谁先发）
    expect(urls.filter(([u, m]) => u === "/api/profiles" && m === "POST").length).toBe(1);
    expect(urls.some(([u]) => u === "/agent-api/api/employees/emp_9f3a4b7c")).toBe(true);

    // 人格不继承：建档请求必须带上按该员工岗位职责合成的人设，
    // 否则克隆来的 system_prompt 会让它自称上一位员工（2026-11-26 实测事故）。
    const post = fetchJSON.mock.calls.find(
      (c) => c[0] === "/api/profiles" && (c[1] as { method?: string } | undefined)?.method === "POST",
    );
    const body = JSON.parse(String((post?.[1] as { body?: string } | undefined)?.body ?? "{}")) as {
      soul?: string;
    };
    expect(body.soul).toContain("契约测试员工");
    expect(body.soul).toContain("验证控制台契约与回归。");
    expect(body.soul).toContain("质量岗");

    expect(ptyAttachToken).toHaveBeenCalledWith(true);
    expect(hosts().length).toBe(1);
    expect(hostEvents).toEqual(["mount:emp-9f3a4b7c"]);
    expect(setManagementProfile).toHaveBeenCalledWith("emp-9f3a4b7c");
    // 界面上给的是 profile 名，不是裸员工编号
    expect(container.textContent ?? "").not.toContain("emp_9f3a4b7c");
    expect(container.textContent ?? "").toContain("员工独立档");
  });

  it("独立档已存在：不重复创建（零 POST）", async () => {
    route({ profiles: ["default", "emp-9f3a4b7c"] });
    await mount("/chat?employee=emp_9f3a4b7c");
    const posts = fetchJSON.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === "POST");
    expect(posts.length).toBe(0);
    expect(hostEvents).toEqual(["mount:emp-9f3a4b7c"]);
  });

  it("同员工重渲染不重建宿主（刷新态不断连）", async () => {
    route({ profiles: ["default", "emp-aaaa1111"] });
    await mount("/chat", { employeeId: "emp_AAAA1111" });
    expect(hostEvents).toEqual(["mount:emp-aaaa1111"]);
    expect(setManagementProfile).toHaveBeenCalledWith("emp-aaaa1111");

    await act(async () => {
      root.render(
        <ProfileContext.Provider
          value={{ profile: "", currentProfile: "default", profiles: DEFAULT_PROFILES, setProfile: () => {} }}
        >
          <MemoryRouter initialEntries={["/chat"]}>
            <ChatModulePage employeeId="emp_AAAA1111" />
          </MemoryRouter>
        </ProfileContext.Provider>,
      );
    });
    await settle();
    expect(hostEvents).toEqual(["mount:emp-aaaa1111"]);
    expect(hosts().length).toBe(1);
  });

  it("CHAT-04 换员工：旧宿主先拆除，新宿主按新员工重新轮换 token", async () => {
    route({ profiles: ["default", "emp-aaaa1111", "emp-bbbb2222"] });
    await mount("/chat", { employeeId: "emp_AAAA1111" });
    expect(hostEvents).toEqual(["mount:emp-aaaa1111"]);

    await act(async () => {
      root.render(
        <ProfileContext.Provider
          value={{ profile: "", currentProfile: "default", profiles: DEFAULT_PROFILES, setProfile: () => {} }}
        >
          <MemoryRouter initialEntries={["/chat"]}>
            <ChatModulePage employeeId="emp_BBBB2222" />
          </MemoryRouter>
        </ProfileContext.Provider>,
      );
    });
    await settle();

    expect(hosts().length).toBe(1); // 不留第二个宿主
    expect(hostEvents).toContain("unmount:emp-aaaa1111"); // 旧 WS 随卸载关闭
    expect(hostEvents[hostEvents.length - 1]).toBe("mount:emp-bbbb2222");
    expect(ptyAttachToken.mock.calls).toEqual([[true], [true]]);
  });

  it("建档失败：落回默认档并在页面上说明，不假装隔离生效", async () => {    route({ profiles: ["default"], createFails: true, employees: defaultFacts });
    await mount("/chat", { employeeId: "emp_86A81CE8FF6F42E187BCF2B540" });

    expect(hosts().length).toBe(1); // 右栏照常可用，不拒绝挂载
    expect(hostEvents).toEqual(["mount:—"]);
    expect(setManagementProfile).toHaveBeenCalledWith("");
    const text = container.textContent ?? "";
    expect(text).toContain("独立对话档创建失败");
    expect(text).toContain("会话不会归属到该员工");
    expect(text).not.toContain("does not exist");
  });

  it("人设素材不全（没有岗位职责）：不建档，退回默认档并说明原因", async () => {
    route({
      profiles: ["default"],
      employees: (url) =>
        url.startsWith("/agent-api/api/employees/")
          ? Promise.resolve({ name: "空职责员工", title: "质量岗" })
          : Promise.resolve({ items: [] }),
    });
    await mount("/chat", { employeeId: "emp_aaaaaaaaaaaa" });

    // 绝不拿克隆来的「上一位员工」开场白顶上：宁可不建独立档。
    const posts = fetchJSON.mock.calls.filter(
      (c) => (c[1] as { method?: string } | undefined)?.method === "POST",
    );
    expect(posts.length).toBe(0);
    const text = container.textContent ?? "";
    expect(text).toContain("独立对话档创建失败");
    expect(text).toContain("岗位职责");
  });

  it("CHAT-03 出错：人话 + 请求编号 + 重试；宿主不挂载", async () => {
    route({
      profiles: ["default", "emp-aaaa1111"],
      employees: () =>
        Promise.reject(
          new ApiError("服务暂时无法访问。", {
            status: 500,
            body: JSON.stringify({ request_id: "req-77a1" }),
            url: "/agent-api/api/employees/emp_AAAA1111",
          }),
        ),
    });
    await mount("/chat?employee=emp_AAAA1111");

    const text = container.textContent ?? "";
    expect(text).toContain("对话暂时不可用");
    expect(text).toContain("请求编号：req-77a1");
    expect(text).toContain("重试");
    expect(text).not.toContain("HTTP 500");
    expect(hosts().length).toBe(0);

    route({ profiles: ["default", "emp-aaaa1111"] });
    const retry = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("重试"),
    );
    expect(retry).toBeTruthy();
    await act(async () => (retry as HTMLElement).click());
    await settle();
    expect(hosts().length).toBe(1);
  });

  it("CHAT-10 denied(403)：「无权限或未开放」话术，不挂宿主不泄漏", async () => {
    route({
      profiles: ["default", "emp-aaaa1111"],
      employees: () =>
        Promise.reject(
          new ApiError("forbidden", {
            status: 403,
            body: "",
            url: "/agent-api/api/employees/emp_AAAA1111",
          }),
        ),
    });
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

  it("控制台建的老档人格是错的：打开时按员工档案改写 SOUL.md", async () => {
    fetchJSON.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
      if (url === "/api/profiles")
        return Promise.resolve({
          profiles: [{ name: "emp-aaaa1111", description: "数字员工 emp_AAAA1111 的独立对话档（控制台自动创建）" }],
        });
      if (url.endsWith("/soul")) {
        if (init?.method === "PUT") return Promise.resolve({ ok: true });
        // 克隆默认档留下的是通用人设，没有任何员工信息
        return Promise.resolve({ content: "You are Hermes Agent, built by Nous Research.", exists: true });
      }
      if (url.startsWith("/agent-api/api/employees/"))
        return Promise.resolve({ name: "小鲤", title: "产品助理", department: "产品部" });
      return Promise.resolve({
        items: [{ effectiveFrom: "2026-11-20T00:00:00Z", jobDescription: "负责控制台需求。", responsePolicy: {} }],
      });
    });
    await mount("/chat?employee=emp_AAAA1111");
    for (let i = 0; i < 4; i += 1) await settle();

    const put = fetchJSON.mock.calls.find(
      (c) => String(c[0]).endsWith("/soul") && (c[1] as { method?: string } | undefined)?.method === "PUT",
    );
    const body = JSON.parse(String((put?.[1] as { body?: string } | undefined)?.body ?? "{}")) as { content?: string };
    expect(body.content).toContain("# 小鲤 · 产品助理（产品部）");
    expect(body.content).toContain("负责控制台需求。");

    // 叠加层同拍校正：不删这一层，只把内容换成这位员工的「组织上下文」，
    // 并明确把身份让给 SOUL.md —— 否则克隆来的另一位员工说明会与 SOUL 打架。
    const cfg = fetchJSON.mock.calls.find(
      (c) =>
        String(c[0]).startsWith("/api/config?profile=") &&
        (c[1] as { method?: string } | undefined)?.method === "PUT",
    );
    expect(String(cfg?.[0])).toContain("profile=emp-aaaa1111");
    const cfgBody = JSON.parse(String((cfg?.[1] as { body?: string } | undefined)?.body ?? "{}")) as {
      config?: { agent?: { system_prompt?: string } };
    };
    const overlay = cfgBody.config?.agent?.system_prompt ?? "";
    expect(overlay).toContain("## 组织上下文");
    expect(overlay).toContain("- 员工：小鲤");
    expect(overlay).toContain("以 SOUL.md 为准");
    expect(hostEvents).toEqual(["mount:emp-aaaa1111"]);
  });

  it("用户自己写的人格（无受管标记、非控制台建档）：一个字都不改", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url === "/api/profiles") return Promise.resolve({ profiles: [{ name: "emp-aaaa1111", description: "" }] });
      if (url.endsWith("/soul")) return Promise.resolve({ content: "# 我自己写的人设\n\n只说短句。", exists: true });
      if (url.startsWith("/agent-api/api/employees/"))
        return Promise.resolve({ name: "小鲤", title: "产品助理" });
      return Promise.resolve({ items: [] });
    });
    await mount("/chat?employee=emp_AAAA1111");
    for (let i = 0; i < 4; i += 1) await settle();

    expect(
      fetchJSON.mock.calls.some((c) => (c[1] as { method?: string } | undefined)?.method === "PUT"),
    ).toBe(false);
    expect(hostEvents).toEqual(["mount:emp-aaaa1111"]);
  });

  it("详情未定（loading）：只显示忙碌态，绝不先挂宿主", async () => {
    let release: (v: unknown) => void = () => {};
    let holds = 0;
    fetchJSON.mockImplementation((url: string) => {
      if (url === "/api/profiles")
        return Promise.resolve({ profiles: [{ name: "default" }, { name: "emp-aaaa1111" }] });
      // 已存在的档先核对 SOUL（空文件 → 由本体写入），再读人设素材：
      // 员工档案这一腿故意挂起，用来验证「详情未定不挂宿主」。
      if (url.endsWith("/soul")) return Promise.resolve({ content: "", exists: false });
      if (url.startsWith("/agent-api/api/employees/")) {
        // 第一次（人设素材）挂起；第二次（页面自己的档案腿）立即回，
        // 否则两腿都等同一个 release，后发的那个永远不 resolve。
        if (holds === 0) {
          holds += 1;
          return new Promise((resolve) => {
            release = resolve;
          });
        }
        return Promise.resolve({ id: "emp_AAAA1111", name: "小鲤", title: "产品助理" });
      }
      return Promise.resolve({
        items: [
          { effectiveFrom: "2026-11-20T00:00:00Z", jobDescription: "验证控制台契约。", responsePolicy: {} },
        ],
      });
    });
    await mount("/chat?employee=emp_AAAA1111");
    expect(hosts().length).toBe(0);
    expect(container.textContent ?? "").toContain("正在打开对话");

    release({ id: "emp_AAAA1111", name: "小鲤", title: "产品助理" });
    // 这一腿现在多两级 await（核对 SOUL → 合成 → 写回），一次 flush 不够。
    await settle();
    await settle();
    await settle();
    expect(hosts().length).toBe(1);
  });
});

describe("employeeProfileName（工号 → 合法 profile 名）", () => {
  it("大写与非法字符规整为 emp-<8 位小写>", async () => {
    const { employeeProfileName } = await import("@/modules/chat/ChatModulePage");
    expect(employeeProfileName("emp_9F3A4B7C1234")).toBe("emp-9f3a4b7c");
    expect(employeeProfileName("Emp:001")).toBe("emp-001");
    expect(employeeProfileName("")).toBe(null);
  });
});
