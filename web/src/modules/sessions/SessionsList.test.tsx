// @vitest-environment jsdom
// React 18 的 act 需要显式声明测试环境（仓内先例：contexts/*.test.tsx）
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchMock = vi.fn();
vi.mock("@/modules/models/fetchJson", () => ({
  fetchJsonStrict: (url: string) => fetchMock(url),
}));

import { SessionsList } from "./SessionsList";
import {
  buildSessionsUrl,
  formatMessageCount,
  formatSessionTime,
  parseSessionsPage,
  shortSessionId,
  MISSING_PLACEHOLDER,
} from "./sessionsApi";

const EMP = "emp_86A81CE8FF6F42E187BCF2B540";

const ROW_A = {
  sessionId: "cs_01M7WRTBDXQBHM8JPZ9CPT69JD",
  tenantId: "t_seakoi_pilot",
  employeeId: EMP,
  createdAt: "2026-11-02T12:00:00.000Z",
  updatedAt: "2026-11-02T13:04:00.000Z",
  messageCount: 3,
};
const ROW_B = {
  sessionId: "cs_01M7XAVF6T9PGH0SH89V62JB7T",
  tenantId: "t_seakoi_pilot",
  employeeId: EMP,
  createdAt: "2026-11-03T02:00:00.000Z",
  updatedAt: "2026-11-03T04:30:00.000Z",
  messageCount: 0,
};
const ROW_C = {
  sessionId: "cs_01M7XBFR7XPAVSKMRG0000001",
  tenantId: "t_seakoi_pilot",
  employeeId: EMP,
  createdAt: "2026-11-04T02:00:00.000Z",
  updatedAt: "2026-11-04T02:10:00.000Z",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchMock.mockReset();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

function q(testid: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
}

async function render(employeeId = EMP): Promise<void> {
  await act(async () => {
    root.render(<SessionsList employeeId={employeeId} />);
  });
  // 让 fetchJsonStrict 的 promise 链跑完
  await act(async () => {});
}

/** 同一用例里重挂组件：换新 root，避免上一轮状态与 useEffect 依赖短路。 */
async function remount(employeeId = EMP): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  root = createRoot(container);
  await render(employeeId);
}

