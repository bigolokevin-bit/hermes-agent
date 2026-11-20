/**
 * SessionExpiredBanner — 全站唯一的「会话已过期」提示（设计车道 ①）。
 *
 * 一次登录失效以前会被四套各自绘制的卡片说出来（审批页 / 运行页 / 数字员工列表，外加
 * 登录页自己的失败卡），同一状态在一屏里出现多次。它们现在都收口到这里：`lib/api.ts`
 * 在业务请求拿到 401 时置位 `lib/session-expiry`，本组件订阅后只出现一条通栏横幅。
 *
 * 登录页的失败卡不在这一口径里：它说的是「这次密码/验证码没通过」，不是「你原来的会话
 * 过期了」；它走直连 `/auth/*` 的 fetch，不经过 `lib/api.ts`，所以永远不会点亮这里。
 *
 * 无障碍：`role="alert"` + `aria-live="assertive"` 让读屏立刻播报；容器 `tabIndex=-1`
 * 且第一次出现时聚焦一次（失活是打断性的，键盘用户不该再自己找回去），关掉再亮起时算
 * 新一轮，会再聚焦一次。程序化移动焦点不触发 `:focus-visible`，所以聚焦样式用 `focus:`
 * —— 焦点被抢走时也要看得见落在哪里。
 *
 * 挂载点：`contexts/PageHeaderProvider.tsx` 的 header 之后 —— 它包住所有页面的顶栏，
 * `App.tsx` 的路由注册表本车道不能碰。视觉沿用全站 banner 族的既有语汇（通栏、`border-b`、
 * `/10` 底色、`text-xs`），色系换成 `destructive`，与页面里既有的失效卡一致。
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { TriangleAlert } from "lucide-react";
import { ConsoleButton } from "@/shell/ConsoleButton";
import {
  dismissSessionBanner,
  isSessionExpired,
  subscribeSessionExpired,
} from "@/lib/session-expiry";

export function SessionExpiredBanner() {
  const expired = useSyncExternalStore(
    subscribeSessionExpired,
    isSessionExpired,
    isSessionExpired,
  );
  const box = useRef<HTMLDivElement>(null);
  // 同一轮出现只聚焦一次；横幅收起时复位，下一轮失活再聚焦。
  const focused = useRef(false);

  useEffect(() => {
    if (!expired) {
      focused.current = false;
      return;
    }
    if (focused.current) return;
    focused.current = true;
    box.current?.focus();
  }, [expired]);

  if (!expired) return null;

  return (
    <div
      ref={box}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      data-testid="session-expired-banner"
      className="flex shrink-0 items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-1.5 text-xs text-destructive outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
    >
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">会话已过期，请重新登录后继续。</span>
      <ConsoleButton
        variant="primary"
        size="sm"
        data-testid="session-expired-relogin"
        onClick={() => {
          // 整页跳转而不是 SPA 导航：重新登录要重新拿到 index.html 里注入的
          // 会话令牌（loopback 模式下令牌会随服务端重启轮换）。落点与被它替换的
          // 各页出口一致，仍是控制台自己的登录页。
          window.location.assign("/login");
        }}
      >
        重新登录
      </ConsoleButton>
      <ConsoleButton
        variant="ghost"
        size="sm"
        aria-label="关闭提示"
        data-testid="session-expired-dismiss"
        className="shrink-0 px-2"
        onClick={dismissSessionBanner}
      >
        ×
      </ConsoleButton>
    </div>
  );
}
