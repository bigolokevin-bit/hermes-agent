import type { MatrixCapabilities, MatrixRow } from "./types";
import { isRecord, num, text } from "./types";

/**
 * Matrix normaliser and the capability-resource catalogue.
 *
 * This file used to carry sample rows while the BFF route was missing. The
 * live read model is now `/api/matrix` (BFF → domain `/v1/matrix/employees`),
 * so no sample row ships any more: a missing route renders「未接入」and never
 * falls back to made-up data.
 */
function strings(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (typeof x === "string" ? x : isRecord(x) ? text(x.id) ?? text(x.name) : null))
    .filter((x): x is string => Boolean(x));
  return out;
}

export function normalizeMatrixRow(raw: unknown): MatrixRow | null {
  if (!isRecord(raw)) return null;
  const employeeId = text(raw.employeeId) ?? text(raw.employee_id) ?? text(raw.id);
  if (!employeeId) return null;
  const capRaw = isRecord(raw.capabilities) ? raw.capabilities : raw;
  const capabilities: MatrixCapabilities = {
    skills: strings(capRaw.skills ?? capRaw.skillIds ?? capRaw.skill_ids),
    tools: strings(capRaw.tools ?? capRaw.toolIds ?? capRaw.tool_ids),
    knowledge: strings(
      capRaw.knowledge ?? capRaw.knowledgeScopes ?? capRaw.knowledge_scopes,
    ),
  };
  const riskRaw = isRecord(raw.risk) ? raw.risk : null;
  return {
    employeeId,
    name: text(raw.name) ?? text(raw.displayName) ?? undefined,
    lifecycleState: text(raw.lifecycleState) ?? text(raw.lifecycle) ?? undefined,
    versionRef: text(raw.versionRef) ?? text(raw.currentVersionId) ?? undefined,
    title: text(raw.title) ?? undefined,
    ownerUserId: text(raw.ownerUserId) ?? undefined,
    capabilities,
    risk: riskRaw
      ? {
          blockedApprovals: num(riskRaw.blockedApprovals) ?? undefined,
          failedRuns: num(riskRaw.failedRuns) ?? undefined,
          budgetOver: typeof riskRaw.budgetOver === "boolean" ? riskRaw.budgetOver : undefined,
        }
      : null,
  };
}

export const CAP_RESOURCES = [
  { id: "skill", label: "技能", field: "skills" as const },
  { id: "tool", label: "工具与接口", field: "tools" as const },
  { id: "kb", label: "知识空间", field: "knowledge" as const },
];

export interface ResourceRow {
  name: string;
  covered: number;
  total: number;
  employees: string[];
  state: "normal" | "single" | "zero" | "unknown";
}

export function resourceRows(rows: MatrixRow[], field: "skills" | "tools" | "knowledge"): ResourceRow[] {
  const active = rows.filter((r) => (r.lifecycleState ?? "") === "active");
  const names = new Set<string>();
  for (const r of active) for (const n of r.capabilities?.[field] ?? []) names.add(n);
  return [...names].sort().map((name) => {
    const employees = active.filter((r) => (r.capabilities?.[field] ?? []).includes(name));
    const covered = employees.length;
    const total = active.length;
    return {
      name,
      covered,
      total,
      employees: employees.map((e) => e.name ?? `员工 · ${e.employeeId.slice(-4)}`),
      state: covered === 0 ? "zero" : covered === 1 ? "single" : "normal",
    };
  });
}