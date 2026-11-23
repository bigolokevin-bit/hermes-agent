// @vitest-environment jsdom
/**
 * Q13 — 审批详情「变更前后差异（字段级）」三态锁。
 * AP-02 — 同段的 changeKind 四分支 ＋ consumedAt 两态（E52/E53）＋ 禁 0/禁风险差异四项。
 *
 * 数据源口径（禁扩）：唯一来源是详情响应本体
 * （GET /agent-api/api/approval?id=，api.ts fetchDetail）。键形制取自
 * 2026-11-23 本机金标准实测（evidence/raw-detail-ap_AEEC….json）：
 *   detail.changeDetail{fromVersionId,toVersionNo,addedGrants[],removedGrantIds[]}
 *   + resource 的 snake 镜像（同一载荷，禁数两遍）。
 * 相邻版本核对腿只读 BFF 既有端点 GET /agent-api/api/employee-versions?id=
 * （形制取自 evidence/raw-employee-versions.json 实测顶层 keys=[items]）；
 * **不新增端点**，读不回就写「未读回」，不补 v 号。
 *
 * 三态（Q13 契约，逐字不许破）：
 *  ① 真实差异键在 → 字段级前/后行（版本行 + 每条 added grant），camel/snake
 *     镜像只算一份；
 *  ② 差异键不在（message_send 单实测无 changeDetail）→ diff=null，屏上
 *     「未接」+原因句，不 fixture、不猜；
 *  ③ 决策按钮仍禁用且 title 带原因（DECISION_GATE 现状契约，本功能零写路径）。
 *
 * AP-02 新增分支口径（backlog §AP-02 步骤①②③④）：
 *  ① employee_version_create 有载体 → 字段行 ＋ 版本链核对；
 *  ② employee_version_create 无载体 → 「未接」+原因，不猜相邻版本对；
 *  ③ 其它已知类型（message_send/grant_escalation）→ 「差异明细未提供
 *     （该变更类型无差异数据源）」；
 *  ④ 未写明类型 → 「差异明细未提供（该单据没写明变更类型）」；
 *  consumedAt 两态 + 仅当真带回 run 才画回链；风险差异四项整块不渲染；
 *  argsDigest 标「不可逆摘要，非差异」。
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
import { approvalDetailFrom, approvalDiffFrom, consumptionStateFrom } from "@/modules/approvals/model";
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

/* ------------------------------------------------------------------ *
 * AP-02 — changeKind 四分支 ＋ consumedAt 两态 ＋ 禁 0/禁风险差异四项。
 * 形制全部照 evidence/ 实测原文（顶层 keys、items 形制、binding.runId 位）。
 * ------------------------------------------------------------------ */

/** evidence/raw-employee-versions.json 的实测形制（items[].id/versionNo/…）。 */
const VERSIONS_MEASURED = {
  items: [
    { id: "empv_037096D42F194AF6B38A3D8F62", employeeId: "emp_86A81CE8FF6F42E187BCF2B540", versionNo: 5, effectiveFrom: "2026-11-21T18:39:20.008Z" },
    { id: "empv_E54E79C90FB747E8AA75BC7762", employeeId: "emp_86A81CE8FF6F42E187BCF2B540", versionNo: 4, effectiveFrom: "2026-11-21T18:35:13.297Z" },
    { id: "empv_7369DD6AAB6B4AD9B07D9D67AF", employeeId: "emp_86A81CE8FF6F42E187BCF2B540", versionNo: 3, effectiveFrom: "2026-11-15T03:27:58.000Z" },
    { id: "empv_BEB487D9B8DC46ECB1C1AD663B", employeeId: "emp_86A81CE8FF6F42E187BCF2B540", versionNo: 2, effectiveFrom: "2026-11-14T11:30:47.566Z" },
    { id: "empv_DA3408CDC3DC4F8F9BFEED9EF8", employeeId: "emp_86A81CE8FF6F42E187BCF2B540", versionNo: 1, effectiveFrom: "2026-11-13T22:15:11.641Z" },
  ],
};

