// 四页共用的页头与卡脚小件。
//
// 页头只留两样东西：11/12px 副行 + 右端等宽读数。页内不再画第二套 H1 / 面包屑
// ——外壳已经有全页唯一的 h1 与 tab 条。九一一九端口在本环境不监听，所以
// 「打开原生界面 ↗」默认不渲染（一个点不动的假按钮比不画更糟）：需要时才开。
import type { ReactNode } from "react";

export interface PaneHeadProps {
  /** 骨架副行，数字一律是真读数或缺读口「—」。 */
  sub: ReactNode;
  /** 右端等宽读数：读取时刻。 */
  readout: string;
  readoutTitle?: string;
  /** 是否画「打开原生界面 ↗」。原生界面不可达时保持 false，不摆假入口。 */
  showNative?: boolean;
}

export function PaneHead({ sub, readout, readoutTitle, showNative = true }: PaneHeadProps) {
  return (
    <header className="cap-head">
      <p className="cap-sub">{sub}</p>
      <span className="cap-head-right">
        {showNative ? (
          <span
            className="cap-native"
            title="原生界面在 9119 端口，本环境未监听；这里只标出处，不提供跳转。"
          >
            打开原生界面 ↗
          </span>
        ) : null}
        <span className="cap-readout" title={readoutTitle ?? "本次读取时刻（北京时间）"}>
          {readout}
        </span>
      </span>
    </header>
  );
}

/**
 * ConsoleCard 的 label 槽用：h2 承载卡标题（模块内标题层级不再是平的），
 * 形制沿用 .console-card__label 的 11px 等宽大写微标签（2026-11-24 与身份页同一形制）。
 */
export function CardTitle({ title }: { title: ReactNode }) {
  return <h2 className="console-card__label cap-card-title">{title}</h2>;
}

/**
 * 卡头：左边 h2 微标签（11px 等宽大写，沿用 console-card__label 的形制），
 * 右边一枚小链接/小读数。标题用 h2 而不是 div，模块内标题层级才不是平的。
 */
export function CardHead({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="console-card__head">
      <h2 className="console-card__label cap-card-title">{title}</h2>
      {action === undefined || action === null ? null : (
        <span className="console-card__action">{action}</span>
      )}
    </div>
  );
}

/** 卡脚：一行说明 + 右端一个等宽小读数。 */
export function CardFoot({ note, right }: { note: ReactNode; right?: ReactNode }) {
  return (
    <div className="cap-foot">
      <span className="cap-foot-note">{note}</span>
      {right === undefined || right === null ? null : <span className="cap-foot-right">{right}</span>}
    </div>
  );
}

/** 缺读口整行：表格里没有一行真读数时，用一行说清为什么没有。 */
export function GapRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr className="cap-gap-row">
      <td colSpan={colSpan}>
        <span className="cap-gap-cell">{children}</span>
      </td>
    </tr>
  );
}

/** 卡内一句结论（无表格的卡用它承载缺读口说明）。 */
export function GapNote({ children }: { children: ReactNode }) {
  return <p className="cap-gap-note">{children}</p>;
}