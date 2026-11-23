// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

// 与页面测试同形制：@nous-research/ui 的真实基元带 .webp 资源，node 环境加载不了；
// 用带 rest 透传的桩（data-testid 必须留在 DOM 上，本文件判据靠它）。
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <span {...(rest as Record<string, never>)}>{children}</span>
  ),
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import SessionDrawer, {
  RENDER_WINDOW,
  SESSION_NOT_FOUND_SENTENCE,
  parseSessionDetail,
  sessionDetailUrl,
} from "@/modules/employee-detail/SessionDrawer";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SID = "cs_01M80F82TJCHKCKQWPBSE8K54R";

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function mockApi(handler: (url: string) => Promise<unknown>) {
  vi.mocked(fetchJSON).mockImplementation(((url: string) => handler(url)) as never);
}

async function renderDrawer(element: ReactElement) {
  await act(async () => {
    root.render(element);
  });
  for (let i = 0; i < 4; i += 1) await act(async () => {});
}

const qid = (t: string) => container.querySelector(`[data-testid="${t}"]`);
const citationNodes = () => container.querySelectorAll('[data-testid^="sd-citations-"]');

/** 现网实测详情响应（evidence/raw-sessions-detail-real.json 同形制，仅测试内使用）。 */
const realDetailBody = () => ({
  sessionId: SID,
  tenantId: "t_seakoi_pilot",
  employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
  createdAt: "2026-11-22T01:52:03.410Z",
  updatedAt: "2026-11-22T01:52:06.696Z",
  messageCount: 2,
  messages: [
    {
      seq: 1,
      role: "user",
      content: "演练台 M1：请用一句话回复当前时间",
      requestId: "drill-a-1651",
      createdAt: "2026-11-22T01:52:06.696Z",
    },
    {
      seq: 2,
      role: "assistant",
      content: "The current time is Sunday, November 22, 2026, 00:00:00 CST (UTC+08:00).",
      requestId: "drill-a-1651",
      createdAt: "2026-11-22T01:52:06.696Z",
    },
  ],
});

const notFoundError = (url: string, rid: string) =>
  Promise.reject(
    new ApiError("console session not found", {
      status: 404,
      body: '{"code":"console_session.not_found","message":"console session not found"}',
      url,
      requestId: rid,
    }),
  );

describe("SessionDrawer — 全字段渲染（契约 §3）", () => {
  it("fetches the detail read port by sessionId and renders seq/role/content/requestId/createdAt on every row", async () => {
    const urls: string[] = [];
    mockApi((url) => {
      urls.push(url);
      return Promise.resolve(realDetailBody());
    });
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(urls).toEqual([sessionDetailUrl(SID)]);
    expect(urls[0]).toBe(`/agent-api/api/console-sessions/${SID}`);
    // user 行
    expect(qid("sd-msg-role-0")?.textContent).toBe("用户");
    expect(qid("sd-msg-seq-0")?.textContent).toBe("#1");
    expect(qid("sd-msg-rid-0")?.textContent).toBe("drill-a-1651");
    expect(qid("sd-msg-time-0")?.textContent).toBe("2026-11-22 09:52");
    expect(qid("sd-msg-content-0")?.textContent).toContain("演练台 M1");
    // assistant 行
    expect(qid("sd-msg-role-1")?.textContent).toBe("助手");
    expect(qid("sd-msg-seq-1")?.textContent).toBe("#2");
    expect(qid("sd-msg-rid-1")?.textContent).toBe("drill-a-1651");
    expect(qid("sd-msg-content-1")?.textContent).toContain("current time");
    // 全量口径注记，不谎称分页
    expect(qid("sd-slice-note")?.textContent).toContain("2 条");
    expect(qid("sd-scope")?.textContent).toContain("全量");
  });

  it("renders markdown content through the shared Markdown component", async () => {
    mockApi(() =>
      Promise.resolve({
        sessionId: SID,
        messages: [
          { seq: 1, role: "assistant", content: "**要点** 与 `代码`", requestId: "r1", createdAt: null },
        ],
      }),
    );
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    const body = qid("sd-msg-content-0");
    expect(body?.querySelector("strong")?.textContent).toBe("要点");
    expect(body?.querySelector("code")?.textContent).toBe("代码");
  });

  it("missing or non-string fields show honest placeholders, never a folded zero", async () => {
    mockApi(() =>
      Promise.resolve({
        sessionId: SID,
        messages: [
          { role: "user", content: "缺 seq 与时间" },
          { seq: 3, role: "system", content: 42, createdAt: "not-a-date" },
        ],
      }),
    );
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(qid("sd-msg-seq-0")?.textContent).toBe("seq —");
    expect(qid("sd-msg-time-0")?.textContent).toBe("—");
    expect(qid("sd-msg-rid-0")?.textContent).toBe("req —");
    // 未知 role 照实显示并标待核实；content 非字符串不编造。
    expect(qid("sd-msg-role-1")?.textContent).toContain("system（待核实）");
    expect(qid("sd-msg-content-1")?.textContent).toBe("—");
  });
});

