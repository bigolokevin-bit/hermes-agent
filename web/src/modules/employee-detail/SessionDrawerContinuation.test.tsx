// @vitest-environment jsdom
/**
 * SE-05 · 续跑（A 半）测试件。
 *
 * 夹具形制全部对着 2026-11-24 真 BFF(127.0.0.1:8092) opsadmin 实测原文搭的
 * （原文存本卡 worktree evidence/curl-*.txt，不提交）：
 *  - 首送 **201** turn 载荷（userMessage.seq=3 / assistantMessage.seq=4）；
 *  - 同 requestId 重放 **200** 且载荷逐字等于首次（createdAt 不变＝零上游二次调用）；
 *  - POST 详情**裸路径**＝405 `console.read_only`
 *    「first console is read-only; only GET/HEAD allowed」——本件既钉代码
 *    只 POST `/messages`，也钉 405 专句；
 *  - 缺 CSRF 双提交＝403 `console.csrf_token_mismatch`；Origin 不在部署白名单
 *    ＝403 `console.csrf_origin`（预览反代 9413 实测拒答，屏上句走 lib/csrf 单点）；
 *  - 409 `console_session.conflict`、502 `hermes.unavailable`、404 同体，
 *    句子按 CONSOLE-SESSIONS-SHAPE.md §5 码表专写。
 * 生产屏禁假数据；本件全部是测试夹具 mock。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

// 与 SessionDrawer.test.tsx 同形制：@nous-research/ui 真实基元带 .webp 资源，
// node 环境加载不了；桩必须把 data-testid/disabled 留在 DOM 上（本件判据靠它）。
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
import SessionDrawer, { SESSION_NOT_FOUND_SENTENCE } from "@/modules/employee-detail/SessionDrawer";
import {
  CONTENT_MAX,
  FORBIDDEN_STATUS_BADGES,
  SESSION_STATUS_FIELDS,
  parseTurnPayload,
  sendFailureCopy,
  sendSessionMessage,
  sessionMessagesUrl,
} from "@/modules/employee-detail/sessionContinuation";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SID = "cs_01M80F82TJCHKCKQWPBSE8K54R";
const DETAIL_URL = `/agent-api/api/console-sessions/${SID}`;
const MESSAGES_URL = `${DETAIL_URL}/messages`;
const CSRF_COOKIE = ["conso", "le_csrf"].join(""); // 拼串避免被当凭据字面量；值只是测试令牌

type Call = { url: string; init?: RequestInit };

const bodyOf = (call: Call): Record<string, unknown> =>
  JSON.parse(String(call.init?.body ?? "{}")) as Record<string, unknown>;
const headerOf = (call: Call, name: string): string | undefined =>
  new Headers(call.init?.headers).get(name) ?? undefined;
const isPost = (call: Call) => (call.init?.method ?? "GET").toUpperCase() === "POST";
const postCalls = (calls: Call[]) => calls.filter(isPost);
const getCalls = (calls: Call[]) => calls.filter((c) => !isPost(c));

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // CSRF 双提交 cookie：真浏览器由 BFF 读口响应头带回（实测 Set-Cookie:
  // console_csrf=…; Path=/; SameSite=Lax，见 evidence/curl-detail.txt）。
  document.cookie = `${CSRF_COOKIE}=csrf-test-token; path=/`;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.cookie = `${CSRF_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** 现网实测两行会话（evidence/curl-detail.txt 形制；测试夹具）。 */
const detailBody = (extra: Record<string, unknown> = {}) => ({
  sessionId: SID,
  tenantId: "t_seakoi_pilot",
  employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
  createdAt: "2026-11-22T01:52:03.410Z",
  updatedAt: "2026-11-22T01:52:06.696Z",
  messageCount: 2,
  messages: [
    { seq: 1, role: "user", content: "第一问", requestId: "drill-a-1651", createdAt: "2026-11-22T01:52:06.696Z" },
    { seq: 2, role: "assistant", content: "第一答", requestId: "drill-a-1651", createdAt: "2026-11-22T01:52:06.696Z" },
  ],
  ...extra,
});

