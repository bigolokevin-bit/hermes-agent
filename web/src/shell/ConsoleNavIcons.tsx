/**
 * 侧栏折叠档（56px 图标轨）的模块图标表（2026-11-24）。
 *
 * 背景：折叠档此前只把文字 `display:none` 掉，条目变成一串 52×34 的空行
 * （用户实机投诉「收起来以后没有任何适配」）。折叠档的每个一级入口必须有
 * 一枚可辨认的图标，映射与 routes.ts 的 8 个 module 一一对应、不多不少：
 *
 *   overview   运营总览      LayoutDashboard
 *   employees  数字员工      Users
 *   work       任务与运行    ListChecks
 *   approvals  审批与发布门  ShieldCheck
 *   identity   人员与访问    UserCog
 *   knowledge  知识与数据    BookOpen
 *   capabilities 能力与接入  Plug
 *   system     系统设置      Settings
 *
 * 只登记图标，不在这里改标签/分组/顺序——文案单一事实源仍是 routes.ts。
 */
import {
  BookOpen,
  LayoutDashboard,
  ListChecks,
  Plug,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ConsoleModule } from "./routes";

export const CONSOLE_MODULE_ICONS: Readonly<Record<ConsoleModule, LucideIcon>> = {
  overview: LayoutDashboard,
  employees: Users,
  work: ListChecks,
  approvals: ShieldCheck,
  identity: UserCog,
  knowledge: BookOpen,
  capabilities: Plug,
  system: Settings,
};