/** grant_escalation：实测 consumed 单（无 detail 载体、binding.changeKind 在位）。 */
const GOLD_ESCALATION = {
  approvalId: "ap_7D484B3FFBE048ECB7B96F92C9",
  type: "business_action",
  status: "consumed",
  action: "grant.escalation",
  argsDigest: "0d1f1c8f0dcd7a3b0f0a9a9c6a4c2a5b",
  binding: {
    subjectType: "employee",
    subjectId: "emp_86A81CE8FF6F42E187BCF2B540",
    changeKind: "grant_escalation",
    targetHash: "th_7111bc64272abf73c0f0e27373c4f4e9",
  },
  riskLevel: "high",
  reasonText: "P0-7 temporary grants escalation",
  consumedAt: "2026-11-15T03:23:29.443Z",
  decisions: [{ userId: "human:1", verdict: "approve", decidedAt: "2026-11-15T03:23:00.000Z" }],
  createdAt: "2026-11-15T03:20:00.000Z",
  decidedAt: "2026-11-15T03:23:00.000Z",
};

/** 批准但未消费（approved + 无 consumedAt）：E52 的输入形制。 */
const GOLD_APPROVED_WAITING = {
  ...GOLD_ESCALATION,
  approvalId: "ap_AP02WAITING00000000000001",
  status: "approved",
  consumedAt: undefined,
};

/** consumed 但响应里没有 run 标识：只给文案，不画回链。 */
const GOLD_CONSUMED_NO_RUN = {
  ...GOLD_ESCALATION,
  approvalId: "ap_AP02NORUN0000000000000001",
};

/** consumed 且 binding.runId 在位（message_send 实测形制）：给文案 + 真回链。 */
const GOLD_CONSUMED_WITH_RUN = {
  ...GOLD_ESCALATION,
  approvalId: "ap_AP02WITHRUN0000000000000001",
  action: "message.send",
  binding: { ...GOLD_ESCALATION.binding, changeKind: "message_send", runId: "rn_01P07E2E0000000000000000AA" },
};

/** 没写明变更类型（binding 不带 changeKind）：第四分支。 */
const GOLD_NO_KIND = {
  approvalId: "ap_AP02NOKIND0000000000000001",
  type: "business_action",
  status: "expired",
  action: "unknown.thing",
  riskLevel: "low",
  reasonText: "无类型单",
  decisions: [],
  createdAt: "2026-11-20T00:00:00.000Z",
};

/** employee_version_create 但响应不带差异载体：第二分支（不猜版本对）。 */
const GOLD_VERSION_NO_CARRIER = {
  ...GOLD_ESCALATION,
  approvalId: "ap_AP02NOCARRIER00000000000001",
  action: "employee.version.create",
  binding: { ...GOLD_ESCALATION.binding, changeKind: "employee_version_create" },
};

/** 按 URL 记账的 serve：分支测试要钉「该读的读、不该读的一次都不读」。 */
function serveTracking(rows: unknown[], versions: unknown = VERSIONS_MEASURED): string[] {
  const urls: string[] = [];
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    urls.push(u);
    if (u.includes("/api/approval?id=")) {
      const id = decodeURIComponent(u.split("id=")[1]?.split("&")[0] ?? "");
      const row = (rows as { approvalId?: string }[]).find((r) => r.approvalId === id);
      return row ? { ...row } : {};
    }
    if (u.includes("/api/employee-versions")) return versions;
    if (u.includes("/api/approvals")) return { items: rows };
    return {};
  });
  return urls;
}

const versionsCalls = (urls: string[]): string[] => urls.filter((u) => u.includes("/api/employee-versions"));

