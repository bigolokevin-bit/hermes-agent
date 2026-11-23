// @vitest-environment jsdom
/**
 * AP-03 — 详情时间线（事件合流）与内联「处理记录」。
 *
 * 取证口径（禁 fixture）：本件的载荷形制逐字取自 2026-11-23 本机真登录腿
 * 落盘的原文（worktree evidence/，BFF 8092→域 8101）：
 *  - `raw-detail-ap_0C67930A766D4AA49E4B5B44EC.json`：status=expired、
 *    decisions[1]={userId:"human:1",verdict:"approve",comment:"B 线演练批准",
 *    decidedAt:"2026-11-22T02:36:49.066Z"}、expiresAt="2026-11-23T02:36:34.263Z"、
 *    createdAt="2026-11-22T02:36:34.263Z"；响应不带 supersededBy 键。
 *  - `raw-audit-resourceid.json`：GET /api/audit?resourceId=ap_0C6793…&limit=50
 *    → 200，顶层 keys=[events,limit,cursor,hasMore,total,totalSource]，3 行、
 *    服务端倒序返回，行内 eventId/occurredAt/actor{type,id}/action/outcome。
 *  - `raw-audit-noFilter.json`：只带 limit → 400 console.missing_filter
 *    （⇒ resourceId 必带，读不了就不读）。
 *  - 无会话 cookie → 401 console.unauthenticated + X-Console-Request-Id
 *    （无权档屏上句子由本件用真形制的 ApiError 驱动）。
 *
 * 锁的条款（工单 §AP-03 DoD）：
 *  ① 合流排序：提交 → 票 → 到期，全部按服务带回的 atRaw；supersededBy 只认
 *     响应里的键，没有就没有替代节点（不编造）；替代节点的时间键服务不给 ⇒
 *     屏上是「该字段未返回」，不是当前时间。
 *  ② 真实票面：human:1 原柄只进 title，屏上人话；节点顺序与 apd8 复制文本同序。
 *  ③ 回填票面（already_decided 一族的服务答复形态）措辞不是错误语气。
 *  ④ 处理记录：真读 3 行按时间正序；403/失败 ⇒「处理记录暂不可用」+ 可复制
 *     请求号，绝不画空列表当成功；响应不带 eventId ⇒ 不给 ?event= 定位链。
 *  ⑤ 禁假 0：未读≠0 条；答回来的不是列表（null）归「暂不可用」而不是 0 行。
 *  ⑥ 不做轮询：打开详情/挂载时间线不自动发这条读腿（GAP-APR-11 无状态读口）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
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

import { ApiError } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import { approvalDetailFrom, trailEventsFrom } from "@/modules/approvals/model";
import { RECORDS_UNAVAILABLE_SENTENCE, TRAIL_FACE_RECORDED } from "@/modules/approvals/copy";
import { TIME_MISSING } from "@/modules/approvals/RelativeTime";

const mock = vi.mocked(fetchJSON);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

function clearScreen(): void {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
}

afterEach(() => {
  clearScreen();
  mock.mockReset();
});

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

async function renderInto(entry: string, node: ReactElement): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>);
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const render = (entry = "/approvals?tab=history") =>
  renderInto(entry, <ApprovalsHistoryModulePage />);

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const text = (id: string): string => q(id)?.textContent ?? "";
const attr = (id: string, name: string): string => q(id)?.getAttribute(name) ?? "";
const urls = (): string[] => mock.mock.calls.map((call) => String(call[0]));
const auditCalls = (): string[] => urls().filter((u) => u.includes("/api/audit"));

async function openDetail(id: string): Promise<void> {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
  await waitFor(() => !!q("apd6-trail"), "trail mounted");
}

function stubClipboard(written: string[]): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: (value: string) => (written.push(value), Promise.resolve()) },
  });
}

/* ── 真响应形制（evidence/ 逐字，非 fixture） ─────────────────────────── */

const AP_ID = "ap_0C67930A766D4AA49E4B5B44EC";

