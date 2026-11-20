import { useState } from "react";
import { Card, CardContent } from "@nous-research/ui";
import {
  SOURCE_STATUS_LABEL as STATUS_LABEL,
  SYS6_GAP,
  toggleSourceMatrix,
  useSourceMatrix,
} from "./sourceReads";
import { csvRows, downloadCsv, exportFilename, toCsv } from "./sourceMatrixCsv";

function CopyRid({ id, testid }: { id: string; testid: string }) {
  const [copied, setCopied] = useState(false);
  const short = id.length > 8 ? id.slice(0, 8) : id;
  return (
    <span className="sys6-rid" data-testid={testid} title={id}>
      <span>请求编号 {short}</span>
      <button
        type="button"
        aria-label="复制完整请求编号"
        data-testid={`${testid}-copy`}
        onClick={() => { void navigator.clipboard?.writeText(id).then(() => setCopied(true), () => setCopied(false)); }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </span>
  );
}

export function SourceMatrix() {
  const { rows, expanded } = useSourceMatrix();
  const counts = rows.reduce<Record<string, number>>((out, row) => {
    out[row.status] = (out[row.status] ?? 0) + 1;
    return out;
  }, {});
  const summary = [
    `${rows.length} 个读口`,
    `成功 ${counts.ok ?? 0}`,
    `失败 ${counts.failed ?? 0}`,
    `读口未接入 ${counts.unwired ?? 0}`,
  ].join(" · ");

  const exportRows = csvRows(rows);
  const exportDisabled = exportRows.length === 0;

  return (
    <Card data-testid="sys6-sources">
      <CardContent className="space-y-2 p-4">
        <div className="sys6-head">
          <button
            type="button"
            className="sys6-toggle"
            data-testid="sys6-toggle"
            aria-expanded={expanded}
            onClick={toggleSourceMatrix}
          >
            本页数据来源
            <span className="sys6-count" data-testid="sys6-summary">{summary}</span>
            <span className="sys6-action">{expanded ? "收起" : "展开"}</span>
          </button>
        </div>
        <p className="sys6-note">数值来自本页已经发生的读取，展开或收起不会再发请求；展开状态不写进网址。</p>
        <div className="sys7-actions">
          <button
            type="button"
            className="sys7-export"
            data-testid="sys7-export"
            disabled={exportDisabled}
            title={exportDisabled ? "当前没有可导出的读口行" : "导出当前矩阵；不会再发请求"}
            onClick={() => { downloadCsv(exportFilename(), toCsv(exportRows)); }}
          >
            导出 CSV
          </button>
          <span className="sys7-count" data-testid="sys7-export-count">{exportRows.length} 行</span>
          <span className="sys7-note">导出与屏上矩阵同源：姓名、路径、人话状态、耗时、响应顶层 ISO 采集时刻；缺失留空，不补 0，也不用本机时钟。</span>
        </div>
        {expanded ? (
          <div className="sys6-scroll">
            <table className="sys6-table" data-testid="sys6-table">
              <thead>
                <tr>
                  <th>口径名</th><th>实际请求路径</th><th>本次状态</th><th>响应耗时</th><th>采集时刻</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rid = row.status === "failed" ? row.requestId : null;
                  return (
                    <tr key={row.id} data-testid={`sys6-row-${row.id}`} data-status={row.status}>
                      <td data-testid={`sys6-name-${row.id}`}>{row.label}</td>
                      <td data-testid={`sys6-path-${row.id}`} title={row.path}>{row.path}</td>
                      <td
                        data-testid={`sys6-status-${row.id}`}
                        title={row.status === "unwired" ? SYS6_GAP : row.statusDetail ?? undefined}
                      >
                        <span className="sys6-status">{STATUS_LABEL[row.status]}</span>
                        {row.statusReason ? <span className="sys6-reason">{row.statusReason}</span> : null}
                        {row.status === "unwired" ? (
                          <a className="sys6-apply" href="#/approvals" data-testid={`sys6-apply-${row.id}`}>去申请开通</a>
                        ) : null}
                        {rid ? <CopyRid id={rid} testid={`sys6-rid-${row.id}`} /> : null}
                      </td>
                      <td
                        data-testid={`sys6-duration-${row.id}`}
                        title={row.durationReason ?? undefined}
                      >
                        {row.durationMs === null ? "—" : `${row.durationMs} ms`}
                      </td>
                      <td
                        data-testid={`sys6-asof-${row.id}`}
                        title={row.asOfReason ?? undefined}
                      >
                        {row.asOf ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="sys6-foot">
          采集时刻只取响应顶层 ISO 的 asOf；缺失或格式不符显示「—」，原因在悬停说明里，绝不用本机时钟补。
        </p>
      </CardContent>
    </Card>
  );
}