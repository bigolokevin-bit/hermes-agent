/**
 * audQ — one place that decides what a person may do while the ledger is in a
 * given state, and what the control says when they may not.
 *
 * Before this file, the same question was answered five times in five places:
 * the export buttons each had their own ternary, the copy controls carried
 * their own sentences, the row fold had no opinion at all, and the retry button
 * was disabled in exactly the state where pressing it is most useful. Two
 * entries could then disagree about one failure — the export greyed out while
 * the record link next to it stayed live — and no test could see the pair.
 *
 * Now: one input (the ledger's state, whether a question is on the address, how
 * many rows came back, whether the custom range is still a draft, and what the
 * record read attached to a leg is doing), one derived object, and every entry
 * reads its `enabled` and its `title` from that object. The wording is the
 * wording the panels already shipped with — this module moves the sentences, it
 * does not rewrite them.
 *
 * Two judgement calls, stated where they can be argued with:
 * - 复制筛选摘要 stays live while the ledger is loading, empty, refused or
 *   failed. Its material is the address and the path this page already asked
 *   for — not the rows. A person filing a refused read needs exactly that
 *   sentence, and disabling it would take the tool away at the moment the tool
 *   describes. (The blank answer is NOT treated as unavailable: 真空 ≠ 不可用.)
 * - 复制固定链接 follows the record it sits on. If the read that the link would
 *   open is outstanding, failed or refused, the link is off with the reason —
 *   a pointer is not a promise when its target did not answer.
 */

import { PERMALINK_MISSING_TITLE } from "./permalink";
import type { Phase } from "./useAuditData";

/** What a control can do, and what it says about that. */
export interface Gate {
  enabled: boolean;
  title: string;
}

export interface AuditGateInput {
  /** The ledger read's own state. */
  phase: Phase;
  /** A chosen custom range whose pair is not filled in yet: nothing was asked. */
  customInvalid: boolean;
  /** Rows on screen after filtering and sorting — the set every entry acts on. */
  rows: number;
  /** The address carries at least one reading question. */
  question: boolean;
  /**
   * audQ: what the record read attached to the open leg is doing. `idle` (no
   * read) and `ready` both leave the fixed link available; an outstanding,
   * failed or refused read takes it off until the record answers.
   */
  record?: RecordGateState;
  /** Whether the leg being looked at has an identifier to point at at all. */
  hasIdentifier?: boolean;
}

export interface AuditGates {
  /**
   * The state the gates were derived from, in its probe spelling. This ledger
   * read has no separate unwired phase: a missing route answers 404 and joins
   * the denied body (audF keeps the 未接入 marker beside it), so the gates only
   * ever see the five states the hook reports.
   */
  phase: Phase;
  /** 导出 CSV（顶部工具条那一枚）。 */
  exportCsv: Gate;
  /** 导出当前筛选 CSV（aud5 那一枚）。 */
  exportFiltered: Gate;
  /** 复制当前筛选条件（audG）。 */
  copyFilter: Gate;
  /** audG 常驻件写在卡上的挂载规则一句话（同一个源）。 */
  copyFilterRule: string;
  /** 复制事件链接（audE）。 */
  copyLink: Gate;
  /** 行内展开预览（aud6）。 */
  toggle: Gate;
  /** 重试/刷新这一页。 */
  retry: Gate;
}

/**
 * The link and fold gates also need to know what the record read attached to
 * that leg is doing — the ledger's own state is not enough.
 */
export type RecordGateState = "idle" | "loading" | "ready" | "error" | "denied";

/**
 * One rule inside, stated once: an entry that acts on ROWS is only live while
 * rows are actually on screen. An entry that acts on the ADDRESS is live
 * whenever the address says something.
 */