/** evidence/raw-detail-ap_0C67930A766D4AA49E4B5B44EC.json 的关键键（原文键名逐字）。 */
const DETAIL_EXPIRED = {
  approvalId: AP_ID,
  tenantId: "t_seakoi_pilot",
  type: "business_action",
  status: "expired",
  requestedBy: { type: "employee", id: "emp_86A81CE8FF6F42E187BCF2B540" },
  action: "message.send",
  argsDigest: "6d39a99d3d435a268bbb448ee333ee02e35c93cc7f9ed2a4aba571c6e9e144fc",
  binding: {
    subjectType: "employee",
    subjectId: "emp_86A81CE8FF6F42E187BCF2B540",
    changeKind: "message_send",
    targetHash: "th_01c958fc67aa1f217939c94f66cb3b7c",
    runId: "rn_DRILL1795314994",
  },
  riskLevel: "high",
  reasonText: "B 线控制台审批写路径演练",
  approvers: [{ userId: "human:1", role: "owner" }],
  requiredApprovals: 1,
  decisions: [
    {
      userId: "human:1",
      verdict: "approve",
      comment: "B 线演练批准",
      decidedAt: "2026-11-22T02:36:49.066Z",
    },
  ],
  ttlSeconds: 86400,
  expiresAt: "2026-11-23T02:36:34.263Z",
  remainingSeconds: 0,
  createdAt: "2026-11-22T02:36:34.263Z",
  decidedAt: "2026-11-22T02:36:49.066Z",
  verdict: "approve",
};

/** evidence/raw-audit-resourceid.json 的 events[]（服务端倒序，逐字三行）。 */
const AUDIT_EVENTS = [
  {
    eventId: "ev_E00835B01A4241068C90E7BC32",
    occurredAt: "2026-11-23T03:12:34.244Z",
    recordedAt: "2026-11-23T03:12:34.244Z",
    sourceSystem: "approval",
    actor: { type: "service", id: "approval-sweeper" },
    action: "approval.expired",
    resource: { type: "approval", id: AP_ID },
    outcome: "denied",
    decision: "rejected",
    correlationId: AP_ID,
  },
  {
    eventId: "ev_954362D9A8FF4DB8AA5430F9E2",
    occurredAt: "2026-11-22T02:36:49.066Z",
    recordedAt: "2026-11-22T02:36:49.066Z",
    sourceSystem: "approval",
    actor: { type: "human", id: "1" },
    action: "approval.decided",
    resource: { type: "approval", id: AP_ID },
    outcome: "success",
    decision: "approved",
    after: { verdict: "approve" },
    correlationId: AP_ID,
  },
  {
    eventId: "ev_53DF6B6D6BA74FF9B9BA4E6A1A",
    occurredAt: "2026-11-22T02:36:34.270Z",
    recordedAt: "2026-11-22T02:36:34.270Z",
    sourceSystem: "approval",
    actor: { type: "human", id: "1" },
    action: "approval.denied",
    resource: { type: "approval", id: AP_ID },
    outcome: "denied",
    error: { code: "approval.not_approver", messageRedacted: "denied by domain validation; raw message not stored in audit" },
    correlationId: AP_ID,
  },
];

const AUDIT_PAGE = { events: AUDIT_EVENTS, limit: 50, cursor: null, hasMore: false, total: 3, totalSource: "exhaustive-same-query-page-count" };

/** 列表腿 + 详情腿 + 审计腿三路的分发；auditFails 给出真形制的 ApiError。 */
function serve(opts: { audit?: unknown; auditError?: unknown } = {}): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/audit")) {
      if (opts.auditError !== undefined) throw opts.auditError;
      return opts.audit === undefined ? AUDIT_PAGE : opts.audit;
    }
    if (u.includes("/api/approval?id=")) return DETAIL_EXPIRED;
    if (u.includes("/api/approvals?")) return { items: [DETAIL_EXPIRED] };
    return {};
  });
}

