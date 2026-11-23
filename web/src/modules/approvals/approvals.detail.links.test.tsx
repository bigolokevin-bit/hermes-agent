// @vitest-environment jsdom
/**
 * R267：审批详情抽屉「关联运行/任务」链接可达性与缺失态（纯测试，零产品改动）。
 *
 * 查重裁决（工单前置条款，已覆盖只回证据:行）：
 *  - href 精确形态（/runs?run=<全 id> 与 /work?tab=board&task=<全 id>）
 *    = ApprovalsHistoryModulePage.test.tsx L520-521（R46 交付）与 L2014
 *    （R82 correlation 首锁 rid 形态站）已逐字锁死；
 *  - 缺失态载体 apd6-link-run-none/-task-none、「该段无记录」与 title 原因句
 *    = approvals.detail.edge2.test.tsx L188-193（R226 系）已锁。
 * 真增量：
 *  ①同帧三锁——Link 是真 <a>（href 前缀 /runs?run=，禁 javascript:/裸 # 形态）、
 *    title=完整内部 id、屏上文本=「运行 · shortRef」短码腿，点击不触发任何
 *    fetchJSON（计数不变；现场注记：href 携完整 id 作为查询参数属合法载体，
 *    工单「href 含短码」按现状映射为 屏上文本=短码 + href=全 id）；
 *  ②缺失站补「不渲 a」（apd6-link-run toBeNull）与屏上无 undefined/null/rn_/tk_ 裸 id；
 *  ③status 换代后重开抽屉：链接随该单换代、旧 href 不残留，apd7-back 关闭
 *    后无可聚焦关联链接残留（R244 自动关抽屉语义沿用）。
 */
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { shortRef } from "@/modules/tasks/tasksBoard";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ onClick, children, ...rest }: { onClick?: () => void; children?: ReactNode }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, unknown>)}>{children}</div>
  ),
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import ApprovalsHistoryModulePage from "./ApprovalsHistoryModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];
let mounted: HTMLDivElement[] = [];

const clearScreen = (): void => {
  for (const root of roots) {
    act(() => {
      root.unmount();
    });
  }
  roots = [];
  for (const el of mounted) el.remove();
  mounted = [];
};

afterEach(() => {
  clearScreen();
  api.fetchJSON.mockReset();
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

async function render(entry = "/approvals?tab=history"): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <ApprovalsHistoryModulePage />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), `${entry} settled`);
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const text = (id: string): string => q(id)?.textContent ?? "";
const clicks = (): number => api.fetchJSON.mock.calls.length;

const clickTestId = async (id: string): Promise<void> => {
  const el = q(id) as HTMLButtonElement | null;
  expect(el, id).toBeTruthy();
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

const openDetail = async (id: string): Promise<void> => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  await waitFor(() => !!q("apr5-detail"), `detail of ${id}`);
};

const RUN_A = "rn_lk2026alphafull";
const TASK_A = "tk_lk2026alphafull";
const LK1 = {
  approvalId: "ap_lk1",
  title: "链接可达性验证单",
  status: "approved",
  riskLevel: "high",
  decidedAt: "2026-11-19T02:00:00Z",
  createdAt: "2026-11-18T01:00:00Z",
  requestId: "req-lk-11112222",
  runId: RUN_A,
  taskId: TASK_A,
  approvers: [{ userId: "human:7", name: "郑涛" }],
  decisions: [{ approver: "human:7", name: "郑涛", decision: "approve", at: "2026-11-19T02:00:00Z" }],
};
const LK2 = {
  approvalId: "ap_lk2",
  title: "无关联单",
  status: "approved",
  riskLevel: "low",
  decidedAt: "2026-11-19T03:00:00Z",
  createdAt: "2026-11-18T02:00:00Z",
};
const LKA = {
  approvalId: "ap_lk3a",
  title: "换代前单",
  status: "pending",
  runId: "rn_alpha9",
  createdAt: "2026-11-18T04:00:00Z",
};
const LKB = {
  approvalId: "ap_lk3b",
  title: "换代后单",
  status: "approved",
  runId: "rn_beta9",
  createdAt: "2026-11-18T05:00:00Z",
};

