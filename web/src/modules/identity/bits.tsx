/**
 * 三屏共用的小件：页头副行、卡脚缺读口、表内「没有一行真读数」整行、空值破折号。
 *
 * 形制取自骨架 console-v4-skeleton.html `section[data-mod="identity"]`：页头只有
 * 一行副行 + 右端动作；卡头是 11px 微标签 + 右侧 11px 链接；卡底一行 11px 说明。
 * 页内不画第二个 h1、不画 tab 条（外壳已有）。
 */
import type { ReactNode } from "react";

export interface IdentityHeadProps {
  /** 副行：一段真读数，或一段说清缺口的说明；不写 0 占位。 */
  sub: ReactNode;
  /** 右端页面动作（骨架 data-acts）。 */
  acts?: ReactNode;
  testId?: string;
}

export function IdentityHead({ sub, acts, testId }: IdentityHeadProps) {
  return (
    <header className="id-head">
      <p className="id-sub" data-testid={testId}>
        {sub}
      </p>
      {acts ? (
        <div className="id-acts" role="group" aria-label="页面动作">
          {acts}
        </div>
      ) : null}
    </header>
  );
}

/** 卡底一行：缺读口 / 口径说明（11px，不加第二层边框）。 */
export function CardFoot({ note, right }: { note: ReactNode; right?: ReactNode }) {
  return (
    <div className="id-foot">
      <span className="id-foot__note">{note}</span>
      {right === undefined ? null : <span className="id-foot__right">{right}</span>}
    </div>
  );
}

/** 表体整行：一行真读数都没有时，用这一行说清为什么没有。 */
export function GapRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr className="id-gap-row">
      <td colSpan={colSpan}>
        <span className="id-gap-cell">{children}</span>
      </td>
    </tr>
  );
}

/** 卡内一句说明（没有表格的卡用它承载缺口）。 */
export function GapNote({ children }: { children: ReactNode }) {
  return <p className="id-gap-note">{children}</p>;
}

/** 读不到的字段：屏上一律这个破折号，不加任何数字。 */
export const DASH = "—";

/** 骨架动作按钮的禁用形制：规划中，后端写接口未就绪。 */
export function PlannedButton({
  children,
  primary,
  testId,
}: {
  children: ReactNode;
  primary?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={`id-btn${primary ? " id-btn--pri" : ""}`}
      aria-disabled="true"
      disabled
      data-planned="规划中：后端写接口未就绪"
      title="规划中：后端写接口未就绪，本轮不产生写入"
      data-testid={testId}
    >
      {children}
    </button>
  );
}