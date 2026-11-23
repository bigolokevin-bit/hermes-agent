# DONE-PE-09 · 员工批量操作（选择模型 + 批量流转预接）

- worktree：`/Users/kevin_studio/Projects/tasks/PE-09-batch`　分支：`task/PE-09-batch`
- 基线 HEAD（开工时=收尾时唯一祖先）：`689e8d46d1f87b35fa6e5035eacae0257ffe0b66`（live face）
- 工单正典：`/Users/kevin_studio/Projects/seakoi-agent-os-l0-board/docs/product/backlogs/people.md` §PE-09（L108-117）+ 提单记录 T-PE-E（L202）
- 写域（只这些）：`web/src/modules/employees/EmployeesModulePage.tsx`（改）、`web/src/modules/employees/employees-batch.ts`（新）、`web/src/modules/employees/employees.batch.test.tsx`（新）、本文件（新）
- 零触碰核对：`modules/people`／`modules/org`／`employee-detail`／`duty`／`approvals`／`shell`／主仓 seakoi-agent-os 全 0 改动（`git status --porcelain` 原文见 §五）
- `evidence/` 不入库（工单纪律）；`pnpm install` 全程未执行（node_modules 走 symlink）

---

## 一、工单要点与实装落点（逐条 文件:行）

| 工单条款 | 落点 | 读数/证据 |
|---|---|---|
| ① 选择模型：列表行选择 | `EmployeesModulePage.tsx:683`（`selected` state）、`:911`（`selectedRows` 只认屏上可见行）、`:1532-1546`（行内 `emp-row-select-<id>` checkbox + `aria-label`） | 测试 §159-183：勾两行读数 `已选 2 / 3`，勾选零请求 |
| ① 翻页即清空 + 写明口径 | `:739`（`mergeAppended` 内 `clearSelection()`）、`:791-795`（换 keyword/lifecycle/部门桶）、`:804`（首取/刷新腿）、口径句 `:41-42`、上屏 `:1376-1379` | 测试 §185-212：续页后 `已选 0 / 3` 且口径句含「翻页即清空」「不跨页记忆」 |
| ② 批量复制/导出（纯前端，复用既有 builder） | `:940-967`（`batchCopyText`/`copySelected`/`exportSelected`，复用 `buildEmployeesCopyText`/`buildEmployeesCsv`/`csvTimestamp`）、钮 `:1275`/`:1289` | 测试 §319-367：clipboard 与 Blob 各 1 次、行数=勾选数、`fetchJSON` 增量 0 |
| ③ 批量流转：前端限并发 2 的逐 id 聚合形态先落测试 | `employees-batch.ts:22`（`BATCH_CONCURRENCY=2`）、`:73-115`（`runBatchTransitions` 工作池）、`:117-131`（`batchHeadline`/`batchLine`）、`:133-160`（`failureQuote` 逐字 code：message） | 测试 §369-487 五例：`成功 2 / 失败 2`、逐字原因、四单全跑完（不断批）、400/409 恰一趟（不重试）、在途峰值 ≤2 |
| ④ 写路由未注册期：disabled + aria-disabled + title 原因，点击零请求零 toast | 门 `:37`（`BATCH_TRANSITION_ENABLED = false`）、钮 `:1342-1360`、原因句 `employees-batch.ts:60`（`TRANSITION_WRITE_NOTE`）、守卫 `:973-974`（submit 当场 return） | 测试 §215-247：`disabled=true`、`aria-disabled="true"`、title 含 `405 console.read_only` + `T-PE-E`；`.click()` 与 `dispatchEvent` 双路 POST=0、`[role=status]`=null、回执区=null；真渲染腿：`pe09-shoot.log` 两次会话「非 GET 请求数=0」 |
| ⑤ 负例：非法迁移透传 400/409 不重试 | `employees-batch.ts:73-115`（无任何重试路径）+ 测试 §414-432 | `calls=2`（两单各一趟） |
| lifecycle 六态文案必报目标态，禁「启用/停用」臆造 | `employees-batch.ts:28-35`（`LIFECYCLE_TARGET_STATES` 取自 `employee_models.py:102-108` 冻结六态）、`:50-55`（label=`lifecycleLabel(value)（value）`，与列表同一词汇源） | 测试 §260-292：选项=占位+六态逐字 `草稿（draft）…已归档（archived）`；动作条全文 `启用`/`停用` 命中 0 |
| 流转影响可上岗分母的披露句（draft/onboarding/archived 不入分母） | `:45-47`（`BATCH_DENOMINATOR_NOTE`，CONSOLE-PRD-v4 §2 口径）、`:56`（`OUT_OF_DENOMINATOR`）、`:1367-1374`（披露句 + 选中不入分母的目标态时当场补一句） | 测试 §294-317；真渲染读数见 `pe09-shoot.log`「分母披露=…」 |
| 禁 fixture/假0/假成功，缺数据显式 | 回执区只在真跑完一批后渲染（`:1386`，`batchSummary` 非 null 才出）；`failureQuote` 解不出原因写「上游未给出原因」不编造（`employees-batch.ts:133-160`）；未接入期上屏句直说「按钮已禁用，点击不发请求也不报成功」（`:1362-1366`） | 测试 §478-487（缺原因）+ §241-247（上屏原因句在场且非成功句） |

