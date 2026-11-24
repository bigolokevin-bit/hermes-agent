// 四页共用的页头与卡脚小件。
//
// 页头只留两样东西：11/12px 副行 + 右端等宽读数（+ 一句灰字说明原生界面不可达）。
// 页内不再画第二套 H1 / 面包屑——外壳已经有全页唯一的 h1 与 tab 条。
import type { ReactNode } from "react";

export interface PaneHeadProps {
  /** 骨架副行，数字一律是真读数或缺读口「—」。 */
  sub: ReactNode;
  /** 右端等宽读数：读取时刻。 */
  readout: string;
  readoutTitle?: string;
}

export function PaneHead({ sub, readout, readoutTitle }: PaneHeadProps) {
  return (
    <header className="cap-head">
      <p className="cap-sub">{sub}</p>
      <span className="cap-head-right">
        <span
          className="cap-native"
          title="原生界面在 9119 端口，本环境未监听；这里只标出处，不提供跳转。"
        >
          打开原生界面 ↗
        </span>
        <span className="cap-readout" title={readoutTitle ?? "本次读取时刻（北京时间）"}>
          {readout}
        </span>
      </span>
    </header>
  );
}

/** 卡脚：一行说明 + 右端一个等宽小读数。 */
export function CardFoot({ note, right }: { note: ReactNode; right?: ReactNode }) {
  return (
    <div className="cap-foot">
      <span className="cap-foot-note">{note}</span>
      {right === undefined ? null : <span className="cap-foot-right">{right}</span>}
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