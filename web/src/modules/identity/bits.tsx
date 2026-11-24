/**
 * 三屏共用的小件：页头副行、卡壳（走 ConsoleCard 基元）、身份绑定条、口径 kv、
 * 空值破折号。
 *
 * 形制取自骨架 console-v4-skeleton.html `section[data-mod="identity"]`：页头只有
 * 一行副行 + 右端动作；卡头是 11px h2 微标签 + 右侧 11px 计数；卡底走基元的
 * `note` 口径行与 `availability` 可用性清单。页内不画第二个 h1、不画 tab 条（外壳已有）。
 */
import { Fragment, type ReactNode } from "react";

import { ConsoleCard } from "@/components/console/ConsoleCard";

export interface IdentityHeadProps {
  /** 副行：一段真读数，或一段说清本轮读数面的说明；不写 0 占位。 */
  sub: ReactNode;
  /** 右端页面动作（骨架 data-acts）。 */
  acts?: ReactNode;
  testId?: string;
  /** 排障口径（租户标识等）：只进 title，不上屏。 */
  title?: string;
}

export function IdentityHead({ sub, acts, testId, title }: IdentityHeadProps) {
  return (
    <header className="id-head" title={title}>
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

/**
 * 卡壳基元：卡头 = 11px h2 微标签 + 右端计数，卡底 = 口径行 + 可用性清单。
 * 缺读口一律走 `availability`，页面正文不再写「缺读口 / 未接入」。
 */
export function IdCard({
  title,
  count,
  testId,
  flush,
  note,
  availability,
  titleAttr,
  children,
}: {
  title: string;
  count?: ReactNode;
  testId: string;
  flush?: boolean;
  note?: ReactNode;
  availability?: { label: string; reason?: string }[];
  titleAttr?: string;
  children?: ReactNode;
}) {
  return (
    <ConsoleCard
      label={<h2 className="id-card-title">{title}</h2>}
      action={count === undefined ? undefined : <span className="id-count">{count}</span>}
      flush={flush}
      note={note}
      availability={availability}
      title={titleAttr}
      data-testid={testId}
    >
      {children}
    </ConsoleCard>
  );
}

/** 身份绑定条（骨架 .bindbar）：一行真读数 + 右端去处。 */
export function BindBar({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="id-bindbar" data-testid={testId}>
      {children}
    </div>
  );
}

/** kv 口径行（走基元 .console-kv）：dt/dd 直接进网格，不套层。 */
export function KvList({ rows, testId }: { rows: { k: string; v: ReactNode }[]; testId?: string }) {
  return (
    <dl className="console-kv" data-testid={testId}>
      {rows.map((row) => (
        <Fragment key={row.k}>
          <dt>{row.k}</dt>
          <dd>{row.v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** 卡底一行：口径说明 + 右端小读数（基元不支持右端时的补充件）。 */
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

/**
 * 表内单行声明：整行跨列、左对齐 11px，只陈述本轮读数面。
 * 纯无读口的表用它替代逐行空值，不做居中灰字空态。
 */
export function DeclRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr className="id-decl-row">
      <td colSpan={colSpan}>{children}</td>
    </tr>
  );
}

/** 卡内一句说明（没有表格的卡用它承载口径）。 */
export function GapNote({ children }: { children: ReactNode }) {
  return <p className="id-gap-note">{children}</p>;
}

/** 读不到的单个字段值：屏上就是这个破折号，不加任何数字。 */
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
