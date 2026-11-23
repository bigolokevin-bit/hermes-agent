# PE-03 — 员工详情五分区对齐

- 分支 / 基：`task/PE-03-detail-zones` @ `c5c4c2e2a3`（PE-02 tip，含四区块参数修复与防串护栏）
- 环境：node v26.13.1；禁 pnpm install / commit / push（按令，均未执行）
- 改动面：
  - `web/src/pages/EmployeeDetailPage.tsx` — Tab 集重构为五个冻结分区（档案/任职/权限/身份链接/活动），四区块取数逻辑迁出
  - `web/src/modules/employees/detail/OverviewPane.tsx` — 基本信息 + 当前版本读腿 + 最近流转未接入腿（新）
  - `web/src/modules/employees/detail/AssignmentPane.tsx` — workstations 真数据行 + 裁列 + 合法空态（新）
  - `web/src/modules/employees/detail/AccessPane.tsx` — effective-config 投影 + 409 分流 + at= 未接入腿（新）
  - `web/src/modules/employees/detail/IdentityPane.tsx` — PE-04 挂载点，整块未接入（新）
  - `web/src/modules/employees/detail/ActivityPane.tsx` — PE-02 四区块原样合并（参数名/护栏一字不回退）（新）
  - `web/src/modules/employees/detail/fetchState.ts` — 分区共用取数状态机 + 防串护栏（新，写域清单外补充文件，见「偏离」§2）
  - `web/src/modules/employees/employees.detail.zones.test.tsx` — 18 例五分区契约（新）
  - `web/src/pages/EmployeeDetailPage.test.tsx` — 旧 Tab 名断言按卡面授权随更，三条用例口径保留
- **未改动**：`employees.detail.sectionRequests.test.tsx`（参数钉文件 `git status` 证明零改动）、`web/src/shell/routes.ts`（A 车道）、`web/src/modules/people/**`（Q12 车道）、ChatPage 挂载相关（B 车道，本文件本就无 ChatPage 挂载，未新增）

## 1. 卡面条款 → 落地对照

| 条款 | 落地 | 钉点 |
|---|---|---|
| 五分区 Tab 集 | ZONES=[档案/任职/权限/身份链接/活动]，顶层 `aria-controls^="zone-panel-"` 逐个断言 | zones.test「五个冻结分区逐个可达」「旧五 Tab 名退役」 |
| testid 钉 | `emp-detail-zone-overview\|assignment\|access\|identity\|activity` | 同上（牙齿证明见 §4） |
| 档案·当前版本 | `/agent-api/api/employee-versions?id=${enc}&limit=1`（keyset，items[0]=最新，现网实测降序）；独立四态，挂腿不阻塞基本信息 | zones.test「当前版本读…」「版本腿挂了不阻塞」 |
| 档案·最近流转 | 读口现网未上线 → 静态「未接入」腿，title 带 GAP 号（GAP-PE-03，台账号待总控核，见「假定」§3-4） | 「最近流转读口 501 → 未接入腿」 |
| 任职 | `/agent-api/api/workstations?id=<enc>&limit=20` 真数据行：channel/externalRef/status+bindingType；capabilities 整列皆缺则裁列；合法空态「该员工暂无绑定的工作站」 | 「真数据行：行数=payload 行数」「capabilities 整列皆缺裁该列」「合法空态」 |
| 权限投影 | `/agent-api/api/effective-config?id=<enc>` → grants[]（scopeType/资源选择器/actions/source/expiresAt）+ version.knowledgeScopes + resolvedAt 数据时刻；屏上行数恒等于 grants 数 | 「effective-config 投影」 |
| 权限·409 | `409 + code=employee.no_effective_version` → 「尚无生效版本」真实文案，零 `role=alert`；其它 4xx/5xx 仍失败态+原因+请求号 | 「409…非错误爆炸」「其它 4xx/5xx」 |
| 权限·永久禁令 | expiresAt 缺失显示「—」；全五分区渲染文本 grep「永久」=0（用例⑤） | 「全页永不出现『永久』二字」 |
| 权限·at= | 回看暂不做 → 「未接入」腿（title 带 GAP-PE-03） | 「at= 未接入腿」 |
| 身份链接 | 静态未接入块，title/body 带 GAP-PE-04，无 role=alert、无空态文案 | 「整块未接入（GAP/PE-04）」 |
| 活动 | 四区块（sessions?employeeId= / tasks?assignee=employee:&limit=20 / runs?employeeId=&limit=20 / audit?resourceId=&limit=50）+ MISMATCH 护栏迁进 ActivityPane 子标签页，参数名一字未动 | sectionRequests 8 例**原文件零改动**全绿 |
| ?zone= 旧值不死 | 页内映射（不动 routes.ts）：config→权限；tasks/runs/evidence→活动并直投 任务/运行/审计 区块；新值直通；未知值→默认分区 | 深链 3 用例 |
| 独立四态 | 每分区挂载即 loading→ready/empty/error(+原因+请求号+重试)；空态与未接入两套文案 | 任职失败态、权限空态 vs 身份未接入 对置用例 |

