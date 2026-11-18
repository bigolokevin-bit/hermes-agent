# 波2 能力页（T26 技能 / T27 工具与 MCP / T30 系统健康）— 交付

- 分支：`lane/console-caps`（base `edbc9575`）
- 提交：`c42501d3` T26 技能 · `20c08e64` T27 工具与 MCP · `948ddd24` T30 系统健康 ·（本文件为第四交）均已推 `origin/lane/console-caps`（每交 `git ls-remote` 核对）
- 写域：`web/src/modules/skills/**`、`web/src/modules/tools/**`、`web/src/modules/health/**` + 本文件。未碰 `App.tsx` / `shell/**` / `package.json` / lockfile；未跑 install。三页 manifest 由 `shell/registry.ts` 的 `import.meta.glob('../modules/*/manifest.ts')` 自动发现，壳侧零改动。
- 数据口：
  - T26 `/agent-api/api/skills`、`/agent-api/api/skills/<id>` — BFF 活代理直通 domain `/v1/skills`（L5 台账：列表字段为 skillId/name/version/contentHash/ownerUserId/sharedWith/sharedCount/scope + asOf；详情 skill{…} + versions[]）。
  - T27 `/agent-api/api/mcp/servers` — **BFF 尚未注册**（GAP-04）。实时优先、失败回落 fixture（`data-fixture="1"` + 「示例数据」徽章 + GAP-04 说明条），真实数据到达即自动摘牌。
  - T30 `/agent-api/api/__health-probe__`（未注册路由 → BFF 统一 404 信封即证明存活）、`/agent-api/api/hermes-summary`、`/agent-api/api/skills` 三个真探针并行（`Promise.allSettled`）；毕昇平台恒显「未知·探针未接入」（GAP-05）。

## 已实现

- **T26 技能**：列表（名称 + 共享范围中文徽章：团队共享/员工专属/未被引用）+ 详情（描述、最新版本、状态、北京时间到分）。上游列表无「来源/启用态」字段 → 显「—」+原因，不臆造；「最新版本」按语义化取最大而非行序（上游 versions 按 created_at+文本序，同毫秒下 1.10.0 < 1.2.0 的陷阱已加回归测试锁死）。
- **T27 工具与 MCP**：服务器行 = 名称 / 状态徽章 / 不可用原因 / 最近检查时刻；不可用整行置灰但**绝不隐藏**；未知显示「—（上游未说明）」，与正常不同形同色；缺时刻每行恒显「—（未提供检查时刻）」。空态文案对齐 PRD 冻结列（指向原生 MCP 管理页），未编造 href。
- **T30 系统健康**：恰好四行（控制台/Hermes 运行时/域服务/毕昇），无虚构服务行；页头「健康 n·异常 n·未知 n」与行集同源；「运维负责人」「处理异常探针」为只读引导；唯一主操作=刷新；整页错误态仅当三个真探针**全部未收到任何 HTTP 响应**时出现，含请求号与重试；每行采集时刻北京时间到分。
- 通用：四态真（每页 `?state=loading|empty|error|ready` 预览句柄，验收截图不依赖后端）；缺值一律「—」+原因，无 `?? 0`；正文零工程语言（原始 id 只在 `title`）；窄屏 flex-wrap 单列无横溢。

## 需 A 注册 / 接入清单

1. **GAP-04**：BFF 注册 `/api/mcp/servers` 代理（Hermes 原生面）。接通后 T27 角标与说明条自动消失。
2. **GAP-05**：毕昇平台健康探针 + 接入说明文档（T30 行现按「探针未接入」诚实呈现）。
3. 原生 MCP 管理页入口路由（PRD `#/capabilities?tab=tools` 空态 CTA「打开原生 MCP」目前为文字提示，URL 未注册故未放链接）。
4. `/agent-api/api/__health-probe__` 判据是否正式化为控制台存活探针约定（现依赖「任何 HTTP 响应即存活」）。
5. GAP-04/05 编号需登记进 A 侧 GAP 台账（本仓 `shell/routes.ts` 现仅 GAP-01..03，已核无撞号）。
6. 三个 tab hash 已在 ROUTE_TABLE（`#/capabilities`、`#/capabilities?tab=tools`、`#/system`），manifest 即插即用；A 侧只需把对应行按验收节拍转可见/点亮。

## 原始 stdout（本机实跑）

T26 验收时记录（focused）：

```text
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

T26 提交时全量：85 files / 571 tests 通过；lint 0 errors / 60 warnings（skills 模块 0 命中）。

T27（提交 `20c08e64` 前）：

```text
$ corepack pnpm vitest run src/modules/tools
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  691ms

$ corepack pnpm test
 Test Files  86 passed (86)
      Tests  575 passed (575)
   Duration  4.59s

$ corepack pnpm lint
✖ 60 problems (0 errors, 60 warnings)
```

T30 + 最终门禁（提交 `948ddd24` 前）：

```text
$ corepack pnpm vitest run src/modules/health
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  632ms