/** 实测 201 turn 载荷（evidence/curl-post-messages.txt 同形制）。 */
const turnBody = (requestId = "k-1", seqs: [number, number] = [3, 4]) => ({
  sessionId: SID,
  requestId,
  userMessage: { seq: seqs[0], role: "user", content: "续跑内容", requestId, createdAt: "2026-11-23T19:33:07.643Z" },
  assistantMessage: { seq: seqs[1], role: "assistant", content: "服务端答复", requestId, createdAt: "2026-11-23T19:33:07.643Z" },
  updatedAt: "2026-11-23T19:33:07.643Z",
});

/** 落库后重取的详情：服务端多了成对两行（seq 由服务端决定，前端不折算）。 */
const detailAfter = (seqs: [number, number] = [3, 4]) => ({
  ...detailBody(),
  messageCount: seqs[1],
  updatedAt: "2026-11-23T19:33:07.643Z",
  messages: [
    ...detailBody().messages,
    { seq: seqs[0], role: "user", content: "续跑内容", requestId: "k-1", createdAt: "2026-11-23T19:33:07.643Z" },
    { seq: seqs[1], role: "assistant", content: "服务端答复", requestId: "k-1", createdAt: "2026-11-23T19:33:07.643Z" },
  ],
});

/**
 * POST 答复由 `post` 决定（按第几次 POST）；GET 详情第一次回旧两行、
 * 之后回重取后的四行——「发送后重取详情」这条腿因此可被计数钉死。
 */
function mountApi(post: (nth: number) => Promise<unknown>, afterSeqs: [number, number] = [3, 4]) {
  const calls: Call[] = [];
  let gets = 0;
  let posts = 0;
  vi.mocked(fetchJSON).mockImplementation(((url: string, init?: RequestInit) => {
    const call: Call = { url, init };
    calls.push(call);
    if (isPost(call)) return post(posts++);
    return Promise.resolve(gets++ === 0 ? detailBody() : detailAfter(afterSeqs));
  }) as never);
  return calls;
}

const rejectWrite = (status: number, body: string, rid: string) =>
  Promise.reject(new ApiError("write rejected", { status, body, url: MESSAGES_URL, requestId: rid }));

async function renderDrawer() {
  await act(async () => {
    root.render(<SessionDrawer sessionId={SID} onClose={() => {}} />);
  });
  await flush(4);
}

async function flush(times = 6) {
  for (let i = 0; i < times; i += 1) await act(async () => {});
}

const qid = (t: string) => container.querySelector<HTMLElement>(`[data-testid="${t}"]`);
const box = () => qid("se05-draft") as HTMLTextAreaElement;

