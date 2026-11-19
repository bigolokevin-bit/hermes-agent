/**
 * Shared count strip for /capabilities.
 *
 * The page shell does not own a capabilities wrapper, so each tab renders this
 * strip at its top. A count is published only by the tab that already fetched
 * its own list: same request, same rows. Switching tabs therefore reuses the
 * last real count instead of firing a second, differently-shaped request.
 */
import { useSyncExternalStore, type ReactNode } from "react";

import { GAP as TOOLS_GAP } from "../tools/tools";
import { SKILLS_GAP } from "../skills/skills";
import "./counts.css";

export type CountSource = "idle" | "loading" | "ready" | "empty" | "missing";

export interface CapabilityCount {
  value: number | null;
  source: CountSource;
  reason: string | null;
  gap: string | null;
}

export type CapabilityKey = "skills" | "tools";

type Snapshot = Record<CapabilityKey, CapabilityCount>;

const IDLE: CapabilityCount = {
  value: null,
  source: "idle",
  reason: "这个 tab 还没有读取过；切过去加载后显示真实数量。",
  gap: null,
};

let snapshot: Snapshot = { skills: IDLE, tools: IDLE };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function publishCapabilityCount(key: CapabilityKey, next: CapabilityCount): void {
  const prev = snapshot[key];
  if (
    prev.value === next.value &&
    prev.source === next.source &&
    prev.reason === next.reason &&
    prev.gap === next.gap
  ) {
    return;
  }
  snapshot = { ...snapshot, [key]: next };
  emit();
}

export function resetCapabilityCounts(): void {
  snapshot = { skills: IDLE, tools: IDLE };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

export function useCapabilityCounts(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const SOURCE_LABEL: Record<CountSource, string> = {
  idle: "未取数",
  loading: "加载中",
  ready: "有源",
  empty: "有源（空）",
  missing: "无源",
};

function CountItem({
  label,
  testid,
  count,
  gapFallback,
}: {
  label: string;
  testid: string;
  count: CapabilityCount;
  gapFallback: string;
}): ReactNode {
  const value = count.value === null ? "—" : String(count.value);
  const title = [count.reason, count.gap ?? (count.source === "missing" ? gapFallback : null)]
    .filter(Boolean)
    .join("（") + (count.reason && (count.gap ?? count.source === "missing") ? "）" : "");
  return (
    <span className="cap4-count" data-testid={testid} title={title || undefined}>
      <span className="cap4-count-label">{label}</span>
      <b className="cap4-count-value">{value}</b>
      <span className="cap4-count-state" data-testid={`${testid}-state`}>
        {SOURCE_LABEL[count.source]}
      </span>
    </span>
  );
}

export function CapabilityCounts(): ReactNode {
  const counts = useCapabilityCounts();
  return (
    <div className="cap4-counts" data-testid="cap4-count-strip" aria-label="能力数量与来源状态">
      <CountItem label="技能" testid="cap4-count-skills" count={counts.skills} gapFallback={SKILLS_GAP} />
      <CountItem label="工具" testid="cap4-count-tools" count={counts.tools} gapFallback={TOOLS_GAP} />
    </div>
  );
}
