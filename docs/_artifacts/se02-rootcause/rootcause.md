# SE-02 sessions 面不入 bundle：根因判定（SE-02/SE-03 构建树根因单）

取证时刻：2026-11-24 01:5x~02:0x（+08:00）｜仓 `/Users/kevin_studio/Projects/forks/hermes-agent`｜face `92ef2b4b3f63a0eba348a5da69fc237d7d5010c0`（= 本地 HEAD，定向 ref 同值）
边界：只读调查。挂载/引用改动属产品决策，本车道不代改。

## 结论
**假说 A 成立：构建图不可达（结构不可达），不是部署差。**
`web/src/modules/sessions/`（SE-02 交付的 `SessionsList.tsx` / `sessionsApi.ts` / `index.ts`，源码含 18 枚 `se2-sessions*` testid）**没有任何在挂模块引用它**；`/sessions` 路由挂的是上游旧页 `web/src/pages/SessionsPage.tsx`。孤立模块被摇树 ⇒ 九/十八枚 token 永不入产物，无论重建多少次。

**假说 B 是机制而非债因：**`App.tsx` 全站用 `lazy(() => import(...))`，每页一个 chunk；旧面 `SessionsPage-BzFnx7u0.js` 一直在架，其内部对 `se2-*` 的命中为 0。不存在 manualChunks/rollupOptions 特殊规则（`web/vite.config.*` grep 空）。

**因此「52 建债」不成立**：以 se2 token 上脸为偿据要求的是「产物里出现一个未被挂载的模块」，构建正常时不可能达成。与 Duty 判例同族（`DutyPage.tsx` 源面 testid 在，`modules/duty/DutyPage` 无导入者 ⇒ 永不入产物）。

## 证据链（原始命令与读数见同目录 `evidence.txt`）
1. 挂载点：`web/src/App.tsx:207` → `const SessionsPage = lazy(() => import("@/pages/SessionsPage"));`；`web/src/App.tsx:329` 路由表条目 `"​/sessions": SessionsPage,` ⇒ 挂的是上游旧页，非 SE-02 组件。
2. 引用面扫描：排除自身目录后，`SessionsPage|modules/sessions` 在 `web/src` 的命中文件只有 `App.tsx`、`shell/routes.ts`、`pages/SessionsPage.tsx`、`pages/SessionsPage.test.tsx` ⇒ **零个在挂模块 import `modules/sessions/**`**。
3. 路由别名面：`web/src/shell/routes.ts:269` 的 `/sessions` 行标 `kind: 'compat-module'`、`to: '#/employees'`，并带 `conflict` 原文：“path '/sessions' is an existing App route (upstream SessionsPage); the compat form wants to redirect it to the employees list — stage 2 decides precedence” ⇒  precedence 本身是**待裁定的产品决策**，SE-02 页在路由层也未被赋予落点。
4. 产物侧：`hermes_cli/web_dist/assets/` 全量 grep（重建后）`se2-sessions`、`-list`、`-more`、`-empty`、`-error`、`-denied`、`-unwired`、`-login`、`-request-id` 命中文件数**全 0**；`ls assets | grep -i session` 只有 `SessionsPage-BzFnx7u0.js`（旧面 chunk，token 命中 0）。
5. 构建幂等旁证：51 建与 52 建产物同名同 sha 同字节（`index-DZJ7eIFp.js` / `fc677670fe5fcab5694385f5496b1388ea508006c6bcc74c72ddc751366bd5ef` / 174971B），仅磁盘 mtime 与一次性临时目录名变（`.web_dist-build-gYu8YU` → `.web_dist-build-vxz6JJ`，事后均已自清）⇒ 源码集合未变，重建次数不改变可达性结论。
6. 对照族：apr5 面（AP-05f/AP-06，在挂的 approvals 模块内）token 在同一产物里 present（`apr5-decision-face`/`apr5-decision-face-sentence`/`apr5-actions-hash-missing-note`/`apr5-copy-request-id` 各 1）⇒ 同一构建、同一 face，接线面能上脸、未接线面上不了，排除「构建陈旧/缓存」这一类解释。

## 可持续债判据（建议，本单不改判据）
1. 产物偿据只取**在挂闭包内**的模块 token：判据前置一步 = 「该 token 所在文件是否被 `App.tsx` 路由表（或其 lazy import 闭包）引用」。未被引用者归「结构不可达」族，永不作产物偿据（与 Duty 同族处置）。
2. 债的锚点从「token 上脸」改为「接线笔」：孤立模块的债在**挂载/引用建立的那一笔 face** 落地时才成立；在那之前，源码进线证据由 vitest 面自证（本单：`SessionsList.test.tsx`、`web/src/modules/sessions/*` 入源码差、`duty/…` 等同族）。
3. 工单/L6 给的 token 枚数与名目必须用源码全列自证后再入账（本单实测：se2 全列 18 枚 ≠ 工单 9 枚口径；apr5 全列 40+ 枚 ≠ 工单 4 枚），且禁用未出现过的名字。

## SE-03 可达性（工具坑直呈）
- 本检出是**浅克隆**：`.git/shallow` 存在（1 条）。`git fetch --depth=2 origin 675d0f29f6851b210000d4b25e32d34f7061f552` → `fatal: remote error: upload-pack: not our ref 675d0f29f6851b210000d4b25e32d34f7061f552`（远端不接受按该 sha 取，且该对象不在任何可取 ref 的窗口内）。
- 不是「浅窗口太窄」而是**远端没有承载它的 ref**：`git ls-remote origin` 全量 3634 条 ref 中，`675d0f29f6…` 零命中；`SE-03` 名目零命中；SE-0* 只有 `refs/heads/task/SE-02-sessions-list = b0a7392d4525cebc0d8260a47672bc7e99d68833`。本地亦无任何 ref 指向该 sha；本仓只配置了一个 remote（`origin = bigolokevin-bit/hermes-agent`，`remote.origin.fetch` 被 pin 在 `+refs/heads/pin/7c0e12a5:…`，跟踪引用不可信，一律走定向 ref 落文件）。
- ⇒ 请 L0/L6 给出 SE-03 的**承载仓与分支名**（若推在别的 fork/上游仓，我加一次性定向 ref 取即可；仅在 origin 内 unshallow 也拿不到，因为它不在 origin 的任何 ref 上）。

## 建议动作（择一，均需 L0/产品裁定；本车道不代改）
- A（最小接线）：`App.tsx` 把 `/sessions` 指向 SE-02 的新页（或让 `pages/SessionsPage.tsx` 引用 `modules/sessions/SessionsList`），同时按 `routes.ts:269` 的 `conflict` 注记定 stage-2 precedence。此后 se2 token 才可作产物偿据。
- B（判据改形制）：承认 SE-02 面属「结构不可达」族，产物偿据只取在挂闭包内模块；se2 债以接线笔为锚，源码进线以 vitest 面为凭。
- 无论 A/B：`LANE-LEG-ATOMICITY` 里加一条「偿据必须先在挂闭包内自证」的前置判据（我可在 L0 裁定后随下一波提交）。
