// @vitest-environment jsdom
/**
 * SE-04 — 会话详情消费面：messages[].requestId 展示/复制 + citations「有才出现」。
 *
 * 契约（runtime CONSOLE-SESSIONS-SHAPE.md §3 只读核对）：
 *  1. 详情 URL＝/agent-api/api/console-sessions/<encodeURIComponent(id)>；
 *  2. 每条消息的 requestId 原样上屏、可复制；复制失败=「文本已保留可手动选取」
 *     假成功禁；缺键=「—（上游未回传）」；
 *  3. citations：assistant 缺键/空数组/非列表/无 doc → 「没有带回引用」，绝不
 *     渲染引用列表；真带回 → 「引用（N）：…」条目可读；
 *  4. 404（不存在与跨租户同体）→ 不推断存在性，且无消息渲染；
 *  5. 上游顺序保持（乱序 seq 不重排）；换行展开作废旧请求（竞态守卫）；
 *  6. 任何态零样例行、零假 200。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const strict = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: strict.fetchJsonStrict }));

import { ApiError } from "@/lib/api-error";
import { SessionsList } from "@/modules/sessions/SessionsList";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;

const LIST = {
  items: [{ sessionId: "ses_42", tenantId: "t1", employeeId: "emp_9", createdAt: "2026-11-20T00:00:00Z", updatedAt: "2026-11-21T03:04:00Z", messageCount: 2 }],
};

function queue(list: unknown, detail: unknown): void {
  strict.fetchJsonStrict.mockImplementation(async (url: string) => {
    if (String(url).includes("console-sessions?") || !/\/ses_/.test(String(url))) return list;
    if (detail instanceof Error) throw detail;
    return detail;
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  strict.fetchJsonStrict.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
});

async function mount(): Promise<void> {
  await act(async () => {
    root?.render(<SessionsList employeeId="emp_9" />);
  });
  await flush();
}

const q = (sel: string): Element | null => document.body.querySelector(sel);
const text = (): string => document.body.textContent ?? "";

async function expand(index = 0): Promise<void> {
  const btn = q(`[data-testid='se4-expand-${index}']`) as HTMLButtonElement | null;
  if (!btn) throw new Error("expand button missing");
  expect(btn.getAttribute("aria-expanded"), "收起态 aria-expanded=false").toBe("false");
  await act(async () => {
    btn.click();
  });
  await flush();
}

async function clickSel(sel: string): Promise<void> {
  const node = q(sel) as HTMLElement | null;
  if (!node) throw new Error(`${sel} missing`);
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
}

describe("SE-04 详情展开与 requestId", () => {
  it("展开即打详情读口（编码 URL），requestId 原样上屏可复制", async () => {
    queue(LIST, {
      sessionId: "ses_42",
      messageCount: 2,
      messages: [
        { seq: 1, role: "user", content: "查一下", requestId: "req-abc", createdAt: "2026-11-21T03:00:00Z" },
        { seq: 2, role: "assistant", content: "结果", requestId: "req-abc", createdAt: "2026-11-21T03:00:05Z", citations: [{ doc: "NIST-AI-RMF" }] },
      ],
    });
    await mount();
    await expand();
    const url = strict.fetchJsonStrict.mock.calls.map((c) => String(c[0])).find((u) => u.includes("ses_42"));
    expect(url).toBe("/agent-api/api/console-sessions/ses_42");
    expect(q("[data-testid='se4-msg-rid-0']")?.textContent).toContain("req-abc");
    expect(q("[data-testid='se4-msg-cites-1']")?.textContent).toContain("引用（1）");
    expect(q("[data-testid='se4-msg-cites-1']")?.textContent).toContain("NIST-AI-RMF");
    expect(q("[data-testid='se4-msg-nocite-1']")).toBeNull();
    expect(q("[data-testid='se4-msg-cites-0']")).toBeNull(); // user 行无引用区

    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
    await clickSel("[data-testid='se4-msg-rid-copy-0']");
    expect(write).toHaveBeenCalledWith("req-abc");
    expect(q("[data-testid='se4-msg-rid-copy-0']")?.textContent).toBe("已复制");
  });

  it("缺 requestId → 「—（上游未回传）」，无复制钮假象", async () => {
    queue(LIST, {
      sessionId: "ses_42",
      messageCount: 1,
      messages: [{ seq: 1, role: "user", content: "hi" }],
    });
    await mount();
    await expand();
    expect(q("[data-testid='se4-msg-norid-0']")?.textContent).toContain("上游未回传");
    expect(q("[data-testid='se4-msg-rid-copy-0']")).toBeNull();
  });

  it("剪贴板失败 → 不报成功，给手动选取话术", async () => {
    queue(LIST, {
      sessionId: "ses_42",
      messageCount: 1,
      messages: [{ seq: 1, role: "assistant", content: "ok", requestId: "req-x" }],
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    await mount();
    await expand();
    await clickSel("[data-testid='se4-msg-rid-copy-0']");
    expect(q("[data-testid='se4-msg-rid-copy-0']")?.textContent).toContain("复制失败");
    expect(text()).not.toContain("已复制");
  });
});

describe("SE-04 citations「有才出现」", () => {
  it.each([
    ["缺键", undefined],
    ["空数组", []],
    ["非列表", "docs"],
    ["无 doc 字段", [{ name: "x" }]],
  ])("%s 一律视为没有带回引用，绝不渲染引用列表", async (_label, raw) => {
    queue(LIST, {
      sessionId: "ses_42",
      messageCount: 1,
      messages: [{ seq: 1, role: "assistant", content: "a", requestId: "r1", citations: raw }],
    });
    await mount();
    await expand();
    expect(q("[data-testid='se4-msg-nocite-0']")?.textContent).toContain("没有带回引用");
    expect(q("[data-testid='se4-msg-cites-0']")).toBeNull();
  });
});

describe("SE-04 异常与竞态", () => {
  it("详情 404 → 不推断存在性、零消息渲染", async () => {
    queue(LIST, new ApiError("404", { status: 404, body: '{"code":"console_session.not_found","message":"console session not found"}', url: "/agent-api/api/console-sessions/ses_42" }));
    await mount();
    await expand();
    expect(q("[data-testid='se4-detail-error']")?.textContent).toContain("不存在或不可见");
    expect(q("[data-testid='se4-msg-0']")).toBeNull();
  });

  it("上游顺序保持：乱序 seq 不重排", async () => {
    queue(LIST, {
      sessionId: "ses_42",
      messageCount: 2,
      messages: [
        { seq: 7, role: "assistant", content: "SECOND", requestId: "r2" },
        { seq: 3, role: "user", content: "FIRST", requestId: "r1" },
      ],
    });
    await mount();
    await expand();
    expect(q("[data-testid='se4-msg-0']")?.textContent).toContain("SECOND");
    expect(q("[data-testid='se4-msg-1']")?.textContent).toContain("FIRST");
  });

  it("详情在飞时收起该行：迟到回答不得回填", async () => {
    strict.fetchJsonStrict
      .mockResolvedValueOnce(LIST)
      .mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 40));
        return {
          sessionId: "ses_42",
          messageCount: 1,
          messages: [{ seq: 1, role: "assistant", content: "OLD-LEAK", requestId: "r-old" }],
        };
      });
    await mount();
    await expand();
    expect(q("[data-testid='se4-detail-loading']")).toBeTruthy();
    await clickSel("[data-testid='se4-expand-0']"); // 收起：detailReq 序号作废在飞
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(text()).not.toContain("OLD-LEAK");
    expect(q("[data-testid='se4-detail-0']")).toBeNull();
  });
});
