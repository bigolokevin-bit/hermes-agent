/**
 * 列表「可上岗」三态派生（2026-11-24 第四轮并排验收 C 项的口径统一）。
 *
 * 现场矛盾：列里填的是生命周期词（在岗 / 草稿），页头却写「N 可上岗 · N 受限」，
 * 两套词在同一屏打架。这里把「可上岗」固定成三态，且页头、说明带、表内 pill
 * 全部只吃这一个函数的输出：
 *
 *   可上岗 = 生命周期在岗（active）且可判定门 V1 群@ / V2 ReBAC / V6 审批 全 pass；
 *   受限   = 在岗，但至少一门 fail 或 unknown（title 点名是哪几门）；
 *   停用   = 生命周期不是在岗（草稿、已暂停、离职中、已归档…），保留配置与历史。
 *
 * 门判定不重写：直接 import duty/readiness.ts 的 verdict 函数（门级读口登记与
 * 交集口径也以那里为唯一出处）。证据没覆盖到的行、生命周期字段没回的行，格内
 * 一律「—」，不猜、不补 0。
 */
import {
  v1Verdict,
  v2Verdict,
  v6Verdict,
  type ApprovalEvidence,
  type ConfigView,
  type GateVerdict,
  type Loadable,
  type ReadinessEvidence,
  type StationBinding,
} from "@/modules/duty/readiness";

export type AvailabilityKey = "ok" | "limited" | "stopped";
export type AvailabilityTone = "ok" | "warn" | "mut";

/** 可判定门（V3 无策略读口，整门不在交集里——见 readiness.ts GATE_READ_PORTS）。 */
export const GATE_LABELS = {
  V1: "V1 群@",
  V2: "V2 ReBAC",
  V6: "V6 审批",
} as const;
export type GateName = keyof typeof GATE_LABELS;

export interface GateReading {
  key: GateName;
  verdict: GateVerdict;
}

export interface AvailabilityView {
  /** null = 这一行判不出来（格内写「—」）。 */
  key: AvailabilityKey | null;
  label: string;
  tone: AvailabilityTone;
  title: string;
  /** 逐门读数；停用行与未覆盖行为 null（没有判过门）。 */
  gates: GateReading[] | null;
}

const UNKNOWN_ROW: AvailabilityView = {
  key: null,
  label: "—",
  tone: "mut",
  title: "这一行的三态判不出来（证据读口没覆盖或字段没回），格内留「—」，不猜。",
  gates: null,
};

function lifecycleWord(life: string): string {
  switch (life) {
    case "active":
      return "在岗";
    case "onboarding":
      return "入职中";
    case "paused":
      return "已暂停";
    case "suspended":
      return "已停用";
    case "offboarding":
      return "离职中";
    case "draft":
      return "草稿";
    case "archived":
      return "已归档";
    default:
      return `状态 ${life}`;
  }
}

function verdictOf<T>(
  port: Loadable<T> | undefined,
  compute: (data: T) => GateVerdict,
): GateVerdict {
  if (!port || port.k !== "ready") return "unknown";
  return compute(port.data);
}

/**
 * 单行派生。ev=null 表示门证据还没到/没有覆盖该员工：非在岗行仍可判「停用」
 * （只看生命周期），在岗行则整格「—」——不拿「未知」冒充「受限」。
 */
export function availabilityOf(
  row: { employeeId: string; lifecycleState?: string | null },
  ev: ReadinessEvidence | null,
  now: number,
): AvailabilityView {
  const life = (row.lifecycleState ?? "").trim();
  if (!life) return UNKNOWN_ROW;
  if (life !== "active") {
    return {
      key: "stopped",
      label: "停用",
      tone: "mut",
      title: `停用：${lifecycleWord(life)}；保留配置与历史，不接新任务。`,
      gates: null,
    };
  }
  if (!ev) return UNKNOWN_ROW;
  const stations = ev.stations[row.employeeId] as Loadable<StationBinding[]> | undefined;
  const config = ev.configs[row.employeeId] as Loadable<ConfigView> | undefined;
  if (!stations || !config) {
    return {
      ...UNKNOWN_ROW,
      title: "该员工的工位 / 有效配置证据本轮没有读到（扇出上限外的行不猜三态）。",
    };
  }
  const gates: GateReading[] = [
    { key: "V1", verdict: verdictOf(stations, (data) => v1Verdict(data)) },
    { key: "V2", verdict: verdictOf(config, (data) => v2Verdict(data, now)) },
    {
      key: "V6",
      verdict: verdictOf(ev.approvals as Loadable<ApprovalEvidence[]>, (data) =>
        v6Verdict(data, row.employeeId, now),
      ),
    },
  ];
  const failed = gates.filter((g) => g.verdict === "fail");
  const unknown = gates.filter((g) => g.verdict === "unknown");
  if (failed.length === 0 && unknown.length === 0) {
    return {
      key: "ok",
      label: "可上岗",
      tone: "ok",
      title: "可上岗：在岗，且 V1 群@ · V2 ReBAC · V6 审批 三道可判定门全部通过。",
      gates,
    };
  }
  const blocked = [
    ...failed.map((g) => `${GATE_LABELS[g.key]}未过`),
    ...unknown.map((g) => `${GATE_LABELS[g.key]}待核实`),
  ];
  return {
    key: "limited",
    label: "受限",
    tone: "warn",
    title: `受限：被 ${blocked.join("、")} 挡在派工之外。`,
    gates,
  };
}