describe("sessionsApi 读口形制", () => {
  it("URL 只带白名单 query（employeeId / limit / cursor），不带 offset / total", () => {
    const url = buildSessionsUrl({ employeeId: EMP, limit: 20 });
    expect(url.startsWith("/agent-api/api/console-sessions?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("employeeId")).toBe(EMP);
    expect(params.get("limit")).toBe("20");
    expect(params.get("cursor")).toBeNull();
    expect(params.get("offset")).toBeNull();
    expect(params.get("total")).toBeNull();

    const second = new URLSearchParams(
      buildSessionsUrl({ employeeId: EMP, limit: 500, cursor: "  eyJ1IjoxIA==" }).split("?")[1],
    );
    expect(second.get("limit")).toBe("100");
    expect(second.get("cursor")).toBe("eyJ1IjoxIA==");
  });

  it("载荷形状不认识就抛，不把缺字段洗成 0", () => {
    expect(() => parseSessionsPage({})).toThrow(/items/);
    expect(() => parseSessionsPage([])).toThrow(/对象载荷/);
    expect(() => parseSessionsPage({ items: [{ tenantId: "t" }] })).toThrow(/sessionId/);
    const page = parseSessionsPage({ items: [ROW_A, ROW_C] });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
    // ROW_C 没有 messageCount 键 ⇒ null（未知），不是 0
    expect(page.items[1].messageCount).toBeNull();
  });

  it("缺值渲染口径：null→—，0→0 条，非法时间→—", () => {
    expect(formatMessageCount(null)).toBe(MISSING_PLACEHOLDER);
    expect(formatMessageCount(0)).toBe("0 条");
    expect(formatMessageCount(12)).toBe("12 条");
    expect(formatSessionTime(null)).toBe(MISSING_PLACEHOLDER);
    expect(formatSessionTime("not-a-time")).toBe(MISSING_PLACEHOLDER);
    expect(formatSessionTime("2026-11-02T13:04:00.000Z")).toMatch(/2026/);
    expect(formatSessionTime("2026-11-02T13:04:00.000Z")).toMatch(/21:04/);
    expect(shortSessionId(ROW_A.sessionId)).toBe("cs_01M…PT69JD");
  });
});

describe("SessionsList 真行列表", () => {
  it("按上游顺序渲染真行：短 id / 消息数 / 更新时间", async () => {
    fetchMock.mockResolvedValue({ items: [ROW_A, ROW_B], nextCursor: null });
    await render();

    expect(q("se2-sessions")).toBeTruthy();
    expect(q("se2-sessions-list")?.children.length).toBe(2);
    expect(q("se2-sessions-id-0")?.textContent).toBe(shortSessionId(ROW_A.sessionId));
    expect(q("se2-sessions-id-0")?.getAttribute("title")).toBe(ROW_A.sessionId);
    expect(q("se2-sessions-count-0")?.textContent).toBe("3 条");
    expect(q("se2-sessions-count-1")?.textContent).toBe("0 条");
    expect(q("se2-sessions-time-0")?.textContent).toMatch(/21:04/);
    // 有下一页才出现按钮：本页 nextCursor=null ⇒ 不渲染
    expect(q("se2-sessions-more")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`employeeId=${EMP}`);
  });

  it("缺 messageCount / updatedAt 显「—」，绝不折 0", async () => {
    // 上游历史行可能整键缺失：这里模拟真正缺键（不是 null，也不是 0）
    const sparse = {
      sessionId: ROW_C.sessionId,
      tenantId: "t_seakoi_pilot",
      employeeId: EMP,
      createdAt: "2026-11-04T02:00:00.000Z",
    };
    fetchMock.mockResolvedValue({ items: [sparse], nextCursor: null });
    await render();
    expect(q("se2-sessions-count-0")?.textContent).toBe(MISSING_PLACEHOLDER);
    expect(q("se2-sessions-time-0")?.textContent).toBe(MISSING_PLACEHOLDER);
    expect(container.textContent).not.toContain("0 条");
  });

  it("加载更多只认 nextCursor：追加一页、按 sessionId 去重、末页收起按钮", async () => {
    fetchMock
      .mockResolvedValueOnce({ items: [ROW_A], nextCursor: "cur-1" })
      .mockResolvedValueOnce({ items: [ROW_A, ROW_B], nextCursor: null });
    await render();

    expect(q("se2-sessions-list")?.children.length).toBe(1);
    const more = q("se2-sessions-more");
    expect(more).toBeTruthy();

    await act(async () => {
      more?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = new URLSearchParams(String(fetchMock.mock.calls[1][0]).split("?")[1]);
    expect(second.get("cursor")).toBe("cur-1");
    // ROW_A 重复回传不重复上屏
    expect(q("se2-sessions-list")?.children.length).toBe(2);
    expect(q("se2-sessions-id-1")?.textContent).toBe(shortSessionId(ROW_B.sessionId));
    expect(q("se2-sessions-more")).toBeNull();
  });

  it("空集与失败分开：空集说「暂无可查会话」，失败给重试", async () => {
    fetchMock.mockResolvedValueOnce({ items: [], nextCursor: null });
    await render();
    expect(q("se2-sessions-empty")).toBeTruthy();
    expect(container.textContent).toContain("该员工暂无可查会话");
    expect(q("se2-sessions-list")).toBeNull();

    fetchMock.mockReset();
    fetchMock
      .mockRejectedValueOnce(new ApiError("数据服务暂时没有响应，请稍后重试。", { status: 500, body: "", url: "/x" }))
      .mockResolvedValueOnce({ items: [ROW_A], nextCursor: null });
    await remount();
    expect(q("se2-sessions-error")).toBeTruthy();
    expect(container.textContent).toContain("数据服务暂时没有响应");

    await act(async () => {
      q("se2-sessions-retry")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {});
    expect(q("se2-sessions-list")?.children.length).toBe(1);
  });

  it("读口 404 / 401 / 403 各有诚实态，且零样例行", async () => {
    fetchMock.mockRejectedValueOnce(
      new ApiError("这个数据接口还没有接入。", { status: 404, body: "", url: "/x" }),
    );
    await render();
    expect(q("se2-sessions-unwired")).toBeTruthy();
    expect(container.textContent).toContain("未接入");
    expect(q("se2-sessions-list")).toBeNull();

    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(
      new ApiError("重新登录后回到这个页面，即可继续查看。", { status: 401, body: "", url: "/x" }),
    );
    await remount();
    expect(q("se2-sessions-login")).toBeTruthy();
    expect(q("se2-sessions-list")).toBeNull();

    fetchMock.mockReset();
    fetchMock.mockRejectedValueOnce(
      new ApiError("没有权限", { status: 403, body: "", url: "/x" }),
    );
    await remount();
    expect(q("se2-sessions-denied")).toBeTruthy();
    expect(q("se2-sessions-list")).toBeNull();
  });

  it("缺员工编号不发请求（不猜归属）", async () => {
    await render("   ");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(q("se2-sessions-error")).toBeTruthy();
    expect(container.textContent).toContain("缺少员工编号");
  });
});