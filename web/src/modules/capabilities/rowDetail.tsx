import type { ReactNode } from "react";
import { CapabilityFieldCopy, type CopyField } from "./listCopy";

export type CapabilityRowDetailProps = {
  name: string | null;
  nameReason?: string | null;
  type: string | null;
  typeReason?: string | null;
  enabled: string | null;
  enabledReason?: string | null;
  /** Raw upstream value, title only. */
  enabledTitle?: string | null;
  updatedAt: string | null;
  updatedReason?: string | null;
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
        {value ?? "—"}
      </dd>
    </div>
  );
}

export function CapabilityRowDetail({ name, nameReason, type, typeReason, enabled, enabledReason, enabledTitle, updatedAt, updatedReason, endpoint, asOf, asOfReason, asOfTitle, testid }: CapabilityRowDetailProps): ReactNode {
  const copyFields: CopyField[] = [
    { label: "口径名", value: name },
    { label: "类型或来源", value: type },
    { label: "启用态", value: enabled },
    { label: "最近更新", value: updatedAt },
    { label: "读口路径", value: endpoint },
    { label: "采集时刻", value: asOf },
  ];
  return (
    <div className="cap7-detail" data-testid={testid}>
      <dl className="cap7-detail-grid">
        <Field label="口径名" value={name} reason={nameReason ?? "上游没有返回这一项的名称。"} testid="cap7-detail-name" />
        <Field label="来源" value={type} reason={typeReason ?? "上游没有返回来源或类型。"} testid="cap7-detail-type" />
        <Field label="启用态" value={enabled} reason={enabledReason ?? "上游没有返回启用状态。"} title={enabledTitle} testid="cap7-detail-enabled" />
        <Field label="最近更新" value={updatedAt} reason={updatedReason ?? "上游没有返回最近更新时间。"} testid="cap7-detail-updated" />
        <Field label="读口路径" value={endpoint} reason="没有记录这次读取的路径。" testid="cap7-detail-endpoint" />
        <Field label="采集时刻" value={asOf} reason={asOfReason} title={asOfTitle} testid="cap7-detail-asof" />
      </dl>
      <CapabilityFieldCopy fields={copyFields} />
    </div>
  );
}
