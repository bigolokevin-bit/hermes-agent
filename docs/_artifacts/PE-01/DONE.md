# PE-01 · 员工列表「翻页位置进 URL + 刷新回同位」 — DONE（收窄版）

- 车道：worktree `/Users/kevin_studio/Projects/tasks/PE-01-url-cursor`，分支 `task/PE-01-url-cursor` @ base `648233693d`
- 写域：`web/src/modules/employees/EmployeesModulePage.tsx`、`web/src/modules/employees/employees.cursor-url.test.tsx`（新增）、本文件
- 页面：`#/employees`（列表分页条 `emp-list-page`，游标口径不变）
- 未 commit / 未 push（按派工由总控统一处理）

## 1. 现网取证（2026-11-23，127.0.0.1:8092，token 走 `~/.seakoi/opsadmin-token.txt`，原文照贴）

### a. 顶层有无 nextCursor

```bash
$ TOK=$(cat ~/.seakoi/opsadmin-token.txt)
$ curl -H "Authorization: Bearer $TOK" 'http://127.0.0.1:8092/api/employees?limit=2'
{"items":[{"employeeId":"emp_217A91BA995044DFBB3E2E940B","name":"QA2 契约验证 1794894768","title":"QA2 契约验证（dev 库，可清理）","lifecycleState":"draft","ownerUserId":"1","updatedAt":"2026-11-17T05:52:48.030Z","department":null},{"employeeId":"emp_86A81CE8FF6F42E187BCF2B540","name":"AgentOS 产品助理","title":"产品助理（数字员工 · Pilot）","lifecycleState":"active","ownerUserId":"1","updatedAt":"2026-11-21T18:39:20.010Z","department":"产品部"}],"nextCursor":"eyJjcmVhdGVkQXQiOiIyMDI2LTExLTEzVDIyOjE1OjExLjY0MVoiLCJpZCI6ImVtcF84NkE4MUNFOEZGNkY0MkUxODdCQ0YyQjU0MCJ9"}
[HTTP=200]
```

`limit=2` 就给下一页游标（现全量 3 人）。游标 base64 解出是 keyset 型 `{"createdAt":"2026-11-13T22:15:11.641Z","id":"emp_86A81CE8FF6F42E187BCF2B540"}`，不是随机一次性 token。

### b. 取游标续页 + 同一枚游标重放第二次

```text
C=eyJjcmVhdGVkQXQiOiIyMDI2LTExLTEzVDIyOjE1OjExLjY0MVoiLCJpZCI6ImVtcF84NkE4MUNFOEZGNkY0MkUxODdCQ0YyQjU0MCJ9  (base64 解出= {"createdAt":"2026-11-13T22:15:11.641Z","id":"emp_86A81CE8FF6F42E187BCF2B540"})

$ curl -H "Authorization: Bearer $TOK" 'http://127.0.0.1:8092/api/employees?limit=2&cursor=$C'   # 第 1 次使用该游标
{"items":[{"employeeId":"emp_0166858D562149938FBDA22649","name":"AgentOS 产品助理","title":"产品助理（数字员工 · Pilot）","lifecycleState":"active","ownerUserId":null,"updatedAt":"2026-11-13T06:02:53.031Z","department":null}]}
[HTTP=200]

$ curl -H "Authorization: Bearer $TOK" 'http://127.0.0.1:8092/api/employees?limit=2&cursor=$C'   # 同一枚游标第 2 次重放
{"items":[{"employeeId":"emp_0166858D562149938FBDA22649","name":"AgentOS 产品助理","title":"产品助理（数字员工 · Pilot）","lifecycleState":"active","ownerUserId":null,"updatedAt":"2026-11-13T06:02:53.031Z","department":null}]}
[HTTP=200]
```

续页集合 `emp_0166858D…` 与首页两行不重复；**同一枚 cursor 重放第二次仍是 200 且同集合**。

### c. 全量一页装得下时首屏不给游标

```bash
$ curl -H "Authorization: Bearer $TOK" 'http://127.0.0.1:8092/api/employees?limit=50'
items 数= 3 ids= ['emp_217A91BA995044DFBB3E2E940B', 'emp_86A81CE8FF6F42E187BCF2B540', 'emp_0166858D562149938FBDA22649']
顶层键= ['items']
[HTTP=200]
```

