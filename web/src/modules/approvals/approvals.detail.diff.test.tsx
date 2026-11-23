// @vitest-environment jsdom
/**
 * Q13 — 审批详情「变更前后差异（字段级）」三态锁。
 *
 * 数据源口径（禁扩）：唯一来源是详情响应本体
 * （GET /agent-api/api/approval?id=，api.ts fetchDetail）。键形制取自
 * 2026-11-23 本机金标准实测（evidence/raw-detail-ap_AEEC….json）：
 *   detail.changeDetail{fromVersionId,toVersionNo,addedGrants[],removedGrantIds[]}
 *   + resource 的 snake 镜像（同一载荷，禁数两遍）。
 *
 * 三态：
 *  ① 真实差异键在 → 字段级前/后行（版本行 + 每条 added grant），camel/snake
 *     镜像只算一份；
 *  ② 差异键不在（message_send 单实测无 changeDetail）→ diff=null，屏上
 *     「未接」+原因句，不 fixture、不猜；
 *  ③ 决策按钮仍禁用且 title 带原因（DECISION_GATE 现状契约，本功能零写路径）。
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

import { fetchJSON } from "@/lib/api";
import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";
import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";
import { approvalDetailFrom, approvalDiffFrom } from "@/modules/approvals/model";
import { DECISION_GATE } from "@/modules/approvals/writeGate";
import { shortRef } from "@/modules/tasks/tasksBoard";

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

const waitFor = (label: string, cond: () => boolean): Promise<void> => {
  const start = Date.now();
  const step = async (): Promise<void> => {
    if (cond()) return;
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    return step();
  };
  return step();
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
  await waitFor(`${entry} settled`, () => !document.querySelector(".animate-pulse"));
}

const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
const text = (id: string): string => q(id)?.textContent ?? "";

// ── 金标准原文（结构逐字照 evidence/，时间戳等冗长字段裁剪不影响形制） ──

const GOLD_VERSION = {
  approvalId: "ap_AEEC078E0C824E749513AFEC9A",
  tenantId: "t_seakoi_pilot",
  type: "business_action",
  status: "consumed",
  requestedBy: { type: "user", id: "1" },
  action: "employee.version.create",
  resource: {
    employee_id: "emp_86A81CE8FF6F42E187BCF2B540",
    from_version_id: "empv_BEB487D9B8DC46ECB1C1AD663B",
    to_version_no: 3,
    added_grants: [
      {
        id: "gr_C5C617BFF9944EF0AE1269667E",
        employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
        scopeType: "business_api",
        resourceSelector: { type: "channel_event" },
        actions: ["execute"],
        source: "temporary",
        expiresAt: "2026-11-16T02:40:21.000Z",
        approvalRef: "ap_7D484B3FFBE048ECB7B96F92C9",
      },
      {
        id: "gr_EF4FC2AB33A34EE48D6F0DEF41",
        employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
        scopeType: "channel",
        resourceSelector: { types: ["chat"] },
        actions: ["send"],
        source: "temporary",
        expiresAt: "2026-11-16T02:40:21.000Z",
        approvalRef: "ap_7D484B3FFBE048ECB7B96F92C9",
      },
    ],
    removed_grant_ids: [],
    effective_from: "2026-11-15T03:27:58.000Z",
  },
  argsDigest: "22eadfcebfdaa88b5451bb8622503c876ddfd7418e692056baa29786bb9fb63f",
  binding: {
    subjectType: "employee",
    subjectId: "emp_86A81CE8FF6F42E187BCF2B540",
    changeKind: "employee_version_create",
    targetHash: "th_62872a9dadb0bfa4ab07c5f81abb0d81",
  },
  riskLevel: "medium",
  reasonText: "P0-7 live E2E: mount approved temporary grants via v3",
  approvers: [{ userId: "human:1", role: "owner" }],
  requiredApprovals: 1,
  decisions: [
    { userId: "human:1", verdict: "approve", comment: "unattended local P0-7 v3 mount E2E approval", decidedAt: "2026-11-15T04:21:26.211Z" },
  ],
  createdAt: "2026-11-15T03:26:58.533Z",
  decidedAt: "2026-11-15T04:21:26.211Z",
  expiresAt: "2026-11-16T03:26:58.533Z",
  remainingSeconds: 0,
  // camel 载体（金标准里与 snake resource 是同一载荷的双形制）。
  detail: {
    changeDetail: {
      employeeId: "emp_86A81CE8FF6F42E187BCF2B540",
      fromVersionId: "empv_BEB487D9B8DC46ECB1C1AD663B",
      toVersionNo: 3,
      addedGrants: [
        {
          id: "gr_C5C617BFF9944EF0AE1269667E",
          scopeType: "business_api",
          actions: ["execute"],
          source: "temporary",
          expiresAt: "2026-11-16T02:40:21.000Z",
        },
        {
          id: "gr_EF4FC2AB33A34EE48D6F0DEF41",
          scopeType: "channel",
          actions: ["send"],
          source: "temporary",
          expiresAt: "2026-11-16T02:40:21.000Z",
        },
      ],
      removedGrantIds: [],
      effectiveFrom: "2026-11-15T03:27:58.000Z",
      source: "resource",
    },
  },
};

const GOLD_MESSAGE = {
  approvalId: "ap_0C67930A766D4AA49E4B5B44EC",
  tenantId: "t_seakoi_pilot",
  type: "business_action",
  status: "expired",
  requestedBy: { type: "employee", id: "emp_86A81CE8FF6F42E187BCF2B540" },
  action: "message.send",
  resource: {
    employee_id: "emp_86A81CE8FF6F42E187BCF2B540",
    channel: "feishu",
    conversation_ref: "oc_dryrun_drill_approval",
  },
  argsDigest: "6d39a99d3d435a268bbb448ee333ee02e35c93cc7f9ed2a4aba571c6e9e144fc",
  binding: {
    subjectType: "employee",
    subjectId: "emp_86A81CE8FF6F42E187BCF2B540",
    changeKind: "message_send",
    targetHash: "th_01c958fc67aa1f217939c94f66cb3b7c",
  },
  riskLevel: "high",
  reasonText: "B 线演练",
  approvers: [{ userId: "human:1", role: "owner" }],
  requiredApprovals: 1,
  decisions: [{ userId: "human:1", verdict: "approve", comment: "B 线演练批准", decidedAt: "2026-11-22T02:36:49.066Z" }],
  createdAt: "2026-11-22T02:36:34.263Z",
  decidedAt: "2026-11-22T02:36:49.066Z",
  expiresAt: "2026-11-23T02:36:34.263Z",
  remainingSeconds: 0,
};

const GOLD_PENDING_VERSION = {
  ...GOLD_VERSION,
  approvalId: "ap_Q13PENDING00000000000001",
  status: "pending",
  decidedAt: undefined,
  verdict: undefined,
  decisions: [],
  remainingSeconds: 600,
};

function serve(rows: unknown[]): void {
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1] ?? "");
      const row = (rows as { approvalId?: string }[]).find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/approvals")) return { items: rows };
    return {};
  });
}

const openDetail = async (id: string): Promise<void> => {
  const card = q(`apr5-row-${id}`) as HTMLElement | null;
  expect(card, `row ${id}`).toBeTruthy();
  await act(async () => {
    card!.click();
  });
  // 历史抽屉与待处理抽屉共用详情体；详情体本体的 testId 形制不同，两个都认。
  await waitFor(`detail of ${id}`, () => !!q("apr5-detail") || !!q("apd5-detail"));
};

describe("Q13 approvals detail diff — three honest states", () => {
  it("① 真实差异键 → 字段级前后行，camel/snake 镜像不重数", async () => {
    // 纯读取器腿：同一载荷只产一份行。
    const diff = approvalDiffFrom(GOLD_VERSION);
    expect(diff, "carrier found").not.toBeNull();
    expect(diff!.source).toBe("real");
    expect(diff!.fields, "1 版本行 + 2 新增授权行（镜像载体不重数）").toHaveLength(3);
    expect(diff!.fields[0].label).toBe("员工版本");
    expect(diff!.fields[0].before).toBe(shortRef("empv_BEB487D9B8DC46ECB1C1AD663B"));
    expect(diff!.fields[0].after).toBe("v3");
    expect(diff!.fields[0].raw).toBe("empv_BEB487D9B8DC46ECB1C1AD663B");
    expect(diff!.fields[1].before).toBe("未持有");
    expect(diff!.fields[1].after).toContain("业务接口");
    expect(diff!.fields[1].after).toContain("execute");
    expect(diff!.fields[2].after).toContain("渠道");
    expect(diff!.fields[2].after).toContain("send");

    serve([GOLD_VERSION, GOLD_MESSAGE]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AEEC078E0C824E749513AFEC9A");

    const body = text("apd10-diff");
    expect(body).toContain("员工版本");
    expect(body).toContain("前：");
    expect(body).toContain("后：v3");
    expect(body).toContain("未持有");
    expect(body).toContain("渠道");
    expect(q("apd10-diff-unwired"), "真实差异单不显「未接」").toBeNull();
    // 原始句柄不进正文，只进 title（模型法则二）。
    expect(q("apd10-diff-before-0")?.getAttribute("title")).toBe("empv_BEB487D9B8DC46ECB1C1AD663B");
    expect(text("apd10-diff-before-0")).not.toContain("empv_BEB487D9B8DC46ECB1C1AD663B");
  });

  it("② 差异键缺失 → diff=null，屏上「未接」带原因句，禁假数据", async () => {
    expect(approvalDiffFrom(GOLD_MESSAGE), "message_send 实测无差异载体").toBeNull();
    const detail = approvalDetailFrom(GOLD_MESSAGE);
    expect(detail, "detail readable").not.toBeNull();
    expect(detail!.diff).toBeNull();

    serve([GOLD_VERSION, GOLD_MESSAGE]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_0C67930A766D4AA49E4B5B44EC");

    const unwired = q("apd10-diff-unwired");
    expect(unwired, "未接 carrier present").toBeTruthy();
    expect(unwired!.textContent ?? "").toContain("未接");
    expect(unwired!.getAttribute("title"), "原因句解释数据源与不猜").toContain("响应没有带回字段级前后值");
    // 未接单上不得出现任何差异行。
    expect(q("apd10-diff-row-0"), "no invented rows").toBeNull();
    expect(text("apr5-detail")).not.toContain("未持有");
  });

  it("③ 决策按钮保持禁用且 title 带原因（本功能零写路径）", async () => {
    serve([GOLD_PENDING_VERSION]);
    await renderInto("/approvals", <ApprovalsPendingModulePage />);
    await openDetail("ap_Q13PENDING00000000000001");

    const drawer = q("apr5-detail") ?? q("apd5-detail");
    expect(drawer, "drawer mounted").toBeTruthy();
    const buttons = Array.from(drawer!.querySelectorAll("button"));
    const approve = buttons.find((b) => (b.textContent ?? "").includes("批准")) as HTMLButtonElement | undefined;
    const reject = buttons.find((b) => (b.textContent ?? "").includes("驳回")) as HTMLButtonElement | undefined;
    expect(approve, "批准 button present").toBeTruthy();
    expect(reject, "驳回 button present").toBeTruthy();
    expect(approve!.disabled).toBe(true);
    expect(reject!.disabled).toBe(true);
    expect(approve!.getAttribute("title")).toBe(DECISION_GATE.title);
    expect(reject!.getAttribute("title")).toContain("只读");
    // 差异段在待处理抽屉同样在（同一详情体）。
    expect(text("apd10-diff")).toContain("员工版本");
  });
});
