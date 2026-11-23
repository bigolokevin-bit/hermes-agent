/**
 * V1/V2/V3/V6 gate evidence for 可上岗 (PRD v4 §2 北极星与四门).
 *
 * 每条判定都来自真读口，但诚实程度按门各不相同，注释只描述代码现状：
 * V1 是单腿（工位）——第二腿渠道事件列表属 BFF 红线「有意不代理、勿补」，
 * 等 DU-04 裁定，本轮不接。V2/V6 逐员工可判 pass/fail。V3 的真 pass 分支
 * 需要「可引用文档 > 0」与「强制引用策略可读」两腿同时有真读数；2026-11-23
 * 实测策略腿在 BFF 没有任何读口，所以现网 V3 恒「待核实」——这是给不出的
 * 原因，不是可以硬造的数字。
 * 证据源没回答的员工按「待核实」(unknown) 计，unknown 永不进分子。
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

/** Probe result of the V3 documents leg (reads /api/knowledge/citations). */
export interface KnowledgeProbe {
  /** False when the read port answered 「未接线」(404 `*.not_wired` envelope)
   * or returned a shape with no catalog count — never a fabricated count. */
  wired: boolean;
  /** Citable-document count; null while unwired — never a fabricated 0. */
  count: number | null;
  asOf: string | null;
  /** 真回包自带的上游来源名（如 bisheng:/api/v1/knowledge）；没有就 null。 */
  source?: string | null;
  /**
   * 强制引用策略腿。2026-11-23 实测：BFF 白名单（spaces/sources/citations）
   * 没有策略读口，effective-config 的 responsePolicy 也不含引用字段。
   * 接线之前 api.ts 恒传 wired:false ⇒ v3Verdict 的 pass 分支不可达；
   * 接线之后 api.ts 换成真读数，这里零改动。
   */
  policy?: { wired: boolean; reason: string } | null;
}

export interface ReadinessEvidence {
  stations: Record<string, Loadable<StationBinding[]>>;
  configs: Record<string, Loadable<ConfigView>>;
  approvals: Loadable<ApprovalEvidence[]>;
  knowledge: Loadable<KnowledgeProbe>;
  /** 逐员工扇出的真口径：covered 是本轮实际逐一判定的行数（api.ts 有 32 上限），
   * requested 是分母行数；covered<requested 时其余行没有判定、按待核实，卡上必须披露。 */
  coverage: { covered: number; requested: number };
}

export type GateVerdict = "pass" | "fail" | "unknown";

function alive(expiresAt: string | null, now: number): boolean {
  if (expiresAt === null) return true;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t > now;
}

/**
 * V1 群@：工位里存在「群绑定 + active」。第二腿（最近一次群内成功应答）需要
 * 渠道事件列表读口，BFF 红线「有意不代理、勿补」（server.py 写死），等 DU-04
 * 裁定——所以 V1 按已接入的单腿工位判定，并在 source 里注明单腿口径。
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
 * V3 引用最小真口径（工单 DU-01②）：可引用文档 > 0 ∧ 强制引用策略可读 → pass。
 * 文档腿未接线或回包形状漂移 → unknown；已接线且目录为 0 → fail（真读数）；
 * 文档 > 0 但策略腿不可读 → unknown，绝不假 pass、绝不给权威通过数。
 */
export function v3Verdict(knowledge: KnowledgeProbe): GateVerdict {
  if (!knowledge.wired) return "unknown";
  if (knowledge.count === null) return "unknown";
  if (knowledge.count === 0) return "fail";
  return knowledge.policy?.wired ? "pass" : "unknown";
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