---

## 二、接口/curl 原始输出（真腿，逐字留档）

`evidence/pe09-curl.sh` 于 2026-11-24 03:44:49 CST 跑在临时同源反代 `127.0.0.1:9155`（`v4_proxy.py`，`/agent-api/*`→真 BFF `8092`→域 `8101`），opsadmin 登录腿 `~/.seakoi/opsadmin-token.txt`（len=252）。原文=`evidence/raw-pe09-curl.txt`：

```
## 1) whoami 经同源代理（登录腿在场证明；BFF 本体不提供该路由，只有 v4_proxy 桥提供）
HTTP=200
{"user_id": 1, "tenant_id": null, "granted": true, "display": "opsadmin"}

## 2) POST /api/employee-transition 直连 BFF，带会话 cookie（PE-09 写路由，期望 405 console.read_only）
HTTP=405
{"code": "console.read_only", "message": "first console is read-only; only GET/HEAD allowed"}

## 3) 同一条经同源代理（前端实际走的那条腿：/agent-api/api/employee-transition → BFF 剥前缀）
HTTP=405
{"code": "console.read_only", "message": "first console is read-only; only GET/HEAD allowed"}

## 4) 不带 cookie 的对照（鉴权腿先于路由腿；401 不是本卡判据，只作对照留档）
HTTP=401
{"code": "console.unauthenticated", "message": "登录状态缺失或已过期，请重新登录", "rid": "5e5acb90"}

## 5) 对照腿：已注册的 POST /api/employees 不带 CSRF 头（证明 405 不是全站写口恒拒，而是「未注册」）
HTTP=403
{"code": "console.csrf_origin", "message": "跨源写入被拒绝，请从控制台页面操作", "rid": "6c3a6125"}

## 6) GET /api/employees?limit=50（读口在场 + 现网真行数与三态，截图分母对照）
HTTP=200
items=3 nextCursor=null
  emp_217A91BA995044DFBB3E2E940B | QA2 契约验证 1794894768 | draft
  emp_86A81CE8FF6F42E187BCF2B540 | AgentOS 产品助理 | active
  emp_0166858D562149938FBDA22649 | AgentOS 产品助理 | active
可上岗率分母内=2 / 不入分母=1

## 7) BFF 侧路由表源码对照：employee-transition 在不在 RESOURCE_WRITE_ROUTES
(grep 无命中 = 未注册)
```

门序读法（`apps/console/server.py:1470-1521` `do_POST`）：`route in RESOURCE_WRITE_ROUTES` 先判，未命中才落 `_reject_write` 405；已注册口再走 CSRF 同源门。⇒ 同一台机器上 **#2 的 405 与 #5 的 403 是两种不同结论**，405 只能来自「路由未注册」，本卡据此把按钮判为未接入。此 405 只作「未接入」证据，**不算本卡写路径 PASS**（工单 §验证 原文口径）。

域侧写口在场证明（不是 BFF）：`services/domain/http_app.py:166-184` `POST /v1/employees/{employee_id}/transitions`；六态冻结 `services/domain/schemas/employee_models.py:102-108`（`draft/onboarding/active/paused/offboarding/archived`）。

---

## 三、门禁原始 stdout

### 3.1 `cd web && node_modules/.bin/vitest run src/modules/employees`（基线 17 件/125 例，只增不减）

```
 Test Files  18 passed (18)
      Tests  143 passed (143)
   Start at  03:42:10
   Duration  2.23s (transform 13.43s, setup 0ms, import 18.36s, tests 3.35s, environment 7.77s)
```

delta：文件 17→18（+`employees.batch.test.tsx`）、用例 125→143（+18），零删除、零改名。开工前基线同命令读数=17 passed/125 passed。

点名单件：

