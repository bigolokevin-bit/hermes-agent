// Module: capabilities — one-row plain-text projection for the list rows.
//
// Separate from the row-DETAIL copy (`listCopy.tsx` `toFieldText`): the detail
// copies the expanded six-field panel, this copies the five segments the row
// itself shows. One wording source per surface; the two never overwrite each
// other's testids except where the order froze the same status/fallback names
// (disclosed in DONE R93).

/** What a row-copy line carries. Every field is the on-screen value already
 * rendered by the row — the helper formats, it never fetches or invents. */
export type CapRowCopyInput = {
  /** Display name as shown; "—" when the read port omitted it. */
  name: string;
  /** Human type/source as shown (人话, never a raw enum). Null → 「—」. */
  type: string | null;
  /** Human status as shown (正常/停用/待核实/…). Null → 「—」. */
  status: string | null;
  /** Invocation count. Real 0 prints `0`; this surface has no upstream
   * source for it, so pages pass null and the line reads 「—」. */
  calls: number | null;
  /** Upstream identifier when one exists. Synthetic fallbacks (never an
   * upstream id) and Chinese-only names fold to 「—」 — see `capShortCode`. */
  id: string | null;
};

/** 8-char upper-case code of an identifier, mirroring the console idiom
 * (metrics `shortCode` / access / audit) without copying a bare internal id.
 * A synthetic `row-<n>` fallback is not upstream data, so it folds to 「—」;
 * so does any value with no ASCII-alphanumeric characters left. */
export function capShortCode(id: string | null): string {
  if (!id) return "—";
  if (/^row[-_]\d+$/i.test(id.trim())) return "—";
  const bare = id.replace(/[^A-Za-z0-9]/g, "");
  return bare ? bare.slice(0, 8).toUpperCase() : "—";
}

/** The five segments in order: 名称 / 类型 / 状态 / 调用次数 / 短码.
 * Missing values print 「—」; a real 0 prints `0`. No clock, no request. */
export function capRowCopyText(row: CapRowCopyInput): string {
  const name = row.name.trim() ? row.name : "—";
  const calls = typeof row.calls === "number" && Number.isFinite(row.calls) ? String(row.calls) : "—";
  return [
    `名称：${name}`,
    `类型：${row.type ?? "—"}`,
    `状态：${row.status ?? "—"}`,
    `调用次数：${calls}`,
    `短码：${capShortCode(row.id)}`,
  ].join(" · ");
}