describe("AP-02 changeKind-bracketed diff — four确定形态", () => {
  it("分支①：employee_version_create 有载体 → 字段行 + 相邻版本核对（读既有端点，钉 URL）", async () => {
    const urls = serveTracking([GOLD_VERSION, GOLD_MESSAGE]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AEEC078E0C824E749513AFEC9A");

    await waitFor("chain note", () => !!q("apd10-chain-note"));
    const body = text("apd10-diff");
    expect(body).toContain("员工版本");
    // 实测链上 empv_BEB487…＝v2，单据宣布 v3 ⇒ 屏上能说 v2→v3。
    const chain = text("apd10-chain-note");
    expect(chain).toContain("前版 v2");
    expect(chain).toContain("后版 v3 已在链上");
    expect(chain).toContain("链上读回 5 版");
    // 只读既有端点，URL 形制逐字钉住（员工号来自响应）。
    expect(versionsCalls(urls)).toEqual(["/agent-api/api/employee-versions?id=emp_86A81CE8FF6F42E187BCF2B540&limit=50"]);
    expect(q("apd10-diff-unwired"), "有数据不显未提供句").toBeNull();
  });

  it("分支①b：版本链读不回（响应不是列表）→ 只说未读回，不补 v 号", async () => {
    serveTracking([GOLD_VERSION], { detail: "console.unknown_route" });
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AEEC078E0C824E749513AFEC9A");

    await waitFor("chain unreadable", () => !!q("apd10-chain-unreadable"));
    expect(text("apd10-chain-unreadable")).toContain("版本链未读回");
    expect(q("apd10-chain-note"), "读不回不画链上行").toBeNull();
    // 字段级行仍来自本单响应，不受链失败影响。
    expect(text("apd10-diff")).toContain("员工版本");
  });

  it("分支②：employee_version_create 无载体 → 「未接」带原因，且一次都不读版本链", async () => {
    const urls = serveTracking([GOLD_VERSION_NO_CARRIER]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AP02NOCARRIER00000000000001");

    const unwired = q("apd10-diff-unwired");
    expect(unwired, "未接 carrier").toBeTruthy();
    expect(unwired!.textContent ?? "").toContain("未接");
    expect(unwired!.getAttribute("title") ?? "").toContain("没有带回字段级前后值");
    expect(q("apd10-diff-row-0"), "无载体不画行").toBeNull();
    expect(q("apd10-chain-note"), "无载体不猜版本对，不读链").toBeNull();
    expect(versionsCalls(urls), "无载体零次读链").toEqual([]);
  });

  it("分支③：其它已知类型（message_send/grant_escalation）→ 差异明细未提供（无差异数据源）", async () => {
    const urls = serveTracking([GOLD_MESSAGE, GOLD_ESCALATION]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_0C67930A766D4AA49E4B5B44EC");

    const unwired = q("apd10-diff-unwired");
    expect(unwired!.textContent ?? "").toContain("差异明细未提供（该变更类型无差异数据源）");
    expect(unwired!.getAttribute("title") ?? "", "原因句点名类型原值").toContain("message_send");
    expect(q("apd10-diff-row-0")).toBeNull();
    expect(versionsCalls(urls), "非版本类型零次读链").toEqual([]);

    await openDetail("ap_7D484B3FFBE048ECB7B96F92C9");
    const again = q("apd10-diff-unwired");
    expect(again!.textContent ?? "").toContain("差异明细未提供（该变更类型无差异数据源）");
    expect(again!.getAttribute("title") ?? "").toContain("grant_escalation");
    expect(versionsCalls(urls)).toEqual([]);
  });

  it("分支④：未写明变更类型 → 差异明细未提供（没写明类型），不推断成任何已知类", async () => {
    const urls = serveTracking([GOLD_NO_KIND]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AP02NOKIND0000000000000001");

    const unwired = q("apd10-diff-unwired");
    expect(unwired!.textContent ?? "").toContain("差异明细未提供（该单据没写明变更类型）");
    expect(text("apd10-diff")).not.toContain("员工版本");
    expect(versionsCalls(urls)).toEqual([]);
  });

  it("风险差异四项无源 ⇒ 整块不渲染，也不以 0 或空壳占位", async () => {
    serveTracking([GOLD_VERSION, GOLD_ESCALATION]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AEEC078E0C824E749513AFEC9A");
    const drawer = text("apr5-detail");
    for (const item of ["可触达", "新增写入", "未脱敏", "同类申请"]) {
      expect(drawer, `风险差异项「${item}」无源不渲染`).not.toContain(item);
    }
    // 差异段里没有「0 项/0 条」这类把缺读当 0 的句式。
    expect(text("apd10-diff")).not.toMatch(/\b0\b\s*[项条]|\b无\s*0\b/);
    expect(q("apd10-diff-row-2"), "removed_grant_ids 实测为空数组 ⇒ 不出移除行").toBeTruthy();
    expect(q("apd10-diff-row-3"), "空数组不画第四行").toBeNull();
  });

  it("argsDigest 标注「不可逆摘要，非差异」（差异段内 + 详情技术行）", async () => {
    serveTracking([GOLD_VERSION]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AEEC078E0C824E749513AFEC9A");

    expect(text("apd10-digest-note")).toContain("不可逆摘要，非差异");
    // 「详情」折叠段展开后，摘要行同样自带说明；原码不进差异正文。
    const toggle = Array.from((q("apr5-detail") ?? document).querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "详情",
    ) as HTMLButtonElement | undefined;
    expect(toggle, "详情钮在位").toBeTruthy();
    await act(async () => {
      toggle!.click();
    });
    const disclosure = document.querySelector("[data-testid$='-details']");
    expect(disclosure?.textContent ?? "", "详情技术行带摘要说明").toContain(
      "参数摘要：22eadfcebfdaa88b5451bb8622503c876ddfd7418e692056baa29786bb9fb63f（不可逆摘要，非差异）",
    );
    expect(text("apd10-diff")).not.toContain("22eadfcebfdaa88b");
  });
});

describe("AP-02 consumedAt — E52/E53 两态可判", () => {
  it("approved 且 consumedAt 空 ⇒「已批准，等待运行时使用」，无回链", async () => {
    const urls = serveTracking([GOLD_APPROVED_WAITING]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AP02WAITING00000000000001");

    expect(text("apd10-consumed-waiting")).toContain("已批准，等待运行时使用");
    expect(q("apd10-consumed-used"), "等待态不显已使用").toBeNull();
    expect(q("apd10-consumed-run-link"), "没有 run 标识不画回链").toBeNull();
    expect(versionsCalls(urls)).toEqual([]);
  });

  it("consumedAt 非空 ⇒「已被运行时使用」；仅当响应真带回 run 才画回链", async () => {
    serveTracking([GOLD_CONSUMED_WITH_RUN, GOLD_CONSUMED_NO_RUN]);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);

    await openDetail("ap_AP02WITHRUN0000000000000001");
    expect(text("apd10-consumed-used")).toContain("已被运行时使用");
    const link = q("apd10-consumed-run-link") as HTMLAnchorElement | null;
    expect(link, "binding.runId 实测在位 ⇒ 真回链").toBeTruthy();
    expect(link!.getAttribute("href")).toBe("/runs?run=rn_01P07E2E0000000000000000AA");

    await openDetail("ap_AP02NORUN0000000000000001");
    expect(text("apd10-consumed-used")).toContain("已被运行时使用");
    expect(q("apd10-consumed-run-link"), "无 run 标识只给文案").toBeNull();
    expect(text("apd10-consumed-run-none")).toContain("没带回运行编号");
  });

  it("consumed 但 consumedAt 缺键 ⇒ 说「使用时间未回传」，不假装有读数", async () => {
    const rows = [{ ...GOLD_ESCALATION, approvalId: "ap_AP02NOCONSUMEDAT0000000001", consumedAt: undefined }];
    serveTracking(rows);
    await renderInto("/approvals?tab=history", <ApprovalsHistoryModulePage />);
    await openDetail("ap_AP02NOCONSUMEDAT0000000001");

    expect(text("apd10-consumed-used")).toContain("使用时间未随本单回传");
    expect(q("apd10-consumed-waiting"), "已执行态不说等待使用").toBeNull();
  });

  it("读取腿单点：consumedAt/run 的键形制按实测响应解析，缺即 null", () => {
    const used = approvalDetailFrom(GOLD_CONSUMED_WITH_RUN);
    expect(used!.consumedAt).toBe("2026-11-15T03:23:29.443Z");
    expect(used!.consumptionRunId).toBe("rn_01P07E2E0000000000000000AA");
    const waiting = approvalDetailFrom(GOLD_APPROVED_WAITING);
    expect(waiting!.consumedAt).toBeNull();
    expect(waiting!.consumptionRunId).toBeNull();
    const view = consumptionStateFrom(waiting!.status.raw, waiting!.consumedAt);
    expect(view).toEqual({ state: "waiting", at: null, atRaw: null, timeMissing: false });
    expect(consumptionStateFrom("expired", null), "过期单不宣称消费态").toBeNull();
    expect(consumptionStateFrom("pending", null)).toBeNull();
  });
});