describe("SessionDrawer — citations「有才出现」（契约 §3 双态）", () => {
  it("assistant row WITH citations key renders the citation area with entry fields", async () => {
    mockApi(() =>
      Promise.resolve({
        sessionId: SID,
        messageCount: 2,
        messages: [
          { seq: 1, role: "user", content: "问", requestId: "r1", createdAt: "2026-11-22T01:00:00Z" },
          {
            seq: 2,
            role: "assistant",
            content: "答",
            requestId: "r1",
            createdAt: "2026-11-22T01:00:01Z",
            citations: [
              { doc: "数据安全管理办法.pdf", section: "§3.1", score: 0.87 },
              { doc: "监管语料总目录.md" },
            ],
          },
        ],
      }),
    );
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(qid("sd-citations-1")?.textContent).toContain("引用 · 2 条");
    expect(qid("sd-citation-1-0")?.textContent).toContain("数据安全管理办法.pdf");
    expect(qid("sd-citation-1-0")?.textContent).toContain("§3.1");
    expect(qid("sd-citation-1-0")?.textContent).toContain("0.87");
    expect(qid("sd-citation-1-1")?.textContent).toContain("监管语料总目录.md");
    // user 行不受引用键影响：它本来就没有。
    expect(citationNodes().length).toBe(1);
  });

  it("assistant row WITHOUT citations key renders zero citation traces (real measured shape)", async () => {
    // 现网实测：真会话 assistant 行就是缺 citations 键——绝不显空引用块。
    mockApi(() => Promise.resolve(realDetailBody()));
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(citationNodes().length).toBe(0);
    expect(container.textContent).not.toContain("引用");
  });

  it("assistant row with citations [] (contract violation) still renders no empty block", async () => {
    mockApi(() =>
      Promise.resolve({
        sessionId: SID,
        messages: [
          { seq: 1, role: "assistant", content: "答", requestId: "r1", createdAt: null, citations: [] },
        ],
      }),
    );
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(citationNodes().length).toBe(0);
    expect(container.textContent).not.toContain("引用");
  });

  it("user rows NEVER show citations, even if a stray citations key arrived", async () => {
    mockApi(() =>
      Promise.resolve({
        sessionId: SID,
        messages: [
          {
            seq: 1,
            role: "user",
            content: "问",
            requestId: "r1",
            createdAt: null,
            citations: [{ doc: "不应出现" }],
          },
        ],
      }),
    );
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(citationNodes().length).toBe(0);
    expect(container.textContent).not.toContain("不应出现");
  });

  it("parseSessionDetail marks citations absent for missing key, non-list values and non-assistant roles", () => {
    const detail = parseSessionDetail({
      messages: [
        { seq: 1, role: "assistant", content: "a" },
        { seq: 2, role: "assistant", content: "b", citations: "oops" },
        { seq: 3, role: "user", content: "c", citations: [{ doc: "x" }] },
        { seq: 4, role: "assistant", content: "d", citations: [{ doc: "y" }] },
      ],
    });
    expect(detail.messages[0].citations).toBeNull();
    expect(detail.messages[1].citations).toBeNull();
    expect(detail.messages[2].citations).toBeNull();
    expect(detail.messages[3].citations).toHaveLength(1);
  });
});