顶层只有 `items`（无 `total` 键 → 页面上既有「总数不可用 · 已显示 N 人」口径不动，本卡没碰）。现网 3 人 < 页宽 50，所以真实浏览器里看不到翻页与恢复；取证与测试都靠 `limit=2` 与 jsdom 假分页驱动。

**取证结论：游标不是「用一次就废」的令牌 ⇒ 满足派工的升级条件，采用「按响应链确定性续取」口径，而不是只做状态回显。**

## 2. 口径与取舍（为什么这么做）

- **URL 语义**：`?cursor=<c>` = 「上一页响应给出的下一页游标」，即「已加载到 c 之前的全部行」。不表示「c 这一页已加载」。
- **恢复做法**：挂载带 cursor 时，第一腿照常从第一页取（不带 cursor）；此后**只用每页响应自己给出的 nextCursor** 逐页续取，直到某页响应的 nextCursor 等于链接里的目标游标（= 原位达成）或撞到真实末页/上限。
- **链接里那枚游标值，一次都不发出去**。这是本卡的硬边界：把外部输入（用户可手改的 URL）直接当请求参数，等于赌服务端状态；赌歪就是半屏错位数据还显示「已显示 N 人」。实测只证明「服务端给过它的游标可重复」，没证明「任意字符串可续」，所以不做盲重放。测试里 `legs.filter(u => u.includes("cursor=pc-3"))===0` 钉住了这条。
- **不做无限链式重放**：上限 `RESTORE_MAX_HOPS = 10` 页（= 500 行）。到位即停（测试断言「恰两腿」），对不上则一路到真实末页并如实清键，绝不谎称原位。
- **被否决的两条**：① 纯状态回显（刷新只显「已从第一页重新加载」）——实测已推翻其前提「游标可能一次性」，且它交付不了卡片标题的「刷新回同位」；② 直接拿链接游标续页替换首屏——以 cursor 续页的前提是首屏已在其之前，盲替换必然错位。
- **诚实化落点**：计数区新增一行 `data-testid="emp-list-cursor-restored"`（仅当挂载时 URL 带过 cursor 才出现），按四种结局分别说明：
  - `已从链接位置恢复（首页即到该位）` / `已从链接位置恢复 · 自动续取 N 页`
  - `原链接位置超出当前数据：已停在真实末页`（同时清键，「已到末页」照常上屏）
  - `原链接位置过远：续取 10 页仍未到，已如实停在续到的位置`（同时清键）
  - `原链接位置续取失败：已显示此前加载的行`（失败态**不碰 URL**）
  恢复期间「加载更多」复用同一 `loadingMore` state，显「加载中…」并禁用，不虚报可点。
- 部门（本地过滤）与排序（本地排序）变化也清键：属保守处置——服务端侧没有筛选发生，但 URL 上的位置宣称与屏上所见已经不再同源，宁可让用户重新翻一次。R81「部门不发新请求、不污染服务端游标」不变：清键只是 `patchParams`，零请求。

## 3. 实现条款对账

| 派工条款 | 落点 |
|---|---|
| ① 翻页成功写回最新下一页游标；首屏 `nextCursor===null` 清陈旧键；失败态不碰 URL | `mergeAppended()`（`loadMore` 与恢复链共用）`patchParams({ cursor: parsed.nextCursor })`；首屏腿 `.then` 内 `else if (parsed.nextCursor === null) patchParams({ cursor: null })`，`.catch` 一律不写 |
| ② 挂载带 cursor 的恢复 | `restoreTargetRef`（挂载时一次性取走）→ `resumeFromLink()`，四结局 + `emp-list-cursor-restored` 说明行 |
| ③ 筛选/排序/清除一并清键 | 关键词防抖腿、`cycleSort` 三档、lifecycle、部门「全部」/切换/清空、两处「清除筛选」、`retry()`（刷新即位置作废）——共 12 个 `patchParams` 调用点补 `cursor: null`（另有首屏 null 清键与恢复链末端清键两处，属条款①②） |
| 既有分页口径不动 | `emp-list-page-count` / `emp-list-page-more` / `emp-list-page-end` 三处语义零改动，只在 count 之后插入说明行；`pageQuery()`/`mergeAppended()` 是同一逻辑的提取，请求串与追加去重（按 `employeeId`）行为逐字保持 |

