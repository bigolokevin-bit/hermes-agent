import type { ReactNode } from "react";

import "./ui.css";

/**
 * 表格基元：补齐 @nous-research/ui 缺失的 Table（该包无 Table 导出，故 32 页各写一套）。
 * 用法：<UiTable caption="会话清单" rows={rows}
 *        columns={[{ key: "name", label: "名称", width: "40%" },
 *                  { key: "msgs", label: "条数", numeric: true }]}
 *        sticky striped={false} rowHeight="regular" empty={<StateBlock tone="empty" …/>} />
 * 规矩：行高只走 --table-row-h-ls(40) / --table-row-h-compact-ls(36，仅嵌入子表)；
 * 数字列必须 numeric:true（等宽 + 右对齐）；斑马纹默认关，开了要在理由里写清；
 * 375 档横向溢出必须由外层 .ui-scroll-shell 承担（容器内滚动，禁整页横滚）。
 */
export interface UiTableColumn<T> {
  key: keyof T & string;
  label: string;
  /** 列宽必须写成百分比字符串（如 "40%"），禁裸 px。 */
  width?: `${number}%`;
  numeric?: boolean;
  render?: (row: T, index: number) => ReactNode;
}

export interface UiTableProps<T> {
  columns: UiTableColumn<T>[];
  rows: T[];
  caption?: string;
  sticky?: boolean;
  striped?: boolean;
  rowHeight?: "regular" | "compact";
  empty?: ReactNode;
  testId?: string;
}

export function UiTable<T>({
  columns,
  rows,
  caption,
  sticky = false,
  striped = false,
  rowHeight = "regular",
  empty,
  testId = "ui-table",
}: UiTableProps<T>): ReactNode {
  const cls = [
    "ui-table",
    rowHeight === "compact" ? "is-compact" : undefined,
    sticky ? "is-sticky" : undefined,
    striped ? "is-striped" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="ui-scroll-shell" data-testid={`${testId}-scroll`}>
      <table className={cls} data-testid={testId}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((col) => (
              <th data-col={col.key} key={col.key} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr data-row={index} key={index}>
              {columns.map((col) => (
                <td
                  className={col.numeric ? "is-numeric" : undefined}
                  data-cell={`${col.key}`}
                  key={col.key}
                >
                  {col.render
                    ? col.render(row, index)
                    : ((row as Record<string, ReactNode>)[col.key] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? empty ?? null : null}
    </div>
  );
}
