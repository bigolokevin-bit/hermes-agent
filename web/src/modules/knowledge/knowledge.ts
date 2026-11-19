/**
 * T23 · 知识空间 — honest read surface.
 *
 * GAP-03: the knowledge service has no HTTP read side in this BFF yet, so
 * there is no endpoint to probe. The page renders 「未接入」 for the space
 * list, document count and retrieval entry; it never fabricates spaces,
 * documents or search hits. `?state=` supports the shell's four forced
 * states for IA smoke tests.
 */

export type KnowledgePhase = "loading" | "ready" | "empty" | "error" | "denied" | "unavailable";

export const GAP03 =
  "知识空间未接入（GAP-03）：知识服务当前没有 HTTP 读侧，本页不展示样例空间。接入后这里会自动显示真实空间与文档数。";

export interface KnowledgeSpace {
  spaceId: string;
  name: string;
  docCount: number | null;
  updatedAt?: string;
}

export function isForcedState(value: string): value is "loading" | "empty" | "error" | "denied" {
  return value === "loading" || value === "empty" || value === "error" || value === "denied";
}

/** No endpoint exists. Kept as a pure seam so a future read route only
 * changes this function, not the page's four-state rendering. */
export async function loadSpaces(): Promise<{ phase: KnowledgePhase; rows: KnowledgeSpace[] }> {
  return { phase: "unavailable", rows: [] };
}