$ corepack pnpm test
      Tests  579 passed (579)
   Duration  3.83s

$ corepack pnpm lint
✖ 60 problems (0 errors, 60 warnings)

$ corepack pnpm exec tsc -b . --noEmit | grep -c modules/health
0
```

环境修复后（见下节）：

```text
$ corepack pnpm build
✓ built in 2.39s
built /Users/kevin_studio/Projects/forks/console-caps/hermes_cli/web_dist/index.html

$ corepack pnpm typecheck
(exit 0, no output)
```

## 环境修复（未被 git 跟踪，与 matrix DONE 同一既有债）

本 worktree `node_modules` 为软链，`vitest` 只落在 `web/node_modules`，`apps/shared/*.test.ts` 向上解析不到 → `build/typecheck` 报大量 `Cannot find module 'vitest'`。按 matrix DONE 同款补软链（`apps/shared/node_modules` 已被 gitignore，`git status` 保持干净）：

```bash
mkdir -p apps/shared/node_modules
ln -sfn ../../../web/node_modules/vitest apps/shared/node_modules/vitest
```

修复后 build 与 typecheck 均 exit 0。此债非本波引入，新模块自身零类型错。

## 假定（实现口径，供审）

- 「四服务」文档未枚举 → 定为 控制台 / Hermes 运行时 / 域服务 / 毕昇平台；毕昇无探针端点故恒未知。
- 控制台探针判据 = 「收到任何 HTTP 响应即存活」（含 404 统一信封）。
- 域服务探针暂复用 `/api/skills`（活代理、幂等 GET、开销小）；后续如增专用探针路由可一行替换。

---

## 追加：T31 默认设置 + T32 版本（2026-11-19 波3，基线 242d8a33）

### 提交
- `672d18d9 feat(console): defaults settings page, read-only with not-landed states (T31)` — `web/src/modules/settings/{manifest.ts,settings.ts,SettingsPage.tsx,SettingsPage.test.tsx}`
- `39007942 feat(console): version page from build-injected vars, honest unknown (T32)` — `web/src/modules/version/{manifest.ts,version.ts,VersionPage.tsx,VersionPage.test.tsx}`

### 数据口与判据
- T31：GET `/agent-api/api/config`。BFF 无 `/api/config`（CR-M2-02 未落地）→ 404 即当前 ready 态：写开关（审批流变更提交/会话发送）与上游连通自检一律显「未启用」+原因；页头横幅「写入开关状态未知（本次未能读取）——在确认前按只读处理。」；三态 schema 解析已写好，接通后自动按 已开启/未开启/未知 显示（未知=neutral，不等同关）；全页零写控件（仅「重新读取」），去处链接只指已有 hash（#/system、#/employees）。
- T32：构建注入 VITE_BUILD_IDENTITY/REF/COMMIT/TIME 四变量；未注入=「未知」+原因（禁兜底假值）；提交号屏显 8 位短码、完整值进 title；构建时间北京时间到分；依赖关键版本读 `web/package.json` 清单。本页无网络请求：错误态预览如实标注「本地信息，无请求号」，不伪造请求号与重试按钮。

### 原始 stdout（门禁）
T32 交付轮（同 T31 口径复跑）：

```text
$ corepack pnpm vitest run src/modules/version
   Duration  472ms (transform 164ms, setup 0ms, import 183ms, tests 30ms, environment 204ms)

$ corepack pnpm test
 Test Files  99 passed (99)
      Tests  742 passed (742)

$ corepack pnpm lint
✖ 75 problems (0 errors, 75 warnings)
```

T31 交付轮：focused 4 passed；全量 98 files/739 passed；lint 0 errors/75 warnings（settings/version 模块 0 命中）。

### 截图（未交付说明）
上屏截图需 App.tsx live map 挂载 defaults/version tab（web/src 属 A 写域，本轮令禁碰）。此前预演拍的 4 张因壳未挂载渲染成上游 System 页，无效，已删除不入证据链。证据=模块级测试 + `?state=` 四态预览；A 侧挂载后可按 9122 代理口补拍。

### 需 A 注册 / 接线（增补，接前文清单）
1. App.tsx live map：`#/system?tab=defaults` → SettingsPage、`#/system?tab=version` → VersionPage（manifest 已自动注册，壳渲染映射缺此两 tab）。
2. BFF GET `/api/config`（CR-M2-02 自检口最小面：writeSwitches 三态 + upstreams[]）。
3. 构建注入 VITE_BUILD_* 四变量（hermes-build.json 现仅 sourceHash/outputHash，无 commit/时间；建议 scripts/build/freshness 阶段写入 vite define）。
4. GAP 台账登记 GAP-04（BFF /api/mcp/servers 代理）、GAP-05（毕昇健康探针+接入说明）。

### 假定（追加）
- T31「未启用」（未落地）与「未开启」（读到 false）严格区分，依用户判据原文。
- T32 以构建注入为唯一事实源；未注入时全行未知属预期显示而非缺陷。
