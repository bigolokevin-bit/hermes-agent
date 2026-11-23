/**
 * R94 — the view survives a hop to a related run/task.
 *
 * 关联资源链（apd6-link-run / apd6-link-task）会把人带离 /approvals；从导航
 * 回来时页面重新挂载，URL、打开项与滚动位都会丢。这里在离开前把「当前视图快
 * 照」（完整 search 串 + scrollY）存进 sessionStorage，挂载时一次性取回：
 * 同 tab、裸 URL（无其它筛选）才还原；筛选不同或 tab 不同=用户去了别的视图，
 * 快照作废（take 即删），绝不串页。内存里的续页游标不持久化——那是服务端
 * 分页状态，序列化回来会变成假数据（DONE 记录该裁决）。
 */
import { useLocation } from "react-router";

const KEY = "appr-corr-restore";

export interface CorrelationSnapshot {
  search: string;
  scrollY: number;
}

export function saveCorrelationReturn(search: string, scrollY: number): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ search, scrollY }));
  } catch {
    /* storage 不可用只影响返回还原，不影响数据与筛选 */
  }
}

/** 解析但不删除：两页可能同时挂载，先判断归属再由匹配方消费。 */
export function peekCorrelationReturn(): CorrelationSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.search !== "string") return null;
    const scrollY = typeof rec.scrollY === "number" && Number.isFinite(rec.scrollY) ? rec.scrollY : 0;
    return { search: rec.search, scrollY };
  } catch {
    return null;
  }
}

/** 匹配页消费：还原一次即删，防止回访重复改写 URL。 */
export function dropCorrelationReturn(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* 同上 */
  }
}

/** 原始串：测试断言快照内容用。 */
export function rawCorrelationReturn(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * AP-03 — 「离开前记快照」的单点把手。
 *
 * 抽屉里所有把人带离 /approvals 的关联链都走它：apd6 的运行/任务链（R94 首制）
 * 与新增的处理记录事件链（→ /audit?event=）。把手只有一处，快照词表就只有一份；
 * 每条链各自拼 search/scrollY 早晚分叉成两套返回行为。
 */
export function useLeaveWithSnapshot(): () => void {
  const location = useLocation();
  return () => saveCorrelationReturn(location.search, window.scrollY ?? 0);
}