describe("AP-03 ① 时间线事件合流（纯模型，无 DOM）", () => {
  it("提交 → 票 → 到期 按服务带回的 atRaw 升序，节点号仍按 decisions[] 序号", () => {
    const detail = approvalDetailFrom(DETAIL_EXPIRED);
    expect(detail, "真响应可解析").toBeTruthy();
    const events = trailEventsFrom(detail!);
    expect(events.map((e) => e.kind)).toEqual(["submitted", "decision", "deadline"]);
    expect(events[1].nodeIndex).toBe(0);
    expect(events[1].entry?.atRaw).toBe("2026-11-22T02:36:49.066Z");
    expect(events[2].atRaw, "到期标记=服务带回的 expiresAt 原值").toBe("2026-11-23T02:36:34.263Z");
  });

  it("响应不带 supersededBy ⇒ 没有替代节点；带上就有，且时间缺位不补当前时间", () => {
    const without = trailEventsFrom(approvalDetailFrom(DETAIL_EXPIRED)!);
    expect(without.some((e) => e.kind === "superseded"), "实测 7/7 详情不带该键=不造节点").toBe(false);

    const withSup = approvalDetailFrom({
      ...DETAIL_EXPIRED,
      status: "superseded",
      supersededBy: "ap_9E2C77BB4C1F4E0DA3B7C1D2F5",
    })!;
    const events = trailEventsFrom(withSup);
    const node = events.find((e) => e.kind === "superseded");
    expect(node, "有键才有节点").toBeTruthy();
    expect(node?.atRaw, "服务没给时间就是 null，不是「现在」").toBeNull();
    expect(node?.refId).toBe("ap_9E2C77BB4C1F4E0DA3B7C1D2F5");
    expect(events.at(-1)?.kind, "无时间的排末尾").toBe("superseded");
  });

  it("同值/读不出时间的保持服务返回序（稳定排序，不重排同名时刻）", () => {
    const detail = approvalDetailFrom({
      ...DETAIL_EXPIRED,
      decisions: [
        { userId: "human:1", verdict: "approve", decidedAt: "2026-11-22T02:36:49Z" },
        { userId: "human:2", verdict: "reject", decidedAt: "2026-11-22T02:36:49Z" },
        { userId: "human:3", verdict: "approve" },
        { userId: "human:4", verdict: "approve" },
      ],
    })!;
    const kinds = trailEventsFrom(detail).map((e) => `${e.kind}:${e.nodeIndex}`);
    // 有时间的在前（同值保持服务序）；处理期限按自己的时刻落位；
    // 没有时间可读的两票排到最末，彼此仍是服务返回的先后。
    expect(kinds).toEqual([
      "submitted:-1",
      "decision:0",
      "decision:1",
      "deadline:-1",
      "decision:2",
      "decision:3",
    ]);
  });
});