export interface AvailabilityCounts {
  total: number;
  /** null = 有在岗行还没判出门读数，这两个数现在给不出（不补 0）。 */
  ok: number | null;
  limited: number | null;
  stopped: number;
  /** 已判出三态的行数；小于 total 时说明有「—」行。 */
  decided: number;
}

/** 四个数只从上面这一张视图表出，页头与说明带共用，保证与表格逐行一致。 */
export function availabilityCounts(views: AvailabilityView[]): AvailabilityCounts {
  let ok = 0;
  let limited = 0;
  let stopped = 0;
  let undecidedActive = false;
  for (const view of views) {
    if (view.key === "ok") ok += 1;
    else if (view.key === "limited") limited += 1;
    else if (view.key === "stopped") stopped += 1;
    else undecidedActive = true;
  }
  return {
    total: views.length,
    ok: undecidedActive ? null : ok,
    limited: undecidedActive ? null : limited,
    stopped,
    decided: ok + limited + stopped,
  };
}

/** 说明带那句口径（骨架原话的后两段 + 本页真实的第一段判据）。 */
export const AVAILABILITY_NOTE =
  "可上岗=在岗且 V1 群@ · V2 ReBAC · V6 审批 三道可判定门全过；受限=被策略挡在派工之外；停用保留配置与历史";

/** 页头副行 / 说明带图例的一段：数字 + 词，顺序与骨架一致。 */
export interface AvailabilitySummaryPart {
  key: "total" | "ok" | "limited" | "stopped";
  n: number;
  label: string;
  /** 图例圆点的色调；总计段不画点（null）。 */
  tone: AvailabilityTone | null;
}

/**
 * 页头副行与说明带图例的唯一拼装处（骨架 `N 名 · A 可上岗 · B 受限 · C 停用`）。
 *
 * 门读数没覆盖到的行让 counts.ok / counts.limited 为 null：这两段整段不渲染——
 * 副行禁止出现「—」，也不把「未知」写成 0；能判的段照常出数，欠缺原因写在
 * 副行的 title 里。段值为 0 时照常出「0 可上岗」（真零 ≠ 未知），图例保留该点。
 */
export function availabilitySummaryParts(counts: AvailabilityCounts): AvailabilitySummaryPart[] {
  const parts: AvailabilitySummaryPart[] = [
    { key: "total", n: counts.total, label: "名", tone: null },
  ];
  if (counts.ok !== null) parts.push({ key: "ok", n: counts.ok, label: "可上岗", tone: "ok" });
  if (counts.limited !== null) {
    parts.push({ key: "limited", n: counts.limited, label: "受限", tone: "warn" });
  }
  parts.push({ key: "stopped", n: counts.stopped, label: "停用", tone: "mut" });
  return parts;
}

/** 图例口径：与副行同源，去掉总计段。 */
export function availabilityLegendParts(counts: AvailabilityCounts): AvailabilitySummaryPart[] {
  return availabilitySummaryParts(counts).filter((part) => part.key !== "total");
}

/** 三段条的分母：只有 ok/limited 都判出来时才画（缺一段就整条不渲染，避免假比例）。 */
export function availabilitySegments(
  counts: AvailabilityCounts,
): { ok: number; limited: number; stopped: number } | null {
  if (counts.ok === null || counts.limited === null) return null;
  return { ok: counts.ok, limited: counts.limited, stopped: counts.stopped };
}