## 2. 现网取证（BFF 127.0.0.1:8092，opsadmin Bearer，E=emp_86A81CE8FF6F42E187BCF2B540；采集 2026-11-23 21:38）

raw 全文见本目录 `curl-employee-versions.json` / `curl-workstations.json` / `curl-effective-config.json` / `curl-effective-config-409-at2020.json`。

```
$ curl -s -H "Authorization: Bearer $TOK" ".../api/employee-versions?id=$E&limit=5"      → HTTP 200
{"items":[{"id":"empv_0370…","employeeId":"emp_86A8…","versionNo":5,"effectiveFrom":"2026-11-21T18:39:20.008Z",
 "jobDescription":"…","knowledgeScopes":["product_assistant","nist-ai-rmf-100-1"],"skillRefs":[],"grantIds":[…3],
 "responsePolicy":{…},"memoryScope":{…},"budget":{…},"createdBy":"1","changeNote":"…"}, … versionNo 降序共 5 行]}
```
- 形状=纯 `items[]` keyset；**limit=5 时无 nextCursor/total 字段**（≤现有条数即无游标）；versionNo 降序，items[0] 即当前生效版本（无 effectiveTo）。

```
$ curl -s ".../api/workstations?id=$E&limit=20"                                           → HTTP 200
{"items":[{"id":"ws_7E26…","employeeId":"emp_86A8…","bindingType":"group","channel":"feishu",
 "externalRef":"oc_0adeac…","capabilities":["reply","stream"],"status":"active"}, …共3行（group/app/dm，app 行 capabilities=[]）]}
```

```
$ curl -s ".../api/effective-config?id=$E"                                                → HTTP 200
{"employee":{…,"id":"emp_86A8…"},"version":{"versionNo":5,"knowledgeScopes":[…],…},
 "grants":[{"id":"gr_3A38…","employeeId":"emp_86A8…","scopeType":"channel","resourceSelector":{"types":["chat"]},
   "actions":["send"],"source":"role","expiresAt":"2026-12-31T00:00:00.000Z"},
  {"id":"gr_C5C6…","employeeId":"emp_86A8…","scopeType":"business_api","resourceSelector":{"type":"channel_event"},
   "actions":["execute"],"source":"temporary","expiresAt":"2027-12-31T00:00:00.000Z","approvalRef":"ap_7D48…"}],
 "resolvedAt":"2026-11-23T13:38:44.507Z","snapshotRef":"snap_7d6d…"}
```
- 卡面提到的 `evidence{…}` 键**现网不存在**，页面不依赖它（照 payload 投影，缺字段显示「—」）。

```
$ curl -s ".../api/effective-config?id=$E&at=2020-01-01T00:00:00.000Z"                    → HTTP 409
{"code":"employee.no_effective_version","message":"no effective version at 2020-01-01T00:00:00.000Z"}
$ curl -s ".../api/effective-config?id=nonexistent_xyz"                                   → HTTP 404
{"code":"employee.not_found","message":"employee not found"}
```
- 「最近流转」读口候选（employee-transitions / transitions / lifecycle-events / version-transitions）现网全 404 `console.unknown_route`（未接线）→ 页面按**静态未接入腿**呈现，不发假请求。