describe("AP-03 ①②③ 详情时间线段（DOM）", () => {
  it("三个事件节点按时间先后上屏，时间走同一把 RelativeTime 尺", async () => {
    serve();
    await render();
    await openDetail(AP_ID);

    expect(q("apd6-step-submitted"), "提交节点").toBeTruthy();
    expect(q("apd6-step-node-0"), "票节点").toBeTruthy();
    expect(q("apd6-step-deadline"), "到期标记节点").toBeTruthy();
    expect(q("apd6-step-superseded"), "响应没带 supersededBy ⇒ 不造节点").toBeNull();

    const order = Array.from(document.querySelectorAll("[data-testid='apd6-trail'] li")).map(
      (li) => li.getAttribute("data-testid") ?? "",
    );
    const submitted = order.indexOf("apd6-step-submitted");
    const node = order.indexOf("apd6-step-node-0");
    const deadline = order.indexOf("apd6-step-deadline");
    expect(submitted, "提交在票之前").toBeLessThan(node);
    expect(node, "票在处理期限之前").toBeLessThan(deadline);

    expect(attr("apv-time-detail-submitted", "title")).toContain("2026-11-22 10:36:34");
    expect(attr("apv-time-detail-node-0", "title")).toContain("2026-11-22 10:36:49");
    expect(attr("apv-time-detail-deadline", "title")).toContain("2026-11-23 10:36:34");
  });

  it("真实票面：原柄只进 title，屏上是人话；复制文本与屏上同序同段", async () => {
    serve();
    const written: string[] = [];
    stubClipboard(written);
    await render();
    await openDetail(AP_ID);

    const node = text("apd6-step-node-0");
    expect(node).toContain("节点 1 ·");
    expect(node).toContain("通过");
    expect(node).toContain("意见：B 线演练批准");
    expect(node, "裸柄不上屏").not.toContain("human:");
    expect(attr("apd6-step-node-0", "title"), "原柄在 title").toContain("human:1");

    const btn = q("apd8-copy") as HTMLButtonElement | null;
    expect(btn, "复制钮可用").toBeTruthy();
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => text("apd8-copy-status").includes("已复制"), "trail copied");
    const lines = written[0].split("\n");
    expect(lines[0].startsWith("提交 ·"), `首行=提交，实得「${lines[0]}」`).toBe(true);
    expect(lines[1].startsWith("节点 1 · 人员 · 通过 · 2026-11-22 10:36"), "第二行=票面").toBe(true);
    expect(lines[1], "票面行含意见").toContain("意见：B 线演练批准");
    expect(lines[2].startsWith("处理期限 · 2026-11-23"), `第三行=到期，实得「${lines[2]}」`).toBe(true);
    expect(lines.some((l) => l.startsWith("终态 · 已过期")), "终态行在后").toBe(true);
    expect(written[0]).not.toContain("human:");
    expect(written[0], "链路文本不夹带单号全串").not.toContain(AP_ID);
  });

  it("回填票面（已结束的单据）标注是「票面已记录」，措辞里没有失败词", async () => {
    serve();
    await render();
    await openDetail(AP_ID);

    const face = q("apd6-step-node-face-0");
    expect(face, "已结束单据的票面带票面标注").toBeTruthy();
    expect(face!.textContent, "措辞单点走 copy.ts").toBe(TRAIL_FACE_RECORDED);
    expect(face!.getAttribute("title") ?? "", "title 明说这是回填票面").toContain("回填票面");

    const line = `${text("apd6-step-node-0")} ${attr("apd6-step-node-face-0", "title")}`;
    for (const bad of ["失败", "出错", "没能", "无法", "错误"]) {
      expect(line, `票面行不出现「${bad}」`).not.toContain(bad);
    }
    expect(text("apd6-trail"), "整段也不用失败语气").not.toContain("已被处理过");
  });

  it("未结束的单据不贴「票面已记录」（没发生的事不宣布）", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/audit")) return { events: [], limit: 50, total: 0 };
      if (u.includes("/api/approval?id=")) return { ...DETAIL_EXPIRED, status: "pending", decidedAt: null };
      if (u.includes("/api/approvals?")) return { items: [{ ...DETAIL_EXPIRED, status: "pending" }] };
      return {};
    });
    await render();
    await openDetail(AP_ID);
    expect(q("apd6-step-node-face-0"), "pending 不宣布票面已记录").toBeNull();
  });

  it("替代节点：短码上屏、全值进 title 与 href；时间服务没给就走单点尺的缺值句", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/audit")) return { events: [], limit: 50, total: 0 };
      const detail = { ...DETAIL_EXPIRED, status: "superseded", supersededBy: "ap_9E2C77BB4C1F4E0DA3B7C1D2F5" };
      if (u.includes("/api/approval?id=")) return detail;
      if (u.includes("/api/approvals?")) return { items: [detail] };
      return {};
    });
    await render();
    await openDetail(AP_ID);

    const node = q("apd6-step-superseded");
    expect(node, "有键才有节点").toBeTruthy();
    expect(node!.textContent ?? "", "全值不上屏").not.toContain("ap_9E2C77BB4C1F4E0DA3B7C1D2F5");
    expect(node!.textContent ?? "", "短码上屏").toContain("ap_9E2…D2F5");
    expect(attr("apd6-step-superseded", "title")).toBe("ap_9E2C77BB4C1F4E0DA3B7C1D2F5");
    const link = q("apd6-link-superseded") as HTMLAnchorElement | null;
    expect(link, "新单是真链").toBeTruthy();
    expect(link!.getAttribute("href") ?? "").toContain("/approvals?id=ap_9E2C77BB4C1F4E0DA3B7C1D2F5");

    expect(
      text("apv-time-detail-superseded"),
      "没有事件时间就说没有，不拿读取时刻冒充",
    ).toBe(TIME_MISSING);
    expect(attr("apv-time-detail-superseded", "title")).toContain("这里不补当前时间");

    const order = Array.from(document.querySelectorAll("[data-testid='apd6-trail'] li")).map(
      (li) => li.getAttribute("data-testid") ?? "",
    );
    expect(order.indexOf("apd6-step-superseded"), "无时间的排末尾").toBeGreaterThan(
      order.indexOf("apd6-step-deadline"),
    );
  });
});

