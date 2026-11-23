/**
 * w189 样板 A — AgentFleetRail 舰队轨（UI-DIRECTION v2 §4 舰队轨/三层/交互、§6②③、§7 H1·H3·I4）。
 *
 * 卡面三层里第③层（能力标签/部门）：能力标签列不在花名册端点，department 实测多为
 * 空值（现网 3 条中 2 条 null），整层省略（禁编造、禁空壳）；缺口口径由卡外折叠区
 * 说明行承接（DutyPage duty-fleet-l3-note，DU-03①，措辞以真响应为准）；
 * 「今日处理/成功率」缺逐人日聚合来源，按 §6④ 与 §8「缺来源先走未知态」显示破折号，
 * 且不画进度条（I4：未知成功率 ⇒ [role=progressbar] 数量 = 0）。原始 employee_id
 * 全值保留在卡 title 属性里可取回，屏上文本绝不裸 id（承 duty 短码判定）。
 *
 * 轮播几何（步进 = 卡宽 + gap）在浏览器里实测；这里的五种「不动」情形与重新计时
 * 全部走命令式 ref（事件里即时生效、不依赖重渲染），时钟只在条件齐备时挂起。
 */
import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import { employeeLabel, lifecycleLabel } from "./format";
import type { EmployeeRow, Loadable } from "./types";

const FLEET_INTERVAL_MS = 6000;
const FLEET_GAP = 8;

/**
 * DU-07③：卡面两个缺数「—」的原因句（单一事实源）。
 * 卡面 title 用它们，卡外折叠区（DutyPage duty-fleet-metric-note）也逐字用它们——
 * 这样「title 原文有可点开的等价出口」不是近似，而是同串。
 */
export const FLEET_METRIC_REASONS = {
  today: "今日处理还没有可用的逐人数据；接入后会自动显示。",
  successRate: "成功率要等逐人日聚合接入；零分母或未齐时不显示，也不画进度条。",
} as const;

/** prefers-reduced-motion 查询串；命中时关自动滚动与过渡，保留手动滚动（v2 §4 交互）。 */
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function readReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

export function AgentFleetRail({ employees }: { employees: Loadable<EmployeeRow[]> }): JSX.Element | null {
  // 加载中 / 读失败 / 空花名册：整轨不渲染（骨架与错误形制由值班台外层统一给）。
  if (employees.k !== "ready" || employees.data.length === 0) return null;
  return <FleetRail rows={employees.data} />;
}

