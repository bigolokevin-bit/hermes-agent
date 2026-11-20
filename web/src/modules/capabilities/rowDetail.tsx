import type { ReactNode } from "react";

export type CapabilityRowDetailProps = {
  name: string | null;
  type: string | null;
  enabled: string | null;
  updatedAt: string | null;
  endpoint: string;
  asOf: string | null;
  asOfReason: string;
  /** Engineering context, title only (for example `asOfSource`). */
  asOfTitle?: string | null;
  testid: string;
};

function Field({ label, value, reason, title, testid }: { label: string; value: string | null; reason?: string | null; title?: string | null; testid: string }): ReactNode {
  const tooltip = [title, reason].filter((part): part is string => Boolean(part)).join(" · ") || undefined;
  return (
    <div className="cap7-field">
      <dt>{label}</dt>
      <dd data-testid={testid} title={tooltip} className={value ? undefined : "cap7-missing"}>
        {value ?? "该字段未返回"}
      </dd>
    </div>
  );
}

export function CapabilityRowDetail({ name, type, enabled, updatedAt, endpoint, asOf, asOfReason, asOfTitle, testid }: CapabilityRowDetailProps): ReactNode {
  return (
    <div className="cap7-detail" data-testid={testid}>
      <dl className="cap7-detail-grid">
        <Field label="口径名" value={name} reason="上游没有返回这一项的名称。" testid="cap7-detail-name" />
        <Field label="来源" value={type} reason="上游没有返回来源或类型。" testid="cap7-detail-type" />
        <Field label="启用态" value={enabled} reason="上游没有返回启用状态。" testid="cap7-detail-enabled" />
        <Field label="最近更新" value={updatedAt} reason="上游没有返回最近更新时间。" testid="cap7-detail-updated" />
        <Field label="读口路径" value={endpoint} reason="没有记录这次读取的路径。" testid="cap7-detail-endpoint" />
        <Field label="采集时刻" value={asOf} reason={asOfReason} title={asOfTitle} testid="cap7-detail-asof" />
      </dl>
    </div>
  );
}