部门丢参实证仍在页面注释（R81，`emp-list-dept-scope-note` 的 title），未重复取证。

## 4. 改动与体积

- `web/src/modules/employees/EmployeesModulePage.tsx`：1121 → 1210 行（+128 / −39）。新增模块级 `RESTORE_MAX_HOPS`、`RestoreInfo`、`restoreNoteText()`；组件内 `restoreTargetRef`、`restoreInfo`、`pageQuery()`、`mergeAppended()`、`resumeFromLink()`；`loadMore`/首屏腿改为复用它们。
- `web/src/modules/employees/employees.cursor-url.test.tsx`：新增 280 行，6 例（jsdom，mock `@/lib/api` 与 `@nous-research/ui`，形制同 `employees.paging.test.tsx` / `employees.filters.test.tsx`）。

## 5. 命令与原始结果

```bash
cd /Users/kevin_studio/Projects/tasks/PE-01-url-cursor/web
export PATH="$HOME/.nvm/versions/node/v26.13.1/bin:$PATH"

node_modules/.bin/vitest run src/modules/employees/employees.cursor-url.test.tsx
# Test Files  1 passed (1)
#      Tests  6 passed (6)

node_modules/.bin/vitest run src/modules/employees
# Test Files  14 passed (14)
#      Tests  88 passed (88)        # 基线 82 + 本卡 6，零回归

node_modules/.bin/vitest run src/modules/employees src/pages
# Test Files  25 passed (25)
#      Tests  180 passed (180)

node_modules/.bin/tsc -p tsconfig.app.json --noEmit
# EXIT=0，error TS 计数 0（不新增错误）

node_modules/.bin/vite build > /tmp/pe01-build.log 2>&1; echo EXIT=$?; grep -c "✓ built" /tmp/pe01-build.log
# EXIT=0
# 1
```

牙齿自检（改坏产品码看测试是否红，验完已还原）：把 `mergeAppended` 的写回删掉 → `cursor-url` 6 例中「翻页写入 URL」「筛选清键」两例转红，其余 4 例仍绿（口径各锁各的）。未跑 eslint（不在派工自检清单内）。

## 6. 测试覆盖

| 例 | 锁什么 |
|---|---|
| 1 | 首页不宣称位置；一次翻页 → `cursor=pc-3`（最新响应给出的下一页游标）；末页 → 键消失 + `已到末页` + `总数不可用 · 已显示 4 人`；手动翻页不出现恢复说明行 |
| 2 | 挂 `?cursor=pc-3` 挂载 → 行=甲一/乙二/丙三、键位仍为 `pc-3`、说明「自动续取 1 页」；请求序列：第 1 腿不带 cursor、第 2 腿带 `cursor=pc-2`、共 2 腿、`cursor=pc-3` 出现 0 次 |
| 3 | 数据变短 → 说明「超出当前数据：已停在真实末页」、键清除、`已到末页` 在、陈旧游标 `pc-9` 一次都没发 |
| 4 | 续取腿 500 → 错误卡在场、说明「续取失败」、`cursor=pc-3` 原样保留（失败态不写 URL） |
| 5 | 部门/排序/lifecycle/清除筛选四档，各自先翻页留键再交互 → 键必清；lifecycle 换筛选的新腿不带旧 cursor |
| 6 | 恢复到位后点「刷新」→ 回首页 2 行、链接游标从未被赌、键位作废、说明行消失 |

## 7. 已知边界

- 恢复链按「每页响应给出的游标」重走，依赖服务端 keyset 顺序稳定。实测（b）支持；但若链上数据被改写（新增/删除导致顺序位移），目标游标可能永远对不上 → 一路取到真实末页，如实报「超出当前数据」并清键，不会显示错位数据冒充原位。
- 现网 3 人 < 页宽 50，浏览器里翻页与恢复都不会自然触发；活体验收需临时 `limit` 或造数据（本卡未做，派工的活体条件不在写域）。
- 首屏 `nextCursor` 非空时**不写**键位（派工条款①只要求 null 时清陈旧键）：URL 只在真的翻过页之后才宣称位置。
- 刷新/换筛选后不自动恢复旧位（位置宣称当场作废），需要原位请直接分享带 cursor 的链接重新打开。