function FleetRail({ rows }: { rows: EmployeeRow[] }): JSX.Element {
  const railRef = useRef<HTMLDivElement | null>(null);
  const vpRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const condRef = useRef({
    overflow: false,
    many: rows.length > 2,
    paused: false,
    reduced: readReducedMotion(),
    hover: false,
    focus: false,
    drag: false,
  });

  const [overflow, setOverflow] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(condRef.current.reduced);

  const step = useCallback((): number => {
    const card = railRef.current?.querySelector("[data-fleet-card]") as HTMLElement | null;
    if (!card) return 328;
    return card.getBoundingClientRect().width + FLEET_GAP;
  }, []);

  const scrollToLeft = useCallback((left: number) => {
    const vp = vpRef.current;
    if (!vp) return;
    const behavior: ScrollBehavior = condRef.current.reduced ? "auto" : "smooth";
    if (typeof vp.scrollTo === "function") vp.scrollTo({ left, behavior });
    else vp.scrollLeft = left;
  }, []);

  const scrollClamped = useCallback(
    (target: number) => {
      const vp = vpRef.current;
      if (!vp) return;
      const max = Math.max(0, vp.scrollWidth - vp.clientWidth);
      scrollToLeft(Math.min(Math.max(0, target), max));
    },
    [scrollToLeft],
  );

  const tick = useCallback(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const max = Math.max(0, vp.scrollWidth - vp.clientWidth);
    if (max <= 0) return;
    const cur = vp.scrollLeft;
    // 到末回首：下一张从 0 开始；否则前进一张，末步钳在最大滚动位。
    if (cur >= max) {
      scrollToLeft(0);
      return;
    }
    scrollToLeft(Math.min(cur + step(), max));
  }, [scrollToLeft, step]);

  const restartTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const c = condRef.current;
    if (!c.overflow || !c.many || c.paused || c.reduced || c.hover || c.focus || c.drag) return;
    timerRef.current = window.setInterval(tick, FLEET_INTERVAL_MS);
  }, [tick]);

  // 溢出测量：挂载测一次，窗口尺寸变化再测；overflow 驱动轮播与箭头/暂停钮的显隐。
  useEffect(() => {
    const measure = () => {
      const vp = vpRef.current;
      if (!vp) return;
      setOverflow(vp.scrollWidth > vp.clientWidth + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rows.length]);

  // hover / 焦点 / 拖动用原生监听：事件里即时改闸并重新计时，不依赖 React 合成事件映射。
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const gate = (key: "hover" | "focus" | "drag", value: boolean) => {
      if (condRef.current[key] === value) return;
      condRef.current[key] = value;
      restartTimer();
    };
    const onOver = (e: Event) => {
      if (el.contains(e.target as Node)) gate("hover", true);
    };
    const onOut = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (!related || !el.contains(related)) gate("hover", false);
    };
    const onFocusIn = () => gate("focus", true);
    const onFocusOut = () => gate("focus", false);
    const onDown = () => gate("drag", true);
    const onUp = () => gate("drag", false);
    el.addEventListener("pointerover", onOver);
    el.addEventListener("pointerout", onOut);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerover", onOver);
      el.removeEventListener("pointerout", onOut);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [restartTimer]);

  // 减弱动效：系统开关中途变化也要跟上（浏览器真值；测试里挂载时读）。
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(REDUCE_QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // 闸状态进 ref、时钟重建：任何一个条件翻转都重新计时（v2 §4「恢复后重新计时」）。
  useEffect(() => {
    condRef.current.overflow = overflow;
    condRef.current.paused = paused;
    condRef.current.reduced = reduced;
    condRef.current.many = rows.length > 2;
    restartTimer();
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [overflow, paused, reduced, rows.length, restartTimer]);

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollClamped((vpRef.current?.scrollLeft ?? 0) + step());
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollClamped((vpRef.current?.scrollLeft ?? 0) - step());
    }
  };

  // 前后箭头：溢出且 ≥8 张才显示（v2 §4：溢出且 ≥8 张才显示前后箭头）。
  const showArrows = overflow && rows.length >= 8;
  // 暂停按钮：溢出且允许自动滚动时显示，中文「暂停／继续轮播」。
  const showPause = overflow && !reduced;

  return (
    <div className="duty-fleet" data-testid="duty-fleet-rail" ref={railRef}>
      <div className="duty-fleet-stage">
        {showArrows ? (
          <button
            type="button"
            className="duty-fleet-arrow"
            data-testid="duty-fleet-prev"
            aria-label="往前一张"
            onClick={() => scrollClamped((vpRef.current?.scrollLeft ?? 0) - step())}
          >
            ‹
          </button>
        ) : null}
        <div
          className="duty-fleet-viewport"
          data-fleet-viewport=""
          ref={vpRef}
          role="group"
          aria-label="数字员工舰队（横向滑动）"
          tabIndex={0}
          onKeyDown={onKey}
        >
          {rows.map((row, i) => (
            <FleetCard key={row.employeeId || String(i)} row={row} />
          ))}
        </div>
        {showArrows ? (
          <button
            type="button"
            className="duty-fleet-arrow"
            data-testid="duty-fleet-next"
            aria-label="往后一张"
            onClick={() => scrollClamped((vpRef.current?.scrollLeft ?? 0) + step())}
          >
            ›
          </button>
        ) : null}
      </div>
      {showPause ? (
        <button
          type="button"
          className="duty-fleet-pause"
          data-testid="duty-fleet-pause"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "继续轮播" : "暂停轮播"}
        </button>
      ) : null}
    </div>
  );
}

function FleetCard({ row }: { row: EmployeeRow }): JSX.Element {
  const label = employeeLabel(row.name, row.employeeId);
  const roleText = row.title?.trim() || "—";
  const stateText = lifecycleLabel(row.lifecycleState);
  const state = row.lifecycleState ?? "unknown";
  const dotClass =
    state === "active" || state === "onboarding"
      ? "duty-fleet-dot is-on"
      : state === "paused" || state === "offboarding"
        ? "duty-fleet-dot is-paused"
        : "duty-fleet-dot is-unknown";
  return (
    <article
      className="duty-fleet-card"
      data-fleet-card=""
      data-fleet-state={state}
      data-employee-id={row.employeeId}
      title={`${label}｜${row.employeeId}`}
    >
      <div className="duty-fleet-l1">
        <span className="duty-fleet-avatar" aria-hidden="true">
          {label.slice(0, 1)}
        </span>
        <span className="duty-fleet-name" title={label}>
          {label}
        </span>
        <span className="duty-fleet-role" title={roleText}>
          {roleText}
        </span>
        <span className={dotClass} aria-hidden="true" />
        <span className="duty-fleet-state">{stateText}</span>
      </div>
      <div className="duty-fleet-l2">
        <span className="duty-fleet-metric-label">今日处理</span>
        <span className="duty-fleet-metric" title={FLEET_METRIC_REASONS.today}>
          <span data-metric-value="">—</span>
          <span className="duty-fleet-metric-unit">次</span>
        </span>
        <span className="duty-fleet-metric-label">成功率</span>
        <span className="duty-fleet-metric" title={FLEET_METRIC_REASONS.successRate}>
          <span data-metric-value="">—</span>
          <span className="duty-fleet-metric-unit">%</span>
        </span>
      </div>
    </article>
  );
}
