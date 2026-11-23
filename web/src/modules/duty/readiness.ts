/**
 * V1/V2/V3/V6 gate evidence for 可上岗 (PRD v4 §2 北极星与四门).
 *
 * Every gate is computed from live BFF reads — nothing is hardcoded to
 * unknown any more. A gate whose evidence source did not answer counts as
 * 「待核实」(unknown) per employee, and unknown never enters the numerator.
 */
import type { Loadable } from "./types";

/** One workstation row of /api/workstations?id=… */
export interface StationBinding {
  bindingType?: string;
  channel?: string;
  status?: string;
  capabilities?: string[];
}

/** Projected /api/effective-config?id=… (only the fields V2 needs). */
export interface ConfigView {
  scopes: string[];
  grants: { expiresAt: string | null }[];
  resolvedAt: string | null;
}

/** One message-send decision of /api/approvals?status=all (V6 evidence). */
export interface ApprovalEvidence {
  subjectId: string;
  status: string;
  expiresAt: string | null;
  hasApprover: boolean;
}

/** Probe result of /api/knowledge/documents (V3 leg 1). */
export interface KnowledgeProbe {
  /** False when the read side is not wired (404 envelope), e.g. Bisheng down. */
  wired: boolean;
  /** Citable-document count; null while unwired — never a fabricated 0. */
  count: number | null;
  asOf: string | null;
}

export interface ReadinessEvidence {
  stations: Record<string, Loadable<StationBinding[]>>;
  configs: Record<string, Loadable<ConfigView>>;
  approvals: Loadable<ApprovalEvidence[]>;
  knowledge: Loadable<KnowledgeProbe>;
}

export type GateVerdict = "pass" | "fail" | "unknown";

function alive(expiresAt: string | null, now: number): boolean {
  if (expiresAt === null) return true;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t > now;
}

/**
 * V1 群@：工位里存在「群绑定 + active」。渠道事件（最近一次群内成功应答）走
 * /v1/channel-events，BFF 有意不代理列表（红线），所以这一腿缺证时按已接入
 * 的工位腿判定并在 source 里注明不完整。
 */
export function v1Verdict(stations: StationBinding[]): GateVerdict {
  const ok = stations.some((s) => s.bindingType === "group" && s.status === "active");
  return ok ? "pass" : "fail";
}

/** V2 ReBAC：有效配置里 knowledgeScopes 非空且存在未过期的授权 grant。 */
export function v2Verdict(cfg: ConfigView, now: number): GateVerdict {
  const scoped = cfg.scopes.length > 0;
  const granted = cfg.grants.some((g) => alive(g.expiresAt, now));
  return scoped && granted ? "pass" : "fail";
}

/**
 * V3 引用：三腿（可引用文档 / responsePolicy 强制引用 / 运行引用证据）。
 * 文档读口未接线 → unknown（「未接」）；已接线但目录为空 → fail；
 * 有文档但策略与运行引用两腿仍无读口 → 仍是 unknown（待核实）。
 */
export function v3Verdict(knowledge: KnowledgeProbe): GateVerdict {
  if (!knowledge.wired) return "unknown";
  if (knowledge.count === null || knowledge.count === 0) return "fail";
  return "unknown";
}

/**
 * V6 审批：该员工存在「message_send 决策 + 有审批人 + 未过期」。
 * 口径取 status=approved；consumed/expired/pending/denied 均不构成有效审批。
 */
export function v6Verdict(rows: ApprovalEvidence[], subjectId: string, now: number): GateVerdict {
  const ok = rows.some(
    (r) => r.subjectId === subjectId && r.hasApprover && r.status === "approved" && alive(r.expiresAt, now),
  );
  return ok ? "pass" : "fail";
}

/** Roll per-employee verdicts (null = 该员工这一门的证据源没有回答) into a gate. */
export function rollup(verdicts: (GateVerdict | null)[]): {
  pass: number | null;
  fail: number | null;
  unknown: number;
  state: GateVerdict;
} {
  const pass = verdicts.filter((v) => v === "pass").length;
  const fail = verdicts.filter((v) => v === "fail").length;
  const unknown = verdicts.filter((v) => v === null || v === "unknown").length;
  const resolved = pass + fail;
  if (resolved === 0) return { pass: null, fail: null, unknown, state: "unknown" };
  const state: GateVerdict = fail > 0 ? "fail" : unknown > 0 ? "unknown" : "pass";
  return { pass, fail, unknown, state };
}

/**
 * The lifecycle states that enter the 可上岗率 denominator (PRD v4 §2):
 * draft / onboarding / archived never do.
 */
export const DENOMINATOR_STATES = new Set(["active", "paused", "offboarding"]);

export function denominatorRows(rows: { lifecycleState?: string }[]): { lifecycleState?: string }[] {
  return rows.filter((e) => DENOMINATOR_STATES.has(e.lifecycleState ?? "active"));
}

export type { Loadable };
