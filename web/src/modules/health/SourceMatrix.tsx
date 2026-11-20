import { Fragment, useEffect, useState } from "react";
import { Card, CardContent } from "@nous-research/ui";
import { redactError } from "./systemHealth";
import { COPY_SCOPE_TEXT, withCopyScope } from "./copyScope";
import {
  SOURCE_STATUS_LABEL as STATUS_LABEL,
  SYS6_GAP,
  toggleSourceMatrix,
  useSourceMatrix,
} from "./sourceReads";
import { csvRows, downloadCsv, exportFilename, toCsv, toMatrixText, toPlainText } from "./sourceMatrixCsv";
import {
  ariaSourceSort,
  nextSourceSort,
  readSourceSort,
  sortSourceRows,
  writeSourceSort,
  type SourceSortKey,
  type SourceSortState,
} from "./sourceSort";
import { matchesServiceSearch, readServiceQuery, writeServiceQuery } from "./serviceSearch";

const ASOF_CRITERION = "判据：只取 payload 顶层 ISO，缺失或非 ISO 显示「—」，不使用本机时钟";

function asOfTitle(row: { asOf: string | null; asOfIso: string | null; asOfSource?: string | null; asOfReason: string | null; asOfTitle?: string | null }): string {
  if (row.asOfTitle) return `${row.asOfTitle} · ${ASOF_CRITERION}`;
  if (!row.asOfIso) return `${row.asOfReason ?? "采集时刻未知"}；${ASOF_CRITERION}`;
  return `UTC 原文：${row.asOfIso} · 北京时间：${row.asOf ?? "—"}${row.asOfSource ? ` · 来源：${row.asOfSource}` : ""} · ${ASOF_CRITERION}`;
}

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

const SORT_LABEL: Record<Exclude<SourceSortKey, "name">, string> = {
  state: "本次状态",
  ms: "响应耗时",
  asof: "采集时刻",
};

function SortButton({ sort, sortKey, onSort }: { sort: SourceSortState; sortKey: Exclude<SourceSortKey, "name">; onSort: (key: Exclude<SourceSortKey, "name">) => void }) {
  const active = sort.key === sortKey;
  const indicator = active ? (sort.dir === "asc" ? "↑" : "↓") : "↕";
  return (
    <button
      type="button"
      className="sys13-sort"
      data-testid={`sys13-sort-${sortKey}`}
      aria-label={`按${SORT_LABEL[sortKey]}排序；当前${active ? (sort.dir === "asc" ? "升序" : "降序") : "未排序"}`}
      onClick={() => onSort(sortKey)}
    >
      {SORT_LABEL[sortKey]}
      <span className="sys13-indicator" aria-hidden="true">{indicator}</span>
    </button>
  );
}

