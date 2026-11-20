/**
 * R61 — `/knowledge` 三面（空间列表、空间详情文档列表、全库文档名搜索）共用的
 * 「数据来源与新鲜度」台账。
 *
 * 台账不发起任何请求：三个面本来要发的读取（spaces / documents?spaceId / documents）
 * 在各自的落点把结果上报过来，块的展开与收起、切面与切回都不产生新读取。采集时刻
 * 只取响应顶层 ISO（knAsOfFacts 的六别名），本机时钟不参与；缺失或非 ISO 就是「—」，
 * 原因在 title。403 与 404 在屏上写同一句「读口未接入或没有权限」，GAP 号只进 title。
 *
 * 形态与 health 车道的 sourceReads 同构（module store + useSyncExternalStore），
 * 但不跨模块 import——知识面自带一份，上游改动波及不到这里。展开态不落 URL，
 * 存在模块里：列表 ↔ 详情 ↔ 检索面切换、组件重挂载都不丢。
 */
import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api-error";
import { DOCUMENTS_URL, SPACES_URL, knAsOfFacts, type KnAsOfFacts } from "./knowledge";

export type KnmId = "spaces" | "space-docs" | "doc-search";

export type KnmStatus = "idle" | "loading" | "ok" | "degraded" | "unwired" | "failed";

export const KNM_STATUS_LABEL: Record<KnmStatus, string> = {
  idle: "未读取",
  loading: "读取中",
  ok: "正常",
  degraded: "降级",
  unwired: "读口未接入",
  failed: "读不到",
};

export interface KnmRow {
  id: KnmId;
  label: string;
  /** 本次实际发出的请求路径；还没读过就是占位说明。 */
  path: string;
  status: KnmStatus;
  statusReason: string | null;
  /** 上游原始失败话术：只进 title，不上屏。 */
  statusDetail: string | null;
  requestId: string | null;
  asOf: string | null;
  asOfIso: string | null;
  asOfAlias: string | null;
  asOfSource: string | null;
  asOfReason: string | null;
}

const LABELS: Record<KnmId, string> = {
  spaces: "知识空间列表",
  "space-docs": "指定空间的文档列表",
  "doc-search": "全库文档名搜索",
};

const ORDER: KnmId[] = ["spaces", "space-docs", "doc-search"];

const NOT_READ_YET = "这个面这次还没有发起读取。";

function idleRow(id: KnmId): KnmRow {
  return {
    id,
    label: LABELS[id],
    path: id === "spaces" ? SPACES_URL : id === "doc-search" ? DOCUMENTS_URL : "（下钻到某个空间后才有）",
    status: "idle",
    statusReason: NOT_READ_YET,
    statusDetail: null,
    requestId: null,
    asOf: null,
    asOfIso: null,
    asOfAlias: null,
    asOfSource: null,
    asOfReason: "还没有读取，采集时刻未知。",
  };
}

function factsPatch(facts: KnAsOfFacts): Partial<KnmRow> {
  return {
    asOf: facts.asOf,
    asOfIso: facts.asOfIso,
    asOfAlias: facts.asOfAlias,
    asOfSource: facts.asOfSource,
    asOfReason: facts.asOfReason,
  };
}

let rows: Record<KnmId, KnmRow> = {
  spaces: idleRow("spaces"),
  "space-docs": idleRow("space-docs"),
  "doc-search": idleRow("doc-search"),
};
let expanded = false;
let snapshot: { rows: KnmRow[]; expanded: boolean } = build();
const listeners = new Set<() => void>();

function build(): { rows: KnmRow[]; expanded: boolean } {
  return { rows: ORDER.map((id) => rows[id]), expanded };
}

function emit(): void {
  snapshot = build();
  listeners.forEach((listener) => listener());
}

function patch(id: KnmId, next: Partial<KnmRow>): void {
  rows = { ...rows, [id]: { ...rows[id], ...next } };
  emit();
}

/** 单测与预览复位用：清台账、收起展开态。 */
export function resetKnwSources(): void {
  rows = { spaces: idleRow("spaces"), "space-docs": idleRow("space-docs"), "doc-search": idleRow("doc-search") };
  expanded = false;
  emit();
}

export function markKnwLoading(id: KnmId, path: string): void {
  patch(id, {
    path,
    status: "loading",
    statusReason: "这次读取还没有结束。",
    statusDetail: null,
    requestId: null,
    asOf: null,
    asOfIso: null,
    asOfAlias: null,
    asOfSource: null,
    asOfReason: "读取还没有结束，采集时刻未知。",
  });
}

/** 读取成功（HTTP 有对象回答）：顶层 ISO 在就是正常，不在就是降级——降级不等于读不到。 */
export function settleKnwOk(id: KnmId, path: string, body: unknown): void {
  const facts = knAsOfFacts(body);
  patch(id, {
    path,
    status: facts.asOf !== null ? "ok" : "degraded",
    statusReason: facts.asOf !== null ? null : "读到了数据，但回答没给可用的顶层 ISO 采集时间，新鲜度只能降级标注。",
    statusDetail: null,
    requestId: null,
    ...factsPatch(facts),
  });
}

/** 读取失败：403 与 404 共用同一句人话（反枚举），其它状态归「读不到」；原文只进 title。 */
export function settleKnwFail(id: KnmId, path: string, cause: unknown): void {
  const api = cause instanceof ApiError ? cause : null;
  const unwired = api?.status === 403 || api?.status === 404;
  patch(id, {
    path,
    status: unwired ? "unwired" : "failed",
    statusReason: unwired
      ? "这个读口未接入或没有权限，新鲜度读不到；数据面的状态见上方主面板。"
      : "这次读取没有成功，新鲜度读不到；数据面的状态见上方主面板。",
    statusDetail: api?.message ?? null,
    requestId: api?.requestId ?? null,
    asOf: null,
    asOfIso: null,
    asOfAlias: null,
    asOfSource: null,
    asOfReason: "读取没有成功，采集时刻未知。",
  });
}

export function toggleKnwSources(): void {
  expanded = !expanded;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): { rows: KnmRow[]; expanded: boolean } {
  return snapshot;
}

export function useKnwSources(): { rows: KnmRow[]; expanded: boolean } {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 采集时刻格的 title：原始 ISO + 用的别名 + 上游声明的来源，全部只在这里出现。 */
export function knmAsOfTitle(row: KnmRow): string | undefined {
  if (row.asOf !== null) {
    const alias = row.asOfAlias ? ` · 字段：${row.asOfAlias}` : "";
    const source = row.asOfSource ? ` · 来源：${row.asOfSource}` : "";
    return `asOf 原文：${row.asOfIso}${alias}${source} · 换算北京时间到分`;
  }
  if (row.asOfIso !== null) return `asOf 原文：${row.asOfIso}｜${row.asOfReason ?? ""}`;
  return row.asOfReason ?? undefined;
}