const serve = (rows: Array<Record<string, unknown>>): void => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
      const row = rows.find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    return { items: rows };
  });
};

describe("R267 approvals detail link reachability guards", () => {
  it("renders real anchors with the full id in title, a masked short code on screen, and clicking asks for nothing", async () => {
    serve([LK1, LK2]);
    await render("/approvals?tab=history");
    await openDetail("ap_lk1");
    const run = q("apd6-link-run") as HTMLAnchorElement | null;
    expect(run, "run link").toBeTruthy();
    expect(run!.tagName, "real anchor not a button").toBe("A");
    const href = run!.getAttribute("href") ?? "";
    expect(href.startsWith("/runs?run="), "real href, never javascript:/bare #").toBe(true);
    expect(href.includes("#"), "no bare hash").toBe(false);
    // 现场映射：href 携带完整 runId 作为查询参数（R46/R82 契约），
    // 「短码」腿在屏上文本：运行 · shortRef(全 id)
    expect(href).toContain(encodeURIComponent(RUN_A));
    expect(run!.getAttribute("title"), "title gives the full id").toBe(RUN_A);
    expect(text("apd6-link-run")).toContain(`运行 · ${shortRef(RUN_A)}`);
    const task = q("apd6-link-task") as HTMLAnchorElement | null;
    expect(task!.getAttribute("href") ?? "").toContain(encodeURIComponent(TASK_A));
    expect(task!.getAttribute("title")).toBe(TASK_A);
    const before = clicks();
    await act(async () => {
      run!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(clicks(), "the link click itself fetches nothing").toBe(before);
    expect(
      api.fetchJSON.mock.calls.some((c) => String(c[0]).includes("/api/runs")),
      "no run leg was ever asked",
    ).toBe(false);
  });

  it("keeps the missing-association station free of anchors and raw internal ids", async () => {
    serve([LK1, LK2]);
    await render("/approvals?tab=history");
    await openDetail("ap_lk2");
    expect(q("apd6-link-run"), "no run anchor when the field is absent").toBeNull();
    expect(q("apd6-link-task"), "no task anchor when the field is absent").toBeNull();
    expect(q("apd6-link-run-none"), "gap carrier present").toBeTruthy();
    expect(text("apd6-link-run-none")).toContain("该段无记录");
    const drawer = q("apr5-detail")?.textContent ?? "";
    expect(drawer).not.toMatch(/undefined|null/);
    expect(drawer).not.toContain(RUN_A);
    expect(drawer).not.toContain(TASK_A);
  });

  it("swaps the association link with the record after a status change and leaves nothing focusable once closed", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) {
        const id = decodeURIComponent((u.split("id=")[1] ?? "").split("&")[0]);
        const row = [LKA, LKB].find((r) => r.approvalId === id);
        return row ? { ...row } : {};
      }
      if (u.includes("status=approved")) return { items: [LKB] };
      return { items: [LKA] };
    });
    await render("/approvals?tab=history&status=pending");
    await openDetail("ap_lk3a");
    expect((q("apd6-link-run") as HTMLAnchorElement).getAttribute("href") ?? "").toContain("rn_alpha9");
    // 切 status（服务端维）→ 抽屉自动关（R244 语义）→ 重开换代单
    await clickTestId("apr5-filter-approved");
    await waitFor(() => !q("apr5-detail"), "drawer auto-closed on status switch");
    await openDetail("ap_lk3b");
    const href = (q("apd6-link-run") as HTMLAnchorElement).getAttribute("href") ?? "";
    expect(href).toContain("rn_beta9");
    expect(href).not.toContain("rn_alpha9");
    expect(q("apr5-detail")?.textContent ?? "").not.toContain("rn_alpha9");
    await clickTestId("apd7-back");
    await waitFor(() => !q("apr5-detail"), "drawer closed");
    expect(q("apd6-link-run"), "no focusable association link after closing").toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * AP-08 审计留痕展示——本文件在此钉住四条（工单 ②③④ 的 approvals 写域腿）：
 *  ② 「在审计中查看」是 resourceId 真过滤链，屏上有「按单据过滤、非事件行
 *     定位」声明句（不只是 hover title）；链上禁出现编造的 ?event=；
 *  ③ 处理记录段的审计行走 audit 模型遮蔽（2026-11-24 活体真形制：
 *     actor={type:"human",id:"1"}，CR-028 剥前缀后的裸短 id 上屏只读
 *     「成员」，原值只进 title。注意真链形制：非审批人拒绝落的是
 *     action=approval.denied + error.code=approval.not_approver（板仓
 *     approvals.py:69-91 只读核对；action=approval.not_approver 实测 200
 *     n=0，见 evidence/raw-audit-notapprover.json——工单快照超前于现网，
 *     测试按现网真形制钉）；error.messageRedacted 的工程句不得上中文屏；
 *     未映射码（如活体实测的 recognition.unknown）读「其他事件」，裸码进
 *     title 不进屏面）；
 *  ④ 列表导出钮在无行可导时 disabled+aria-disabled，点击零成功提示
 *     （approvals 侧无 data-planned 钮，grep 结论见 DONE-AP-08）。
 * ------------------------------------------------------------------ */

/** 2026-11-24 真登录腿实测形制（evidence/raw-audit-decided.json / raw-audit-denied.json 同款）。 */
function auditEventsWire(id: string) {
  return {
    events: [
      {
        eventId: "ev_DECIDED01",
        schemaVersion: 1,
        tenantId: "t_seakoi_pilot",
        occurredAt: "2026-11-13T00:52:17.498Z",
        recordedAt: "2026-11-13T00:52:17.498Z",
        sourceSystem: "approval",
        // CR-028：域剥 human: 前缀存裸数字，屏上必须读成人话而非裸值。
        actor: { type: "human", id: "1" },
        action: "approval.decided",
        resource: { type: "approval", id },
        outcome: "success",
        decision: "approved",
      },
      {
        eventId: "ev_DENIED02",
        schemaVersion: 1,
        tenantId: "t_seakoi_pilot",
        occurredAt: "2026-11-14T02:36:34.270Z",
        recordedAt: "2026-11-14T02:36:34.270Z",
        sourceSystem: "approval",
        actor: { type: "human", id: "2" },
        action: "approval.denied",
        resource: { type: "approval", id },
        outcome: "denied",
        error: {
          code: "approval.not_approver",
          messageRedacted: "denied by domain validation; raw message not stored in audit",
        },
      },
      {
        // 活体实测存在而未映射的码：读「其他事件」，裸码只进 title。
        // 没有 eventId：这条必须明说「不给定位链」，禁编造 ?event=。
        schemaVersion: 1,
        tenantId: "t_seakoi_pilot",
        occurredAt: "2026-11-15T01:00:00.000Z",
        sourceSystem: "duty",
        actor: { type: "human", id: "1" },
        action: "recognition.unknown",
        resource: { type: "approval", id },
        outcome: "unknown",
      },
    ],
    limit: 50,
    cursor: null,
    hasMore: false,
    total: 3,
    totalSource: "service",
  };
}

describe("AP-08 audit-trail display guards", () => {
  it("states on screen that the audit link filters by ticket, and never fakes an event anchor", async () => {
    serve([LK1, LK2]);
    await render("/approvals?tab=history");
    await openDetail("ap_lk1");
    const link = q("apd9-audit-link") as HTMLAnchorElement | null;
    expect(link, "R82 audit link").toBeTruthy();
    const href = link!.getAttribute("href") ?? "";
    expect(href).toContain("/audit?resource=");
    expect(href).toContain(encodeURIComponent("ap_lk1"));
    expect(href.includes("event="), "no fabricated ?event= on the ticket-level link").toBe(false);
    const scope = text("apd9-audit-scope-note");
    expect(scope, "visible scope sentence, not only a hover title").toContain("按审批单号过滤");
    expect(scope).toContain("不是定位到某一条事件行");
    expect(link!.getAttribute("title") ?? "").toContain("resourceId 真过滤");
  });

  it("masks CR-028 bare actor ids and engineering text in the inline audit rows", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/audit?resourceId=ap_lk1")) return auditEventsWire("ap_lk1");
      if (u.includes("/api/approval?id=")) return { ...LK1 };
      return { items: [LK1, LK2] };
    });
    await render("/approvals?tab=history");
    await openDetail("ap_lk1");
    await clickTestId("apd12-load");
    await waitFor(() => !!q("apd12-list"), "inline records rendered");
    // 正序：decided（11-13）→ denied/not_approver（11-14）→ 未映射码（11-15）。
    const r0 = q("apd12-row-0")!;
    expect(r0.textContent ?? "", "known code reads in words").toContain("给出审批结论");
    const actor0 = r0.querySelector("[title]") as HTMLElement | null;
    expect(actor0?.textContent ?? "", "bare human id reads as the plain role")
      .toMatch(/^(成员|人员)/);
    expect(actor0?.getAttribute("title") ?? "", "raw stays in the title only").toBe("1");
    const r1 = q("apd12-row-1")!;
    expect(r1.textContent ?? "", "the real denial shape reads in words").toContain("驳回审批");
    const r2 = q("apd12-row-2")!;
    expect(r2.textContent ?? "", "unmapped code never shows machine words").toContain("其他事件");
    expect((r2 as HTMLElement).getAttribute("title") ?? "").toBe("recognition.unknown");
    // 真带回 eventId 的行给真链；没带回的行明说不给——两站同屏，各归各。
    const ev = q("apd12-row-event-0") as HTMLAnchorElement | null;
    expect(ev, "event link only when the response carried the id").toBeTruthy();
    expect(ev!.getAttribute("href") ?? "").toContain("/audit?event=ev_DECIDED01");
    expect((q("apd12-row-event-1") as HTMLAnchorElement).getAttribute("href") ?? "")
      .toContain("/audit?event=ev_DENIED02");
    expect(q("apd12-row-event-2"), "no anchor for the id-less row").toBeNull();
    expect(text("apd12-row-event-none-2")).toContain("没带回事件标识");
    const drawer = q("apr5-detail")?.textContent ?? "";
    expect(drawer, "no machine handle on screen").not.toContain("human:");
    expect(drawer, "denied_code is technical, never on the Chinese screen").not.toContain("approval.not_approver");
    expect(drawer, "the engineering redacted line stays out of this section").not.toContain("denied by domain validation");
  });

  it("keeps the export button inert with zero rows and shows no success affordance", async () => {
    api.fetchJSON.mockImplementation(async () => ({ items: [] }));
    // 与 approvals.rowcopy.window.gap 同法：下载通道在 jsdom 里 stub 掉，
    // 断言只打在「有没有成功话术」上，不碰 blob 形制。
    const orig = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (() => "blob:stub") as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
    await render("/approvals?tab=history");
    await waitFor(() => !document.querySelector(".animate-pulse"), "empty list settled");
    const btn = q("apv7-export") as HTMLButtonElement | null;
    expect(btn, "export control present").toBeTruthy();
    expect(btn!.disabled, "gated off with nothing to export").toBe(true);
    expect(btn!.getAttribute("aria-disabled")).toBe("true");
    await clickTestId("apv7-export");
    const body = document.body.textContent ?? "";
    expect(body, "zero success wording on a gated click").not.toMatch(/导出成功|已导出|导出完成/);
    URL.createObjectURL = orig;
    URL.revokeObjectURL = origRevoke;
  });
});