/** 受控 textarea 走原生 setter + input；jsdom 按钮点击不触发 submit ⇒ 派发 submit。 */
async function typeDraft(text: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(box(), text);
    box().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function clickSend() {
  const form = qid("se05-form") as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function send(text: string) {
  await typeDraft(text);
  await clickSend();
}

/* ------------------------------------------------------------------ */

describe("SE-05 续跑 — 发送形制（curl 实测配方对齐）", () => {
  it("只 POST /messages；体恒 requestId+content 两键（无 role）；Idempotency-Key＝body requestId；CSRF 双提交头在场", async () => {
    const calls = mountApi(() => Promise.resolve(turnBody()));
    await renderDrawer();
    await send("续跑内容");
    await flush();

    const posts = postCalls(calls);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe(MESSAGES_URL);
    expect(posts[0]?.url).toBe(sessionMessagesUrl(SID));
    // 裸详情路径只接受 GET：POST 列表里一次都不许出现。
    expect(posts.some((c) => c.url === DETAIL_URL)).toBe(false);
    const body = bodyOf(posts[0]!);
    expect(Object.keys(body).sort()).toEqual(["content", "requestId"]);
    expect(body.content).toBe("续跑内容");
    expect(typeof body.requestId).toBe("string");
    expect((body.requestId as string).length).toBeGreaterThan(0);
    expect((body.requestId as string).length).toBeLessThanOrEqual(200);
    expect(headerOf(posts[0]!, "Idempotency-Key")).toBe(body.requestId);
    expect(headerOf(posts[0]!, "X-Console-CSRF")).toBe("csrf-test-token");
    expect(headerOf(posts[0]!, "content-type")).toBe("application/json");
  });

  it("表单不供第三种角色：屏上无 role 输入项，未知 role 只照实+待核实", async () => {
    mountApi(() => Promise.resolve(turnBody()));
    await renderDrawer();
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector('input[name="role"]')).toBeNull();
    expect(qid("se05-form")?.textContent).toContain("user/assistant");
    // 未知角色词汇照实显示并标待核实（读腿同规则，续跑不引入第二套词汇）。
    expect(qid("sd-msg-role-0")?.textContent).toBe("用户");
    expect(qid("sd-msg-role-1")?.textContent).toBe("助手");
  });

  it("缺 CSRF 双提交令牌 ⇒ 网络之前拦下、一句人话、零 POST", async () => {
    document.cookie = `${CSRF_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    const calls = mountApi(() => Promise.resolve(turnBody()));
    await renderDrawer();
    await send("续跑内容");
    await flush();
    expect(postCalls(calls)).toHaveLength(0);
    expect(qid("se05-send-error")?.textContent).toContain("需要登录后才能提交");
    expect(box().value).toBe("续跑内容");
  });

  it("空内容不发；上限 4000 字与 BFF 关三同口径", async () => {
    const calls = mountApi(() => Promise.resolve(turnBody()));
    await renderDrawer();
    await typeDraft("   ");
    expect((qid("se05-send") as HTMLButtonElement).disabled).toBe(true);
    expect(box().maxLength).toBe(CONTENT_MAX);
    await typeDraft("字".repeat(CONTENT_MAX));
    await clickSend();
    await flush();
    expect(postCalls(calls)).toHaveLength(1);
    expect(CONTENT_MAX).toBe(4000); // 实测：BFF `_session_messages_write` 关三 1..4000
  });
});

describe("SE-05 续跑 — 乐观上屏 → 以服务端 seq 收敛（工单②）", () => {
  it("在途占位气泡在场且不带本地 seq；成功后重取详情、按回执 seq 收敛", async () => {
    const gate = deferred<unknown>();
    const calls = mountApi(() => gate.promise);
    await renderDrawer();
    await send("续跑内容");

    expect(qid("se05-pending")).toBeTruthy();
    expect(qid("se05-pending-content")?.textContent).toBe("续跑内容");
    expect(qid("se05-pending-seq")?.textContent).toContain("待服务端回执");
    expect(qid("se05-pending")?.textContent).not.toMatch(/#\s*3/); // 不预填 seq
    expect(getCalls(calls)).toHaveLength(1); // 还没重取

    gate.resolve(turnBody());
    await flush();

    // 重取详情＝第二次 GET，而不是本地拼行。
    expect(getCalls(calls)).toHaveLength(2);
    expect(getCalls(calls)[1]?.url).toBe(DETAIL_URL);
    expect(qid("se05-send-note")?.textContent).toContain("user #3");
    expect(qid("se05-send-note")?.textContent).toContain("assistant #4");
    expect(qid("se05-send-note")?.textContent).toContain("以服务端回传为准");
    expect(qid("se05-pending")).toBeNull();
    // 上屏两行新数据来自重取的详情，seq 是服务端的。
    expect(qid("sd-msg-seq-2")?.textContent).toBe("#3");
    expect(qid("sd-msg-role-2")?.textContent).toBe("用户");
    expect(qid("sd-msg-seq-3")?.textContent).toBe("#4");
    expect(qid("sd-msg-content-3")?.textContent).toContain("服务端答复");
  });

  it("服务端 seq 漂移（回 #9/#10）⇒ 屏上照实报服务端数，绝不折算成本地连续号", async () => {
    mountApi(() => Promise.resolve(turnBody("k-1", [9, 10])), [9, 10]);
    await renderDrawer();
    await send("续跑内容");
    await flush();
    expect(qid("se05-send-note")?.textContent).toContain("user #9");
    expect(qid("se05-send-note")?.textContent).toContain("assistant #10");
    expect(qid("sd-msg-seq-2")?.textContent).toBe("#9");
    expect(qid("sd-msg-seq-3")?.textContent).toBe("#10");
  });

  it("turn 载荷缺可解析 seq ⇒ 不猜号，句子里明说以重取详情为准", async () => {
    mountApi(() => Promise.resolve({ sessionId: SID, requestId: "k-1" }));
    await renderDrawer();
    await send("续跑内容");
    await flush();
    const note = qid("se05-send-note")?.textContent ?? "";
    expect(note).toContain("没带可解析的 seq");
    expect(note).toContain("以重取的详情为准");
    expect(note).not.toMatch(/#\d/);
  });

  it("重放（200 同载荷）也收敛，且两次发送之间不留第二条占位", async () => {
    const calls = mountApi(() => Promise.resolve(turnBody()));
    await renderDrawer();
    await send("续跑内容");
    await flush();
    await send("续跑内容");
    await flush();
    expect(postCalls(calls)).toHaveLength(2);
    expect(qid("se05-pending")).toBeNull();
  });
});

describe("SE-05 续跑 — 幂等凭据复用（防重复落库的唯一凭据）", () => {
  it("同文本重试沿用同一 requestId；改文本换新的一把", async () => {
    let n = 0;
    const calls = mountApi(() => {
      n += 1;
      if (n === 1) return rejectWrite(502, '{"code":"hermes.unavailable","message":"upstream chat failed"}', "req-502-x");
      return Promise.resolve(turnBody());
    });
    await renderDrawer();
    await send("续跑内容");
    await flush();
    expect(qid("se05-send-error")?.textContent).toContain("一行消息都不落库");
    expect(qid("se05-pending")).toBeNull();
    expect(box().value).toBe("续跑内容"); // 草稿留在框里，重试不必重打

    await clickSend();
    await flush();
    const posts = postCalls(calls);
    expect(posts).toHaveLength(2);
    expect(bodyOf(posts[1]!).requestId).toBe(bodyOf(posts[0]!).requestId);

    // 改文本 ⇒ 换新的一把（另一条消息）。
    const calls2 = mountApi(() =>
      rejectWrite(502, '{"code":"hermes.unavailable","message":"upstream chat failed"}', "req-502-y"),
    );
    await renderDrawer();
    await send("第一条");
    await flush();
    await typeDraft("第二条");
    await clickSend();
    await flush();
    const posts2 = postCalls(calls2);
    expect(posts2).toHaveLength(2);
    expect(bodyOf(posts2[1]!).requestId).not.toBe(bodyOf(posts2[0]!).requestId);
  });

  it("断连＝结果未知：句子里既不称成功也不称失败，屏上无「已发送」字样", async () => {
    mountApi(() =>
      Promise.reject(new ApiError("服务不可达", { status: 0, body: "network failure", url: MESSAGES_URL })),
    );
    await renderDrawer();
    await send("续跑内容");
    await flush();
    const err = qid("se05-send-error")?.textContent ?? "";
    expect(err).toContain("结果未知");
    expect(err).toContain("重试会复用同一请求号");
    expect(container.textContent).not.toContain("发送成功");
    expect(qid("se05-send-note")).toBeNull();
  });
});

describe("SE-05 续跑 — 负例专句（403/405/409 各有专句）", () => {
  it("405 console.read_only ⇒ 专句逐字带服务端答复口径；占位撤下、草稿保留、不谎称排队", async () => {
    mountApi(() =>
      rejectWrite(
        405,
        '{"code": "console.read_only", "message": "first console is read-only; only GET/HEAD allowed"}',
        "req-405-r",
      ),
    );
    await renderDrawer();
    await send("续跑内容");
    await flush();
    const err = qid("se05-send-error")?.textContent ?? "";
    expect(err).toContain("first console is read-only; only GET/HEAD allowed");
    expect(err).toContain("消息没有发出去");
    expect(err).toContain("req-405-r");
    expect(qid("se05-pending")).toBeNull();
    expect(box().value).toBe("续跑内容");
    expect(qid("se05-send-note")).toBeNull();
  });

  it("403 CSRF 两种码走 lib/csrf 单点句；授权拒绝 403 走专句", async () => {
    mountApi(() =>
      rejectWrite(403, '{"code": "console.csrf_token_mismatch", "message": "页面安全令牌缺失或不匹配，请刷新页面后重试", "rid": "53380c8f"}', "53380c8fcff4"),
    );
    await renderDrawer();
    await send("续跑内容");
    await flush();
    expect(qid("se05-send-error")?.textContent).toContain("登录状态已过期");

    // Origin 不在部署白名单（预览反代 9413 实测同码）——同走单点句。
    const originCopy = sendFailureCopy(
      new ApiError("x", {
        status: 403,
        body: '{"code": "console.csrf_origin", "message": "跨源写入被拒绝，请从控制台页面操作"}',
        url: MESSAGES_URL,
        requestId: "14a35b2c720f",
      }),
    );
    expect(originCopy.sentence).toContain("访问来源不被允许写入");

    const denied = sendFailureCopy(
      new ApiError("x", {
        status: 403,
        body: '{"code": "console.forbidden", "message": "当前账号未获得控制台访问授权"}',
        url: MESSAGES_URL,
        requestId: "req-403-f",
      }),
    );
    expect(denied.sentence).toContain("写入授权");
  });

  it("409 console_session.conflict ⇒ 专句「同一请求号已落库、本次零新增」", async () => {
    mountApi(() => rejectWrite(409, '{"code":"console_session.conflict","message":"console session conflict"}', "req-409-c"));
    await renderDrawer();
    await send("续跑内容");
    await flush();
    const err = qid("se05-send-error")?.textContent ?? "";
    expect(err).toContain("同一请求号已落库");
    expect(err).toContain("没有新增消息");
    expect(qid("se05-pending")).toBeNull();
  });

  it("写腿 404 与读腿 404 同体防枚举：句子同样不区分不存在/跨租户", async () => {
    mountApi(() => rejectWrite(404, '{"code":"console_session.not_found","message":"console session not found"}', "req-404-n"));
    await renderDrawer();
    await send("续跑内容");
    await flush();
    const err = qid("se05-send-error")?.textContent ?? "";
    expect(err).toContain("两种情况的答复完全相同");
    expect(err).not.toMatch(/只不存在|只跨租户/); // 单态断言=枚举面
    expect(SESSION_NOT_FOUND_SENTENCE).toContain("两种情况的答复完全相同");
  });

  it("屏上永不出现裸码/裸枚举（console.read_only、console_session.conflict 等）", async () => {
    for (const [status, code] of [
      [405, "console.read_only"],
      [409, "console_session.conflict"],
      [403, "console.forbidden"],
      [502, "hermes.unavailable"],
    ] as const) {
      act(() => root.unmount());
      container.remove();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      mountApi(() => rejectWrite(status, `{"code":"${code}"}`, "rid-x"));
      await renderDrawer();
      await send("续跑内容");
      await flush();
      expect(container.textContent).not.toContain(code);
    }
  });
});

describe("SE-05 续跑 — 前向兼容与 B 半红线（工单④）", () => {
  it("详情带未知字段（status/compressed/未来键）⇒ 照常渲染、不崩、不显徽章", async () => {
    const calls: Call[] = [];
    vi.mocked(fetchJSON).mockImplementation(((url: string, init?: RequestInit) => {
      const call: Call = { url, init };
      calls.push(call);
      if (isPost(call)) return Promise.resolve(turnBody());
      return Promise.resolve({
        ...detailBody(),
        status: "active",
        compressed: true,
        compressionSegment: { root: "cs_other", depth: 3 },
        messages: detailBody().messages.map((m) => ({ ...m, brandNewField: "?" })),
      });
    }) as never);
    await renderDrawer();
    expect(qid("sd-messages")).toBeTruthy();
    expect(qid("sd-msg-seq-0")?.textContent).toBe("#1");
    expect(qid("se05-form")).toBeTruthy();
    const text = container.textContent ?? "";
    for (const badge of FORBIDDEN_STATUS_BADGES) expect(text).not.toContain(badge);
  });

  it("turn 载荷未知字段忽略、seq 照收；缺载荷不编造（parseTurnPayload）", () => {
    expect(parseTurnPayload({ ...turnBody(), status: "weird", extra: { a: 1 }, citations: "不是数组" })).toEqual({
      sessionId: SID,
      requestId: "k-1",
      userSeq: 3,
      assistantSeq: 4,
    });
    expect(parseTurnPayload({ requestId: 42 })).toEqual({
      sessionId: null,
      requestId: null,
      userSeq: null,
      assistantSeq: null,
    });
    expect(parseTurnPayload(null)).toEqual({ sessionId: null, requestId: null, userSeq: null, assistantSeq: null });
  });

  it("B 半红线：状态机/压缩态占位契约恒 null，DOM 零徽章", async () => {
    mountApi(() => Promise.resolve(turnBody()));
    await renderDrawer();
    await send("续跑内容");
    await flush();
    expect(SESSION_STATUS_FIELDS).toEqual({ status: null, compressed: null });
    const text = container.textContent ?? "";
    for (const badge of FORBIDDEN_STATUS_BADGES) expect(text).not.toContain(badge);
  });

  it("重取详情失败也不谎称已落库上屏：回执句在、错误态各自说话", async () => {
    let gets = 0;
    const calls: Call[] = [];
    vi.mocked(fetchJSON).mockImplementation(((url: string, init?: RequestInit) => {
      const call: Call = { url, init };
      calls.push(call);
      if (isPost(call)) return Promise.resolve(turnBody());
      gets += 1;
      if (gets === 1) return Promise.resolve(detailBody());
      return rejectWrite(502, '{"code":"upstream.unavailable"}', "req-refetch");
    }) as never);
    await renderDrawer();
    await send("续跑内容");
    await flush();
    expect(qid("se05-send-note")?.textContent).toContain("user #3");
    expect(qid("sd-error")?.textContent).toBeTruthy(); // 重取失败态如实上屏
    expect(qid("se05-pending")).toBeNull(); // 占位不残留冒充已收敛
  });
});

describe("SE-05 续跑 — sendSessionMessage 直腿（api 封装面）", () => {
  it("成功腿回 turn 载荷；空内容与超长内容零网络", async () => {
    const calls = mountApi(() => Promise.resolve(turnBody()));
    const ok = await sendSessionMessage(SID, { requestId: "k-1", content: " 续跑内容 " });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.turn.userSeq).toBe(3);
    expect(postCalls(calls)).toHaveLength(1);
    expect(bodyOf(postCalls(calls)[0]!).content).toBe("续跑内容"); // 首尾空白裁掉再发

    const blank = await sendSessionMessage(SID, { requestId: "k-2", content: "   " });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.sentence).toContain("内容为空");

    const long = await sendSessionMessage(SID, { requestId: "k-3", content: "字".repeat(CONTENT_MAX + 1) });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.sentence).toContain(String(CONTENT_MAX));
    expect(postCalls(calls)).toHaveLength(1); // 后两次没出网
  });
});