describe("AP-03 ② 内联处理记录", () => {
  it("打开详情与时间线不自动发这条读腿（不轮询），点一次恰一次", async () => {
    serve();
    await render();
    await openDetail(AP_ID);
    expect(auditCalls().length, "挂载零请求").toBe(0);
    expect(text("apd12-idle"), "未读态明说未读").toContain("处理记录未读取");

    const btn = q("apd12-load") as HTMLButtonElement | null;
    expect(btn, "读取钮在").toBeTruthy();
    expect(btn!.disabled, "有单号就可点").toBe(false);
    await act(async () => {
      btn!.click();
    });
    await waitFor(() => !!q("apd12-row-0"), "records rendered");
    expect(auditCalls().length, "恰一次").toBe(1);
    expect(
      auditCalls()[0],
      "wire 形制＝resourceId 真过滤 + limit（只带 limit 实测 400）",
    ).toBe(`/agent-api/api/audit?resourceId=${AP_ID}&limit=50`);
  });

  it("真读回 3 行按时间正序：action/actor/occurredAt，且只认响应带回的 eventId", async () => {
    serve();
    await render();
    await openDetail(AP_ID);
    await act(async () => {
      (q("apd12-load") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apd12-count"), "count line");

    const times = [0, 1, 2].map((i) => attr(`apv-time-detail-record-${i}`, "title").slice(3, 22));
    expect(times, "服务端倒序 ⇒ 屏上正序").toEqual([
      "2026-11-22 10:36:34",
      "2026-11-22 10:36:49",
      "2026-11-23 11:12:34",
    ]);
    expect(text("apd12-row-0")).toContain("驳回审批");
    expect(text("apd12-row-1")).toContain("给出审批结论");
    expect(text("apd12-row-2")).toContain("审批超时未处理");
    expect(text("apd12-row-0"), "actor 人话（成员）").toContain("成员");
    expect(text("apd12-records"), "行内不出现裸柄与租户串").not.toMatch(/human:|t_seakoi/);
    // 模型法则二：审计行的 reason 腿实测带回工程英文句（"…raw message not stored
    // in audit"），它属于审计页的技术折——这一段只上 action/actor/occurredAt。
    expect(text("apd12-records"), "工程句不上中文屏").not.toMatch(/raw message|domain validation|denied by/);
    expect(q("apd12-row-reason-0"), "没有 reason 行内载体").toBeNull();

    const link = q("apd12-row-event-0") as HTMLAnchorElement | null;
    expect(link, "响应带 eventId ⇒ 定位链是真的").toBeTruthy();
    expect(link!.getAttribute("href") ?? "").toContain("/audit?event=ev_53DF6B6D6BA74FF9B9BA4E6A1A");
    expect(text("apd12-count"), "读数与 total 各自说清").toContain("本次读回 3 行");
    expect(text("apd12-count")).toContain("读口称共 3 条");
  });

  it("响应不带 eventId ⇒ 不给 ?event= 链，只明说没有标识（禁编造）", async () => {
    serve({
      audit: {
        // 同一批真行，逐字剥掉 eventId 键（服务端没给标识的那一档形制）。
        events: AUDIT_EVENTS.map((event) => {
          const row: Record<string, unknown> = { ...event };
          delete row.eventId;
          return row;
        }),
        limit: 50,
        total: 3,
      },
    });
    await render();
    await openDetail(AP_ID);
    await act(async () => {
      (q("apd12-load") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apd12-row-0"), "rows without ids");
    expect(q("apd12-row-event-0"), "不编造事件定位链").toBeNull();
    expect(q("apd12-row-event-none-0"), "缺标识有明说").toBeTruthy();
    expect(text("apd12-records")).not.toContain("event=");
  });

  it("403 非授权 ⇒「处理记录暂不可用」+ 可复制请求号，绝不画空列表当成功", async () => {
    const forbidden = new ApiError("You are not allowed to do that on this dashboard.", {
      status: 403,
      body: JSON.stringify({ code: "console.forbidden", message: "forbidden" }),
      url: "/agent-api/api/audit",
      requestId: "a8bfb4d0306542699e0c1b2a2ec1f99b",
    });
    serve({ auditError: forbidden });
    await render();
    await openDetail(AP_ID);
    await act(async () => {
      (q("apd12-load") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apd12-failed"), "failed carrier");

    expect(text("apd12-failed"), "首句单点").toContain(RECORDS_UNAVAILABLE_SENTENCE);
    expect(q("apd12-list"), "失败不画列表").toBeNull();
    expect(q("apd12-empty"), "失败不冒充「没有记录」").toBeNull();
    expect(text("apd12-rid")).toBe("a8bfb4d0306542699e0c1b2a2ec1f99b");

    const written: string[] = [];
    stubClipboard(written);
    await act(async () => {
      (q("apd12-copy-rid") as HTMLButtonElement).click();
    });
    await waitFor(() => text("apd12-rid-state").includes("已复制"), "rid copied");
    expect(written[written.length - 1]).toBe("a8bfb4d0306542699e0c1b2a2ec1f99b");

    // 重读走同一条 GET（手动刷新腿，不带副作用）。
    const before = auditCalls().length;
    await act(async () => {
      (q("apd12-load") as HTMLButtonElement).click();
    });
    await waitFor(() => auditCalls().length === before + 1, "re-read fired");
    expect(q("apd12-failed"), "旧读数不残留").toBeTruthy();
  });

  it("答回来的不是列表（null）＝读不到，不算 0 行成功（禁假 0）", async () => {
    serve({ audit: { detail: "上游没有给出事件列表" } });
    await render();
    await openDetail(AP_ID);
    await act(async () => {
      (q("apd12-load") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apd12-failed"), "shape failure is a failure");
    expect(text("apd12-failed")).toContain(RECORDS_UNAVAILABLE_SENTENCE);
    expect(q("apd12-empty"), "不冒充空记录").toBeNull();
  });

  it("真读回 0 行 ⇒ 说「没有带回处理记录」，不摆空壳也不报失败", async () => {
    serve({ audit: { events: [], limit: 50, cursor: null, hasMore: false, total: 0, totalSource: "exhaustive-same-query-page-count" } });
    await render();
    await openDetail(AP_ID);
    await act(async () => {
      (q("apd12-load") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apd12-empty"), "empty sentence");
    expect(text("apd12-empty")).toContain("本次答 0 行");
    expect(q("apd12-failed"), "空不是失败").toBeNull();
    expect(document.querySelectorAll("[data-testid^='apd12-row-']").length, "没有行就不画行").toBe(0);
  });

  it("单据号没回传 ⇒ 这一段读不了，读钮禁用并说明原因（不猜 id 去查）", async () => {
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return { title: "没有单号的一行", status: "pending" };
      if (u.includes("/api/approvals?")) return { items: [{ approvalId: "ap_noid", title: "没有单号的一行", status: "pending" }] };
      return {};
    });
    await render();
    // 详情腿按行 id 请求，响应本体不带 approvalId ⇒ 读口没有可过滤的输入。
    const card = q("apr5-row-ap_noid") as HTMLElement | null;
    expect(card, "row").toBeTruthy();
    await act(async () => {
      card!.click();
    });
    await waitFor(() => !!q("apr5-detail"), "detail");
    const btn = q("apd12-load") as HTMLButtonElement | null;
    expect(btn, "钮在").toBeTruthy();
    expect(btn!.disabled, "无 id 禁用").toBe(true);
    expect(btn!.title).toContain("没带回单号");
    expect(auditCalls().length, "不发没有输入的请求").toBe(0);
  });

  it("换单后旧读数作废：不把上一张单的行挂到这一张单上", async () => {
    let auditPayload: unknown = AUDIT_PAGE;
    mock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/audit")) return auditPayload;
      if (u.includes("/api/approval?id=")) {
        return u.includes("ap_OTHER")
          ? { ...DETAIL_EXPIRED, approvalId: "ap_OTHER", approval: undefined }
          : DETAIL_EXPIRED;
      }
      if (u.includes("/api/approvals?")) {
        return {
          items: [
            DETAIL_EXPIRED,
            { ...DETAIL_EXPIRED, approvalId: "ap_OTHER", reasonText: "另一张单" },
          ],
        };
      }
      return {};
    });
    await render();
    await openDetail(AP_ID);
    await act(async () => {
      (q("apd12-load") as HTMLButtonElement).click();
    });
    await waitFor(() => !!q("apd12-row-0"), "first ticket read");

    await act(async () => {
      (q("apd7-back") as HTMLElement).click();
    });
    await waitFor(() => !q("apr5-detail"), "drawer closed");
    await openDetail("ap_OTHER");
    expect(q("apd12-row-0"), "另一张单不继承旧行").toBeNull();
    expect(q("apd12-idle"), "回到未读态").toBeTruthy();
    auditPayload = { events: [], total: 0 };
  });
});

describe("AP-03 时间尺单点", () => {
  it("缺时间的节点用同一把尺的缺值句，不拿当前时间补", () => {
    const detail = approvalDetailFrom({
      approvalId: "ap_time_gap",
      status: "pending",
      decisions: [{ userId: "human:1", verdict: "approve" }],
    })!;
    const events = trailEventsFrom(detail);
    const node = events.find((e) => e.kind === "decision");
    expect(node?.atRaw, "没有时间= null").toBeNull();
    expect(TIME_MISSING, "缺值句单点").toBe("该字段未返回");
  });
});
