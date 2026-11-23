# Q13 · 审批差异视图 — DONE

分支 `task/Q13-approvals-diff`（基线 lane/hermes-console @5ddee38447）。
写域：`web/src/modules/approvals/**`（model.ts / views.tsx / 新测试）。零新端点、零写路径。

## 1. 接口原文（金标准）

数据源只用既有 `GET /agent-api/api/approval?id=`（api.ts detailUrl/fetchDetail 原样）。
本机链路：v4_proxy(9122/9131) → console BFF(8092, `bff-v4-serve/apps/console/server.py`
`"/api/approval"` → AP3 `/v1/approvals/{id}`) → 域服务(8101, SQLite
`~/.local/state/seakoi-ops/domain-dev.db`)。登录态经 l7-ops 治理登录腿
`ops/opsadmin-evidence-login.sh`（opsadmin=human:1，本机非生产治理凭据）。

原文快照（curl 200，逐字未改）：

- `evidence/raw-detail-ap_AEEC078E0C824E749513AFEC9A.json`（3905 B，employee.version.create）
  顶层含 **`detail.changeDetail`**：
  `{ employeeId, fromVersionId:"empv_BEB487D9B8DC46ECB1C1AD663B", toVersionNo:3,
     addedGrants:[gr_C5C617…(business_api/execute), gr_EF4FC2…(channel/send)],
     removedGrantIds:[], effectiveFrom, source:"resource" }`
  同一载荷另有 snake 镜像 `resource{from_version_id,to_version_no,added_grants,removed_grant_ids}`。
- `evidence/raw-detail-ap_0C67930A766D4AA49E4B5B44EC.json`（1258 B，message.send）
  **无任何差异键**（resource 仅 channel/conversation_ref/employee_id）。
- `evidence/raw-list-expired.json`（列表侧 11 expired + 5 consumed，tenant=t_seakoi_pilot）。

## 2. diff 字段有无 · 最终判定

**real（部分单据）**。差异键的实测形制 = `detail.changeDetail`（camel）/`resource`（snake）
中的 `fromVersionId|from_version_id`、`toVersionNo|to_version_no`、
`addedGrants|added_grants`、`removedGrantIds|removed_grant_ids`。
`changes/diffs/fieldChanges/proposal` 等泛型键在全部实测响应中**未出现**，故读取器
（model.ts `approvalDiffFrom`）只认实测形制、不凭空支持：

- 命中差异键 → `{fields:[{label,before,after,raw}], source:"real"}`（camel/snake 镜像只取首个载体，禁重数）；
- 有差异结构但零变更字段 → `source:"absent"`（屏上「服务带回了差异结构，其中没有字段级变更」）；
- 无差异键 → `null` → 屏上「未接——这条单据的服务端响应没有带回字段级前后值，屏上不猜差异内容」+ title 原因句。

原始句柄只进 title（模型法则二）；缺失渲染「—」/未接，禁 fixture、禁假 0。
决策按钮维持 `DECISION_GATE` 现状（disabled + 原因 title），本功能未新开任何写路径。

## 3. 测试

- 新文件 `web/src/modules/approvals/approvals.detail.diff.test.tsx`（mock `@/lib/api` fetchJSON，
  形制照 approvals.rowcopy.risk/edge2）：
  ① 真实差异键→字段级前后行（3 行：员工版本 v…→v3 + 两条新增授权；镜像不重数；raw 只进 title）
  ② 差异键缺失→`diff=null`+「未接」原因句、屏上无任何差异行
  ③ 待处理抽屉：批准/驳回 disabled=true、title=DECISION_GATE 原因句
- 门：`node_modules/.bin/vitest run src/modules/approvals` → **86 files / 406 tests 全绿**（新 3 条含在内）。
- `node scripts/lint-fake-success.mjs src/modules/approvals` → `violations: [], ok: true`。
- `tsc --noEmit`：approvals 写域 0 错（仓级预存错误与基线同数，未触碰）。

## 4. Build 门

`cd web && node_modules/.bin/vite build` → **exit 0**（未用 pnpm run build；tsc -b 基线预存错按纪律不采）。

## 5. 截图（真实渲染取图）

- `/Users/kevin_studio/Projects/tasks/Q13-approvals-diff/evidence/q13-1440.png`（1440×900）
- `/Users/kevin_studio/Projects/tasks/Q13-approvals-diff/evidence/q13-375.png`（375×812，差异段纵排不破版）

取图方式偏离说明（如实记录）：任务指定「起 vite dev server」，但 vite dev 的 proxy 只转发
`/api` 与 `/dashboard-plugins`，**不含 `/agent-api`**（vite.config.ts 实测），dev 面上审批数据
必为读取失败，拿不到真实渲染。故按既有 QA 配方（assert-375.mjs 的 CHROMIUM 常量 + 9122 同源
预览形态）：worktree `vite build` 产物经临时 v4_proxy(9131, loopback, 用完即杀) 提供，
opsadmin 会话 cookie 注入 playwright，导航 `#/approvals?tab=history` →
点开 ap_AEEC… → 等待形制 = domcontentloaded + 显式 settle（禁 networkidle）。
代理日志坐实浏览器真实发出了 `GET /agent-api/api/approval?id=ap_AEEC…` 200，屏上即其返回。
脚本：`evidence/q13-shoot.mjs`。

## 6. 交付

- 实现+测试 commit：`feat(approvals): field-level before/after diff in detail from real AP3 payload, honest 未接 fallback`
- 本 DONE.md 单独 commit；evidence/ 不 commit。