export function SourceMatrix() {
  const { rows, expanded } = useSourceMatrix();
  const [sort, setSort] = useState<SourceSortState>(() => readSourceSort(window.location.search, window.location.hash));
  const [q, setQ] = useState(() => readServiceQuery(window.location.search, window.location.hash));
  const [openRow, setOpenRow] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      setSort(readSourceSort(window.location.search, window.location.hash));
      setQ(readServiceQuery(window.location.search, window.location.hash));
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  const searchedRows = q
    ? rows.filter((row) => matchesServiceSearch(row.label, row.id, row.path, q))
    : rows;
  const sortedRows = sortSourceRows(searchedRows, sort);
  const onSort = (key: Exclude<SourceSortKey, "name">) => {
    const next = nextSourceSort(sort, key);
    setSort(next);
    writeSourceSort(next);
  };
  const counts = searchedRows.reduce<Record<string, number>>((out, row) => {
    out[row.status] = (out[row.status] ?? 0) + 1;
    return out;
  }, {});
  const summary = [
    q ? `搜索命中 ${searchedRows.length} / ${rows.length} 个读口` : `${searchedRows.length} 个读口`,
    `成功 ${counts.ok ?? 0}`,
    `失败 ${counts.failed ?? 0}`,
    `读口未接入 ${counts.unwired ?? 0}`,
  ].join(" · ");

  const exportRows = csvRows(sortedRows);
  const usableRows = searchedRows.filter((row) => row.status === "ok" || row.status === "degraded");
  const matrixBlocked = usableRows.length === 0;
  const exportDisabled = exportRows.length === 0 || matrixBlocked;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  // One state object so the wording and the row count land in the same render —
  // a screen reader then announces the pair once, not twice.
  const [matrixCopy, setMatrixCopy] = useState<{ state: "idle" | "copied" | "failed"; rows: number }>({
    state: "idle",
    rows: 0,
  });
  const copyText = toPlainText(sortedRows);
  const matrixText = toMatrixText(sortedRows);
  const copyDisabled = searchedRows.length === 0 || matrixBlocked;
  const matrixBlockTitle = matrixBlocked
    ? "当前没有可导出/复制的可用读口行：读口未接入或读取失败。"
    : null;

  async function copyMatrix() {
    if (copyDisabled) return;
    if (!navigator.clipboard?.writeText) {
      setCopyState("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  async function copyMatrixTable() {
    if (copyDisabled) return;
    if (!navigator.clipboard?.writeText) {
      setMatrixCopy({ state: "failed", rows: 0 });
      return;
    }
    try {
      await navigator.clipboard.writeText(matrixText);
      setMatrixCopy({ state: "copied", rows: sortedRows.length });
    } catch {
      setMatrixCopy({ state: "failed", rows: 0 });
    }
  }

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
            title={exportDisabled ? matrixBlockTitle ?? "当前没有可导出的读口行" : "导出当前矩阵；不会再发请求"}
            onClick={() => { downloadCsv(exportFilename(), toCsv(exportRows)); }}
          >
            导出 CSV
          </button>
          <button
            type="button"
            className="sys7-export sys10-copy"
            data-testid="sys10-copy"
            disabled={copyDisabled}
            title={withCopyScope(copyDisabled ? matrixBlockTitle ?? "当前没有可复制的读口行" : "复制当前矩阵为纯文本；不会再发请求")}
            onClick={() => { void copyMatrix(); }}
          >
            复制矩阵
          </button>
          <span className="sys10-status" data-testid="sys10-copy-status" aria-live="polite">
            {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败，已展开手动复制" : ""}
          </span>
          <button
            type="button"
            className="sys7-export"
            data-testid="sys-matrix-copy"
            disabled={copyDisabled}
            title={withCopyScope(copyDisabled ? matrixBlockTitle ?? "当前没有可复制的读口行" : "复制当前矩阵表格为制表符分隔文本；不会再发请求")}
            onClick={() => { void copyMatrixTable(); }}
          >
            复制本表
          </button>
          <span className="sys10-status" data-testid="sys-matrix-copy-status" role="status" aria-live="polite">
            {matrixCopy.state === "copied" ? `已复制 ${matrixCopy.rows} 行` : matrixCopy.state === "failed" ? "复制失败，可手动选择文本" : ""}
          </span>
          <span className="sys7-count" data-testid="sys7-export-count">{exportDisabled ? "—" : `${exportRows.length} 行`}</span>
          <span className="sys7-note">导出与屏上矩阵同源：姓名、路径、人话状态、耗时、响应顶层 ISO 采集时刻；缺失留空，不补 0，也不用本机时钟。</span>
        </div>
        <p className="sys7-note sys-copy-scope" data-testid="sys-copy-scope">{COPY_SCOPE_TEXT}</p>
        {copyState === "failed" ? (
          <textarea
            className="sys10-fallback"
            data-testid="sys10-fallback"
            aria-label="手动复制矩阵文本"
            readOnly
            rows={Math.min(8, searchedRows.length + 2)}
            value={copyText}
          />
        ) : null}
        {matrixCopy.state === "failed" ? (
          <textarea
            className="sys10-fallback"
            data-testid="sys-matrix-copy-fallback"
            aria-label="手动复制矩阵表格文本"
            readOnly
            rows={Math.min(8, sortedRows.length + 2)}
            value={matrixText}
          />
        ) : null}
        <p className="sys13-sort-note" data-testid="sys13-sort-note" hidden={!expanded}>
          点「本次状态 / 响应耗时 / 采集时刻」可排序；排序只改屏上与复制文本的行序，不会重新取数。默认按口径名升序，缺失值排在最后。
        </p>
        {q && searchedRows.length === 0 ? (
          <div className="sys-search-empty" data-testid="sys-search-source-empty" hidden={!expanded}>
            <p>当前搜索下没有匹配的读口</p>
            <button type="button" className="sys-search-clear" data-testid="sys-search-clear" onClick={() => { setQ(""); writeServiceQuery(null); }}>
              清空搜索
            </button>
          </div>
        ) : null}
        <div className="sys6-scroll" data-testid="sys6-scroll" hidden={!expanded || (q !== "" && searchedRows.length === 0)}>
            <table className="sys6-table" data-testid="sys6-table">
              <thead>
                <tr>
                  <th data-testid="sys13-head-name" aria-sort={ariaSourceSort(sort, "name")} title="默认按口径名升序；缺失值排在最后">口径名</th>
                  <th title="本次实际发出的请求路径">实际请求路径</th>
                  <th data-testid="sys13-head-state" aria-sort={ariaSourceSort(sort, "state")} title="按状态分组排序；缺失值排在最后">
                    <SortButton sort={sort} sortKey="state" onSort={onSort} />
                  </th>
                  <th data-testid="sys13-head-ms" aria-sort={ariaSourceSort(sort, "ms")} title="按本次耗时数值排序；缺失值排在最后">
                    <SortButton sort={sort} sortKey="ms" onSort={onSort} />
                  </th>
                  <th
                    data-testid="sys13-head-asof"
                    aria-sort={ariaSourceSort(sort, "asof")}
                    title="按 payload 顶层 ISO 原值排序；缺失或非 ISO 排在最后"
                  >
                    <SortButton sort={sort} sortKey="asof" onSort={onSort} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const rid = row.status === "failed" ? row.requestId : null;
                  const detail = row.statusDetail ? redactError(row.statusDetail) : null;
                  const statusTitle = row.status === "unwired"
                    ? SYS6_GAP
                    : [row.statusReason, detail?.text, detail?.count ? `已脱敏 ${detail.count} 处` : null]
                      .filter(Boolean)
                      .join(" · ") || undefined;
                  const open = openRow === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr data-testid={`sys6-row-${row.id}`} data-status={row.status}>
                        <td>
                          <span className="sys15-trunc" data-testid={`sys6-name-${row.id}`} data-sys15="trunc" title={row.label}>
                            {row.label}
                          </span>
                          {row.href ? (
                            <a
                              className="sys9-src-link"
                              href={row.href}
                              data-testid={`sys9-src-link-${row.id}`}
                            >
                              打开对应页面
                            </a>
                          ) : (
                            <span
                              className="sys9-src-nolink"
                              data-testid={`sys9-src-nolink-${row.id}`}
                              title="这个探针只在本页内运行，没有独立页面可跳转；不造死链。"
                            >
                              该读口无对应页面
                            </span>
                          )}
                          <button
                            type="button"
                            className="sys15-row-toggle"
                            data-testid={`sys15-row-toggle-${row.id}`}
                            aria-expanded={open}
                            onClick={() => setOpenRow(open ? null : row.id)}
                          >
                            {open ? "收起" : "全文"}
                          </button>
                        </td>
                        <td data-testid={`sys6-path-${row.id}`} title={row.path}>
                          <span className="sys15-trunc" data-testid={`sys15-trunc-path-${row.id}`} data-sys15="trunc">{row.path}</span>
                        </td>
                        <td data-testid={`sys6-status-${row.id}`} title={statusTitle}>
                          <span className="sys6-status sys15-trunc" data-testid={`sys15-trunc-status-${row.id}`}>{STATUS_LABEL[row.status]}</span>
                          {row.statusReason ? (
                            <span className="sys6-reason sys15-trunc" data-testid={`sys15-trunc-reason-${row.id}`}>{row.statusReason}</span>
                          ) : null}
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
                          title={asOfTitle(row)}
                        >
                          <span data-testid={`sys8-asof-${row.id}`} title={asOfTitle(row)}>{row.asOf ?? "—"}</span>
                        </td>
                      </tr>
                      {open ? (
                        <tr data-testid={`sys15-detail-${row.id}`} className="sys15-detail-row">
                          <td colSpan={5}>
                            <dl className="sys4-grid sys15-matrix-detail">
                              <div className="sys4-field">
                                <dt>口径名</dt>
                                <dd className="sys15-full" data-testid={`sys15-full-name-${row.id}`}>{row.label}</dd>
                              </div>
                              <div className="sys4-field">
                                <dt>实际请求路径</dt>
                                <dd className="sys15-full" data-testid={`sys15-full-path-${row.id}`}>{row.path}</dd>
                              </div>
                              <div className="sys4-field sys4-wide">
                                <dt>状态与原因</dt>
                                <dd className="sys15-full" data-testid={`sys15-full-status-${row.id}`}>
                                  {STATUS_LABEL[row.status]}
                                  {row.statusReason ? ` · ${row.statusReason}` : ""}
                                  {detail ? ` · ${detail.text}` : ""}
                                  {detail && detail.count > 0 ? (
                                    <span className="sys4-redacted" data-testid={`sys15-redacted-${row.id}`}>已脱敏 {detail.count} 处</span>
                                  ) : null}
                                  {detail?.truncated ? <span className="sys4-redacted">摘要已截断</span> : null}
                                </dd>
                              </div>
                              <div className="sys4-field">
                                <dt>采集时刻</dt>
                                <dd className="sys15-full" data-testid={`sys15-full-asof-${row.id}`}>{row.asOf ?? "—"}</dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
        <p className="sys8-same-source-note" data-testid="gov-asof-note">
          采集时刻只取接口响应顶层时间（asOf / collectedAt / generatedAt 及其下划线写法）；缺失或非法显示「—」，不用本机时间顶替。
        </p>
        <p className="sys8-same-source-note" data-testid="sys8-same-source-note">
          「最近检查时刻」与「采集时刻」：健康清单行和矩阵第一行同源，都取 <code>/api/health</code> 响应顶层 asOf（同一 ISO 值，同一北京时间到分呈现）；其余三行是各自探针响应的顶层 asOf，不与健康清单互相代替。
        </p>
        <p className="sys6-foot">
          采集时刻只取响应顶层 ISO 的 asOf；缺失或格式不符显示「—」，原因在悬停说明里，绝不用本机时钟补。
        </p>
      </CardContent>
    </Card>
  );
}