/**
 * R32 item 3: explicit "未接入" page for SPA paths that have no surface yet.
 * Replaces the silent fall-through to /overview: the visitor is told, in
 * plain words, that this page is not wired — and nothing is invented.
 */
import { Link } from "react-router";

export function NotWiredPage({ label, testId }: { label: string; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid={testId}>
      <p
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
        role="status"
        data-testid={`${testId}-notice`}
      >
        「{label}」页面尚未接入：没有对应的数据源与页面实现，这里不展示猜测内容。
      </p>
      <p className="text-xs text-muted-foreground">
        如果你是从旧链接或外部入口进来的，说明该功能还在规划中；当前版本没有可读取的数据。
      </p>
      <Link className="text-sm underline" to="/overview">
        返回值班台
      </Link>
    </div>
  );
}
