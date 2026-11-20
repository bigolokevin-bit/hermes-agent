/**
 * R55 — the real exit from a detail back to the list.
 *
 * Browser-back is not the only way out: this button drops just the `id` from
 * the URL, so the status filter (and everything the list already loaded in
 * memory — pages, cursor chain) stays exactly as it was. The scroll position
 * is stashed in sessionStorage when a row is opened and restored here.
 */
import { Button } from "@nous-research/ui/ui/components/button";

export function saveListScroll(key: string): void {
  try {
    window.sessionStorage.setItem(key, String(window.scrollY ?? 0));
  } catch {
    /* storage 不可用只影响滚动复原，不影响数据与筛选 */
  }
}

export function restoreListScroll(key: string): void {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return;
    const y = Number(raw);
    if (Number.isFinite(y)) window.scrollTo(0, y);
  } catch {
    /* 同上 */
  }
}

export function BackToList({ onBack }: { onBack: () => void }) {
  return (
    <Button
      size="sm"
      outlined
      data-testid="apd7-back"
      title="返回列表：状态筛选、已加载的分页与滚动位置都按打开详情前的样子复原"
      onClick={onBack}
    >
      返回列表
    </Button>
  );
}