```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 3.2 `cd web && node_modules/.bin/vitest run src`（全量，唯一允许红=e1Contract）

```
PORT=9122 DISK_ENTRY=assets/index-B5mh4VCx.js SERVED_ENTRY=assets/index-BoWDBxUF.js (dist=/Users/kevin_studio/Projects/tasks/PE-09-batch/hermes_cli/web_dist/index.html)
 FAIL  src/shell/e1Contract.test.ts > E1 取证自报: 端口 + entry 文件名（L0 硬规矩） > verifies the acceptance face when both sides exist, skips not-deployed otherwise
 Test Files  1 failed | 533 passed (534)
      Tests  1 failed | 4083 passed (4084)
```

e1Contract 单列（环境漂移红，非本卡产品红；未修、未禁、未改）：

| 侧 | entry |
|---|---|
| 磁盘（本 worktree `vite build` 产物） | `assets/index-B5mh4VCx.js` |
| served（9122 在服脸） | `assets/index-BoWDBxUF.js` |

其余 533 件全绿，无第二枚红。

### 3.3 `cd web && node_modules/.bin/vite build`（禁 `pnpm run build`）

```
../hermes_cli/web_dist/assets/index-B5mh4VCx.js                        175.03 kB │ gzip:  56.01 kB
✓ built in 5.54s
BUILD_EXIT=0
```

### 3.4 `node web/scripts/lint-fake-success.mjs`

```
{
  "script": "lint-fake-success",
  "file": "docs/console-v4-skeleton.html",
  "linesScanned": 9252,
  "allowedInfo": { "规划中": 188, "不会保存": 1, "未接入": 22 },
  "violations": [],
  "ok": true
}
LINT_EXIT=0
```

violations=0。口径说明：该闸的扫描面是 `web/docs/console-v4-skeleton.html`（本卡未触该文件），新增 TSX 文案不在其射程；我仍按同一禁令写文案（未接入期上屏句只说「不发请求也不报成功」，回执句需真应答才出）。

### 3.5 `npx tsc --noEmit -p tsconfig.app.json`

```
TSC_EXIT=2
TOTAL=49
EMPLOYEES_DOMAIN=0
```

delta=0：49 错全在 `../apps/shared/src/*.test.ts` 与 `../apps/*` 预存面（13 file-url / 10 color / 3 json-rpc-gateway-replay / 3 fuzzy / 3 format / 2 json-rpc-channel / 1 slash / 1 slash-score …），写域 `src/modules/employees/**` 命中 0 行。基线同为 49（开工前实测）。

---

## 四、截图（真渲染，禁 stub）

- `/Users/kevin_studio/Projects/tasks/PE-09-batch/evidence/pe09-1440.png`（1440×900，mtime `Nov 24 03:44`，175127 B）
- `/Users/kevin_studio/Projects/tasks/PE-09-batch/evidence/pe09-375.png`（375×812，mtime `Nov 24 03:44`，77436 B）

形制承 `AP-01/evidence/ap01-shoot.mjs`：worktree `vite build` 产物 + 临时 `v4_proxy` 自选 loopback 端口 9153→9155（开工前 `lsof` 核对非 LISTEN；9122/9131/9141/9151/9153/9161/9162/9171/9172/9181/9183/9193/9195/9201/9311/9341/9351/9377 及一切在用端口避让）+ `/agent-api`→真 BFF 8092 + opsadmin `access_token_cookie` + `domcontentloaded` + `settle(2200)` + 每图前 `whoami==200`。脚本=`evidence/pe09-shoot.mjs`，原始读数=`evidence/pe09-shoot.log`，代理日志=`evidence/v4-proxy-9155.log`（按端口对应 pid 精杀，`kill 78354`/`kill 78505`，无宽匹配 pkill；9122 的 pid 41688 全程未动）。

```
  whoami status=200 user=opsadmin
  pe09-1440.png
    批量条读数=已选 2 / 3
    口径句=选择只在当前已加载的行内有效：翻页即清空，换筛选与刷新同样清空，不跨页记忆。 勾选与批量动作都不出屏上所见：共 3 人已加载， 其中 3 行可见、2 行已选。
    未接入原因句=流转写接口未接入（POST /api/employee-transition 现 405 console.read_only，等 T-PE-E）。按钮已禁用，点击不发请求也不报成功。
    分母披露=流转到「在岗 / 已暂停 / 离职中」计入可上岗率分母；「草稿 / 入职中 / 已归档」不入分母。
    流转钮 disabled=true aria-disabled=true
    scrollWidth=1440 clientWidth=1440 body=1440
    本次会话非 GET 请求数=0（零写请求）
  pe09-375.png
    …（同上读数）
    scrollWidth=375 clientWidth=375 body=375
    本次会话非 GET 请求数=0（零写请求）
```

拍到：行勾选态（前 2 行打勾）+ 批量动作条（全选本页/已选 2 / 3/复制所选/导出所选 CSV/目标态选择器/禁用的批量流转）+ 未接入原因句常驻上屏 + 分母披露 + 选择口径句；375 档 `scrollWidth=375` 无横向溢出。

---

## 五、写域与零越界核对（`git status --porcelain` 原文，add 之前）

```
 M web/src/modules/employees/EmployeesModulePage.tsx
?? DONE-PE-09.md
?? evidence/pe09-1440.png
?? evidence/pe09-375.png
?? evidence/pe09-curl.sh
?? evidence/pe09-shoot.log
?? evidence/pe09-shoot.mjs
?? evidence/raw-employees.json
?? evidence/raw-pe09-curl.txt
?? evidence/raw-post-employees-noccsrf.txt
?? evidence/raw-post-employees-nokey.txt
?? evidence/raw-post-transition-anon.txt
?? evidence/raw-post-transition-viaproxy.txt
?? evidence/raw-post-transition.txt
?? evidence/raw-whoami.json
?? evidence/v4-proxy-9153.log
?? evidence/v4-proxy-9155.log
?? web/src/modules/employees/employees-batch.ts
?? web/src/modules/employees/employees.batch.test.tsx
```

`evidence/**` 全部不入库（工单纪律）；`hermes_cli/web_dist/**` 是 `vite build` 产物，被 `.gitignore` 覆盖、不在 status 里。

`git diff --stat`：`web/src/modules/employees/EmployeesModulePage.tsx | 350 insertions(+), 2 deletions(-)`——删除的两行是原 `import` 行与 `mergeAppended` 注释行的改写，无功能删除。

---

## 六、偏差与未做（如实）

1. **DoD「接入后成功数=curl 逐单验证数」本卡兑现不了**：写路由 `POST /api/employee-transition` 现网未注册（§二 #2/#3 两腿 405 原文），按钮按工单④保持 disabled，聚合执行器 `runBatchTransitions` 只在 jsdom 函数级被注入 `post` 验形（§一③），**屏上无任何成功读数**。解除=等 T-PE-E 落地后把 `BATCH_TRANSITION_ENABLED`（`:37`）置真并跑实弹逐单核对。
2. **实弹写验证未做**（会改活体 3 名员工的 lifecycle）。按工单「不等合并验证、不造数」，本卡只交前端形制 + 禁用态；真弹腿归 T-PE-E 落地后的验收单。
3. **翻页清空腿在真机上不可拍**：现网读口 `items=3`、`nextCursor=null`（§二 #6）⇒ 真数据只有一页，截图里看不到「续页后清空」。该腿由 jsdom 两页桩数据钉（测试 §185-201，`PAGE1.nextCursor="pc-2"`→`PAGE2`），读数 `已选 1 / 2` → `已选 0 / 3` 有原始断言支撑。
4. **清空口径比工单更严**：工单只点名「翻页即清空」，我把换 keyword/lifecycle/部门桶与刷新也纳入同一清空腿（`:793-796`、`:804`）。原因=部门桶是前端本地过滤、不走取数腿，不清会把隐形行带着勾混进批量动作，与上屏口径句自相矛盾。测试 §202-212 钉住。
5. **目标态选择器在禁用期仍可交互**（只改本地 state、零请求），提交钮才禁用——与 PE-08 编辑抽屉（字段可填、保存钮 disabled）同形制；工单④只约束按钮。
6. **超出工单的加法一处**：未接入原因句除 `title` 外还常驻上屏（`:1362-1366`）。依据=PRD §8.3「title 承载关键说明，触屏无 hover」；不改 DOM 语义、不加请求。
7. **登记的跨卡口径债（本卡未动）**：既有在职态筛选器（`:1172-1178`）与 `lifecycleLabel`（`:237`，`suspended` 分支在 `:245`）仍把 `suspended`→「停用」当一档，而 `employee_models.py:102-108` 冻结六态里**没有** `suspended`。批量目标态已严格取六态（测试 §260-292 钉「启用/停用」命中 0），但读侧筛选器要一并收口才算清账——改它越 PE-09 写域（属 PE-02/PE-13 面），留待总控裁定。
8. **`evidence/raw-post-employees-nokey.txt` 是早期腿残留**：脚本改名后产物为 `raw-post-employees-noccsrf.txt`，旧文件留在 `evidence/`（不入库），逐字内容以 `raw-pe09-curl.txt` 为准。
9. **截图端口用过两枚**：9153（中途被外部 cancel 前的首轮）与 9155（收尾重跑，最终图即 03:44 这组）。两枚都是自选 loopback 空闲端口、按 pid 精杀，`evidence/v4-proxy-9153.log` 一并留存。
