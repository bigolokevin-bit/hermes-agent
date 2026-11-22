/**
 * 401 风暴守卫（L0 点单 2026-11-22：`#/sessions` 与 `#/capabilities?tab=channels`
 * 两路 375 真 NOT_MEASURED，实测 15s 窗口内 401×1308、framenavigated×2488 ≈ 无限
 * 跳登录环 + 请求风暴）。环跨整页导航，内存里的闩在每次 assign 后都会清零——
 * 「只跳一次」必须落在 sessionStorage，拿到 2xx 证明才清除。三道闸：
 *  ① login_redirect：401 登录信封的整页 assign 一个页签世代内最多一次；
 *  ② backoff：同一 target 连续第二次 401 起指数冷却（2s 起、30s 封顶），冷却期内
 *     该 target 的请求不碰网络，直接以 401 结构错误返回给调用方的错误态；
 *     首击后的那一次重试永远放行——「2xx 证明会话活着」的路径不能被闸死；
 *  ③ dedup：同一 resolved target 的并发 GET 共享一次网络请求。
 * 全部纯本地状态，零现网依赖；`__resetAuthStormGuardForTests` 供测试隔离。
 */

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const LOGIN_REDIRECT_STORAGE_KEY = "hermes.loginRedirectAttempted";

function guardSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * ① 跳转闩：返回 true = 这是本世代第一次（调用方可以 assign）；
 * false = 已经跳过一次，调用方必须改走结构化错误，绝不再导航。
 */
export function attemptLoginRedirectOnce(
  storage: StorageLike | null = guardSessionStorage(),
): boolean {
  try {
    if (storage?.getItem(LOGIN_REDIRECT_STORAGE_KEY) === "1") return false;
    storage?.setItem(LOGIN_REDIRECT_STORAGE_KEY, "1");
    return true;
  } catch {
    // 隐私模式/存储被禁：宁可少跳一次，也不给环放行。
    return false;
  }
}

/** 任何一次 2xx 都是「会话活着」的证明，闩与冷却同时放行下一个真过期世代。 */
export function clearLoginRedirectAttempt(
  storage: StorageLike | null = guardSessionStorage(),
): void {
  try {
    storage?.removeItem(LOGIN_REDIRECT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** ② 指数退避：per-target 连续 401 计数。1s、2s、4s…封顶 30s。 */
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30_000;

const backoffUntil = new Map<string, number>();
const backoffFails = new Map<string, number>();

export function registerAuthFailure(target: string, now: number = Date.now()): void {
  const fails = (backoffFails.get(target) ?? 0) + 1;
  backoffFails.set(target, fails);
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** (fails - 1), BACKOFF_CAP_MS);
  backoffUntil.set(target, now + delay);
}

export function authBackoffRemaining(target: string, now: number = Date.now()): number {
  // 首击不吃闸：第一次 401 之后的重试是页面正当的「再证明一次」（2xx 即关闭
  // 过期集），必须放行到网络。只有连续第二次 401 起才认定风暴，指数冷却。
  if ((backoffFails.get(target) ?? 0) < 2) return 0;
  const until = backoffUntil.get(target);
  if (until === undefined) return 0;
  return Math.max(0, until - now);
}

export function clearAuthBackoff(target: string): void {
  backoffFails.delete(target);
  backoffUntil.delete(target);
}

/** ③ 并发同请求去重：同一 key 在飞时共享同一个 promise，settle 即清。 */
const inflight = new Map<string, Promise<unknown>>();

export function dedupeInflight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing !== undefined) return existing as Promise<T>;
  // 注意：不能用 run().finally(cb)——finally 的中间 promise 会带着同一个
  // rejection 无人观察（假计时器宽限 reject 场景直接吃 Unhandled Rejection）。
  const p = run();
  inflight.set(key, p);
  const settle = () => {
    if (inflight.get(key) === p) inflight.delete(key);
  };
  p.then(settle, settle);
  return p;
}

/** 测试隔离钩子：清空三道闸的进程内状态与存储闩。 */
export function __resetAuthStormGuardForTests(): void {
  backoffUntil.clear();
  backoffFails.clear();
  inflight.clear();
  try {
    window.sessionStorage?.removeItem(LOGIN_REDIRECT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