describe("SessionDrawer — 404 同体（防枚举）与错误态", () => {
  it("not-found 404 shows one plain sentence and a copyable request id", async () => {
    mockApi((url) => notFoundError(url, "req-404-aaaa"));
    await renderDrawer(<SessionDrawer sessionId="cs_MISSING000000000000000000" onClose={() => {}} />);
    expect(qid("sd-not-found")).toBeTruthy();
    expect(qid("sd-not-found")?.textContent).toContain(SESSION_NOT_FOUND_SENTENCE);
    expect(qid("req-copy")).toBeTruthy();
    expect(qid("sd-not-found")?.textContent).toContain("req-404-aaaa");
  });

  it("cross-tenant 404 (byte-identical body) renders byte-identical copy — the UI cannot distinguish", async () => {
    mockApi((url) => notFoundError(url, "req-same-0001"));
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    const first = container.textContent;
    act(() => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(container.textContent).toBe(first);
  });

  it("server errors keep the humanized message and rid; loading never sticks", async () => {
    mockApi((url) =>
      Promise.reject(new ApiError("服务暂时不可用。", { status: 502, body: "", url, requestId: "req-502-x" })),
    );
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(qid("sd-error")?.textContent).toContain("服务暂时不可用。");
    expect(qid("sd-error")?.textContent).toContain("req-502-x");
  });
});

describe("SessionDrawer — 长会话渲染切片诚实", () => {
  const many = (total: number) => ({
    sessionId: SID,
    messageCount: total,
    messages: Array.from({ length: total }, (_, i) => ({
      seq: i + 1,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `消息 ${i + 1}`,
      requestId: `r${i + 1}`,
      createdAt: "2026-11-22T01:00:00Z",
    })),
  });

  it("renders first slice, states the real total, and expands without ever claiming 已全部加载 early", async () => {
    mockApi(() => Promise.resolve(many(RENDER_WINDOW + 50)));
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    const rows = () =>
      Array.from(container.querySelectorAll("li")).filter((li) => li.getAttribute("data-testid")?.startsWith("sd-msg-"));
    expect(rows().length).toBe(RENDER_WINDOW);
    const note = qid("sd-slice-note")?.textContent ?? "";
    expect(note).toContain(String(RENDER_WINDOW + 50));
    expect(note).toContain("渲染切片");
    expect(note).not.toContain("已全部加载");
    expect(container.textContent).not.toContain("已全部加载");
    await act(async () => {
      (qid("sd-show-more") as HTMLElement).click();
    });
    for (let i = 0; i < 2; i += 1) await act(async () => {});
    expect(rows().length).toBe(RENDER_WINDOW + 50);
    expect(qid("sd-slice-note")?.textContent).toContain(`全部 ${RENDER_WINDOW + 50} 条消息已渲染上屏`);
  });

  it("declared messageCount mismatch is stated with both numbers, never folded", async () => {
    mockApi(() =>
      Promise.resolve({
        sessionId: SID,
        messageCount: 9,
        messages: [
          { seq: 1, role: "user", content: "只回传了两条", requestId: "r1", createdAt: null },
          { seq: 2, role: "assistant", content: "对上", requestId: "r1", createdAt: null },
        ],
      }),
    );
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    const mismatch = qid("sd-count-mismatch")?.textContent ?? "";
    expect(mismatch).toContain("messageCount=9");
    expect(mismatch).toContain("2 条");
  });

  it("empty messages array is stated as a real zero, not a failure", async () => {
    mockApi(() => Promise.resolve({ sessionId: SID, messageCount: 0, messages: [] }));
    await renderDrawer(<SessionDrawer sessionId={SID} onClose={() => {}} />);
    expect(qid("sd-empty")?.textContent).toContain("还没有消息");
    expect(qid("sd-error")).toBeNull();
  });
});

describe("SessionDrawer — 关闭行为", () => {
  it("close button and Escape call onClose", async () => {
    let closed = 0;
    mockApi(() => Promise.resolve(realDetailBody()));
    await renderDrawer(
      <SessionDrawer
        sessionId={SID}
        onClose={() => {
          closed += 1;
        }}
      />,
    );
    await act(async () => {
      (qid("sd-close") as HTMLElement).click();
    });
    expect(closed).toBe(1);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(closed).toBe(2);
  });
});
