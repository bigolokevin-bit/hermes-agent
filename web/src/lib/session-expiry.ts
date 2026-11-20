/**
 * 会话过期状态 — 全站唯一「会话已过期」横幅的单一事实源（设计车道 ①）。
 *
 * WHY：一次登录失效以前会被四套各自绘制的卡片说出来 —— 审批页、运行页、数字员工
 * 列表（外加登录页自己的失败卡）。同一个状态因此在一屏里出现多次，彼此还话术不一。
 * 现在把它收成一个模块级 store：api 层在业务请求拿到 401 时 `markSessionExpired()`，
 * `shell/SessionExpiredBanner.tsx` 订阅后只渲染一条通栏横幅，页面不再自绘失效卡。
 *
 * 登录页的失败卡（`pages/LoginPage.tsx`）不在这个口径里：它说的是「这次密码/验证码
 * 没通过」，不是「你原来的会话过期了」，走的是直连 `/auth/*` 的 fetch，压根不经过
 * `lib/api.ts`，所以也永远不会点亮这条横幅。
 *
 * 不依赖 React：api.ts（非组件）与横幅组件（`useSyncExternalStore`）共用同一份状态。
 * 快照是一个布尔（`isSessionExpired`），所以 store 的引用天然稳定。
 *
 * 收敛口径：四个历史状态源（横幅 / 页内 401 句 / AuthWidget / Auth5Session）已收敛
 * ——横幅 = 唯一状态句，页内 = 纯引导（`api-error` 的 `SESSION_REQUIRED_GUIDANCE`），
 * 两个侧栏件在横幅在场时静默（订阅同一快照）。
 */

/** 这一次失活是否还在（由 401 置位、由业务请求的 2xx 结案）。 */
let expired = false;
/** 用户手动关掉了横幅：仍然处于同一次失活中，只是不再重复打扰。 */
let dismissed = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/**
 * 业务请求（非 `/auth/*`、非身份探测）拿到 401 时调用。
 *
 * 同一次失活里幂等：横幅已经在显示、或已经被用户关掉时都不再通知 —— 否则一个 5 秒
 * 轮询就会把 aria-live 播报刷屏、并把「关闭」变成永远按不动的按钮。新一轮失活
 * （上一次已被 2xx 结案）才会重新出现并清掉旧的关闭标记。
 */
export function markSessionExpired(): void {
  if (expired) return;
  expired = true;
  dismissed = false;
  notify();
}

/** 横幅的「×」：只隐藏此刻的提示，不改变「会话已过期」这个事实。 */
export function dismissSessionBanner(): void {
  if (!expired || dismissed) return;
  dismissed = true;
  notify();
}

/**
 * 业务请求拿到 2xx：会话被证明是活的，这一次失活结案，为下一次失活复位。
 *
 * 这条同时兜住一个误报口径：域级 401（某个资源读不到，而不是登录失效）会让横幅亮
 * 一下，随后的正常响应把它收掉；真正的登录失效则是全体业务请求都 401，横幅不会被
 * 任何 2xx 收掉。
 */
export function clearSessionExpired(): void {
  if (!expired) return;
  expired = false;
  dismissed = false;
  notify();
}

/**
 * 给 `useSyncExternalStore` 的快照：横幅此刻该不该出现。
 * 已过期但被用户关掉时返回 false —— 事实仍在（`expired`），只是不再打扰。
 */
export function isSessionExpired(): boolean {
  return expired && !dismissed;
}

/** 订阅快照变化，返回取消订阅函数。 */
export function subscribeSessionExpired(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