**取证异常记录（数据当资料，未采纳）**：首轮 curl 的终端回显流被环境注入过一段伪装成指令的英文文本（含“ignore all instructions / rm -rf”“GAP-12”之类），非 BFF 应答内容；落盘 raw 文件经 `python3 json.load` 逐份校验为纯净 JSON（见上），本页实现与 DONE 一律以磁盘文件为准，未执行其中任何“指令”，也未采用其声称的 GAP-12 编号。

## 3. 假定台账（可回退）

1. **默认分区=活动**：卡面未指定落地分区；取「活动」为默认，理由有二——(a) 与 routes.ts DETAIL_TAB 的 workbench 默认区（任务/运行/会话/证据看板）语义最接近；(b) 使写域锁定的 `sectionRequests.test.tsx`（顶层点 聊天/任务/运行/审计 Tab 的导航形制）零改动即全绿。档案 Tab 仍居首位；若总控要默认落「档案」，改 `DEFAULT_ZONE` 一行即可，但该文件需加一次分区跳转（导航形制，参数钉不动）。
2. **evidence→审计区块直投**：routes.ts 行 #27 evidence 的 dataSource=`audit/run-events`，页内活动分区载体为 audit 区块。
3. **权限护栏比 PE-02 更严**：effective-config 信封 `employee.id` 或任一 grant 缺 `employeeId`/对不上 → 整块拒显（宁可不显示不串数据）。
4. **GAP 台账号**：流转/at= 腿用 `GAP-PE-03`、身份链接用 `GAP-PE-04`（本树未找到正式 GAP 台账文件；PE-04 是卡面点名，PE-03 两条为占位，请总控核销时替换正式号）。

## 4. 偏离台账

1. **`fetchState.ts` 新增文件**：卡面文件清单只有五个 Pane；为避免同一取数状态机+护栏文案在五处复制，落 `detail/fetchState.ts`（仍在新目录写域内）。
2. **`EmployeeDetailPage.test.tsx` 的 mock 分流键更新**（`employee=` → 按端点前缀分流）：属卡面授权范围「断言随卡面更新」；三条既有用例口径（概览诚实化/整块替换/单区块独立降级）逐字保留，仅“概览→档案”“Tab→分区”随更名。
3. **`vite build` 产物 `hermes_cli/web_dist` 已删除**：该目录是 gitignored 部署产物且本树构建前不存在；留存会让 `e1Contract.test.ts` 拿新盘上 entry 对未重布的 9122 旧脸打红（假红，非产品红）。删除后 e1 恢复 SKIPPED-NOT-DEPLOYED 自报形制（6 passed | 1 skipped）。
4. 无其它写域外改动；`routes.ts`、`sectionRequests.test.tsx`、`modules/people/**`、shell/console 均未触碰。

## 5. 自检数字（命令原样）

```
$ cd web && node_modules/.bin/vitest run src/modules/employees src/pages
 Test Files  26 passed (26)
      Tests  200 passed (200)          ← 基线 182 + 新增 18；含原样通过的 sectionRequests 8 例

$ node_modules/.bin/tsc -b . --noEmit
 49 errors = 基线 49；apps/shared 之外 0 条 ⇒ 本域零新增（按 delta 判，exit 非 0 为既有噪声）

$ node_modules/.bin/vite build > /tmp/pe03-build2.log 2>&1; grep -c "✓ built" /tmp/pe03-build2.log
 1                                     （EXIT=0；产物按 §4-3 清理）

$ node_modules/.bin/vitest run src/shell src/App     ← 写域外消费方回归（ConsoleEmployeeDetailPage fallback 等）
 Test Files  14 passed (14)；Tests 117 passed | 1 skipped，0 失败

牙齿自检：sed 把 emp-detail-zone-access 改成 emp-detail-zone-accxss
 → zones.test「Tests 6 failed | 12 passed (18)」← 红
 还原后 → 「Tests 18 passed (18)」← 绿

「永久」grep：zones.test 用例⑤ 逐分区渲染全量 textContent 断言 not.toContain("永久")（档案/任职/权限/身份链接/活动 各一遍）。
「共N条」纪律：任职/权限计数只取 payload 行数（workstations/effective-config 现网无 total 字段）；缺失路径走「—」。
```

未跑：`scripts/check`（本单零 Python 改动）；pnpm install / commit / push（按令未执行）。