export function auditGatesOf(input: AuditGateInput): AuditGates {
  const { phase, customInvalid, rows, question } = input;
  const hasRows = phase === "ready" && rows > 0;

  const exportCsv: Gate = !hasRows
    ? {
        enabled: false,
        title: customInvalid
          ? "自定义时间窗不完整，没有可导出的记录"
          : "当前筛选没有可导出的记录",
      }
    : { enabled: true, title: "导出当前筛选结果为 CSV（北京时间）" };

  const exportFiltered: Gate = !hasRows
    ? { enabled: false, title: "当前筛选无事件可导出" }
    : { enabled: true, title: "导出当前筛选为 CSV（北京时间）" };

  // audQ: the summary control's own sentences moved here — including the mount
  // rule the card prints — so there is exactly one copy of each.
  const copyFilter: Gate = question
    ? {
        enabled: true,
        title: `常驻控件，现在可以复制：这一页带着「${PHASE_WORDS[phase]}」读法与至少一个筛选口径（时间窗、自定义区间、类型、操作者、资源、每页条数或页码）。复制的是口径与这一页实际请求的相对路径，不含地址前缀与任何凭据，也不再向服务发一次请求。`,
      }
    : {
        enabled: false,
        // audS: R49 的探针按这句话取读数，所以它排在最前。
        title: `当前没有可复制的筛选条件：这一页只有默认时间窗，没有自定义区间、类型、操作者、资源、每页条数或页码可交代。控件常驻，只是没内容可给。${customInvalid ? "（自定义区间还没应用）" : ""}`,
      };

  const retry: Gate = {
    enabled: true,
    title:
      phase === "loading"
        ? "再读一次这一页（这是你按的，不是页面自己重发）"
        : phase === "denied"
          ? "再读一次：筛选、页码与地址都还在原处"
          : "重新读这一页，不发多余的请求",
  };

  const toggle: Gate = hasRows
    ? { enabled: true, title: "展开或收起这一条的预览（只动展开态自己的那一格）" }
    : {
        enabled: false,
        title:
          phase === "loading"
            ? "正在读取这一页，还没有可展开的行"
            : phase === "denied"
              ? "审计事件暂不可读，这一页没有可展开的行"
              : phase === "error"
                ? "这一页没能读到；先重试，读到了再展开"
                : "这一页没有记录可展开",
      };

  // audQ: a fixed link is only handed out while there is a row to put it on.
  // The ledger's own state decides that; the record read behind the link then
  // decides whether the pointer has anything standing behind it.
  const copyLink: Gate = hasRows
    ? copyLinkGate(input.record ?? "idle", input.hasIdentifier !== false)
    : {
        enabled: false,
        title:
          phase === "loading"
            ? "这一页还在读，先没有可复制的固定链接"
            : phase === "denied"
              ? "这一页暂时读不到，先不给固定链接"
              : phase === "error"
                ? "这一页没能读到；先重试，读到才谈得上固定链接"
                : "这一页没有记录，也就没有可固定的那一条",
      };

  return {
    phase,
    exportCsv,
    exportFiltered,
    copyFilter,
    copyFilterRule:
      "这个控件常驻。地址里带着任一读法（自定义区间、事件类型、操作者、资源、每页条数或页码）时就能复制；只有默认时间窗时它在这里但按不动，原因写在按钮上。",
    copyLink,
    toggle,
    retry,
  };
}

/** The phase word each control uses when it explains itself. */
const PHASE_WORDS: Record<Phase, string> = {
  loading: "正在读取",
  ready: "已读到记录",
  empty: "该条件下无事件",
  error: "读取没有完成",
  denied: "暂时无法查看审计事件",
};

/**
 * audQ: the fixed link, per leg. It is only handed out when there IS an
 * identifier to point at and the record behind that pointer is not in a failed
 * or outstanding state — so a preview whose 「打开详情」 read just failed cannot
 * offer a live link while the record pane beside it says the read failed.
 */
export function copyLinkGate(recordPhase: RecordGateState, hasIdentifier: boolean): Gate {
  if (!hasIdentifier) {
    return { enabled: false, title: PERMALINK_MISSING_TITLE };
  }
  if (recordPhase === "loading") {
    return { enabled: false, title: "这一条的详情正在读，读到之后再给固定链接" };
  }
  if (recordPhase === "error") {
    return { enabled: false, title: "这一条的详情没读到；先重试，读到才有可发的固定链接" };
  }
  if (recordPhase === "denied") {
    return { enabled: false, title: "这一条现在读不到（没开放或已不在），先不给固定链接" };
  }
  return {
    enabled: true,
    title: "复制这一条事件的固定链接（粘出去可回到同一事件），不向服务发任何请求",
  };
}

/**
 * The probe mirror: one attribute per entry, so a probe can read the whole
 * matrix off the DOM instead of inferring it from five widgets.
 */
export function gateMirror(gates: AuditGates): Record<string, string> {
  const flag = (gate: Gate): string => (gate.enabled ? "on" : "off");
  return {
    "data-aud-gates-phase": gates.phase,
    "data-aud-gates-export": flag(gates.exportCsv),
    "data-aud-gates-export-filtered": flag(gates.exportFiltered),
    "data-aud-gates-copy-filter": flag(gates.copyFilter),
    "data-aud-gates-copy-link": flag(gates.copyLink),
    "data-aud-gates-toggle": flag(gates.toggle),
    "data-aud-gates-retry": flag(gates.retry),
  };
}
