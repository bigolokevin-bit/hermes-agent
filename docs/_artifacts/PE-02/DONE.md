# PE-02 — 员工详情四区块参数名修复（越权显示级 bug）

- 分支 / 起点：`task/PE-02-detail-params` @ `648233693d`
- 改动面：`web/src/pages/EmployeeDetailPage.tsx`（+65 / −13）、新增 `web/src/modules/employees/employees.detail.sectionRequests.test.tsx`（186 行）
- 未改动：`web/src/pages/EmployeeDetailPage.test.tsx`（详见「与任务卡的三处偏差」§3）、`EmployeeDetailModulePage.tsx`（不在写域，且它本就已是正确口径）

---

## 1. Bug 现场（修复前，`pages/EmployeeDetailPage.tsx`）

四个 Tab 的 fetcher 把过滤参数拼成 BFF 不识别的裸 `employee=`（原文件 L241/253/265/277）：

```
L241  /agent-api/api/sessions?employee=${encodeURIComponent(rawId)}
L253  /agent-api/api/tasks?employee=${encodeURIComponent(rawId)}
L265  /agent-api/api/runs?employee=${encodeURIComponent(rawId)}
L277  /agent-api/api/audit?employee=${encodeURIComponent(rawId)}
```

BFF 白名单里没有 `employee`，未知参数被静默丢弃，于是两类后果同时发生：

| 区块 | 旧行为 | 后果 |
|---|---|---|
| 聊天 sessions | 200，但**无过滤** | 全租户会话列表当本人数据显示 |
| 任务 tasks | 200，但**无过滤** | 现网实证：`/api/tasks?employee=emp_86A81CE8FF6E…` 返回 20 条里 **10 条 assignee 是别人 `emp_0166858D5621…`** |
| 运行 runs | **400 `missing_filter`** | 永久错误块，本人运行记录一条也看不到 |
| 审计 audit | **400 `missing_filter`** | 同上 |

即「越权显示 + 真数据看不见」双重缺陷，且旧代码路径上没有任何归属校验（`Section` 只要 `ready && rows.length>0` 就直接渲染）。

## 2. 正确口径表（按任务卡给的现网 Bearer 实测形制，逐条对齐）

| 区块 | 修复后 URL | 现网结果 | 归属判据 |
|---|---|---|---|
| 聊天 | `/agent-api/api/sessions?employeeId=${enc}` | 200，过滤生效 | `items[].employeeId === 目标` |
| 任务 | `/agent-api/api/tasks?assignee=employee:${enc}&limit=20` | 200，只剩本人 | `items[].assignee = {type:"employee", id}` |
| 运行 | `/agent-api/api/runs?employeeId=${enc}&limit=20` | 200（旧参数名是 400 missing_filter） | `items[].employeeId === 目标` |
| 审计 | `/agent-api/api/audit?resourceId=${enc}&limit=50` | 200，实测 4472B（旧参数名是 400 missing_filter） | `events[].resource.id === 目标` |

编码形制说明：`assignee=employee:` 里的**冒号保持字面量**，只对 id 做 `encodeURIComponent`。理由——(a) 与任务卡「现网实测正确形制」和条款 4 要求钉死的字符串 `/api/tasks?assignee=employee:` 逐字一致；(b) 若整体编码成 `assignee=employee%3A…`，测试面与实证面就不是同一个串了。BFF 侧两种形制解码后等价。

**与 backlog 卡的偏差（务必记录）**：卡面写的审计口径是 `actorId=employee:{id}`，但现网 `actorId` 两种形制（带 / 不带 `employee:` 前缀）**都返回 0 条 events**；能取到该员工审计事件的是 `resourceId={id}`。本单按 `resourceId` 实现，与已交付分支 `task/Q12-people-tabs`（`EmployeeDetailModulePage.tsx:1022` 同形制）保持一致。

任务区块**未加** `status=all`：现 UI 无状态筛选控件，按任务卡「若无状态筛选就只加 assignee」执行。

## 3. 防串数据护栏（backlog 条款 3）

实现选型：**校验放在 fetcher（`useEmployeeList`），不在 Section 渲染层**——侵入最小（Section 只多一个 `employeeId` 透传 prop），且天然满足「绝不先渲染再替换」。

```
rows.every(row => rowOwner(row) === employeeId)
  命中违例 → setState({ k:"error", status:0, message:"返回数据不属于该员工，已停止显示以防串数据。" })
```

`rowOwner` 按现网三种形制取归属键：`employeeId` → `assignee`(对象 `.id`，兼容旧 `employee:xxx` 字符串) → `resource.id`；取不到即 `""`，判为不属于。**语义要点**：

- **整块转错误态，不做部分过滤**——「过滤掉别人的行、留下自己的」会把 BFF 的过滤失效伪装成页面正常，掩盖真缺陷；
- `status: 0`（无 HTTP 状态）→ 走 `ErrorStateBlock` 的**通用错误**分支而非 403/404 的「未开放/无权限」话术：请求本身是 200，坏的是数据归属；
- 空列表 `rows.length === 0` 时 `every` 恒真 → 仍是诚实空态「暂无聊天」，护栏不误伤（专门一条用例钉住）；
- 禁假 0 / 假成功：违例时 `li` 行数为 0 且必现 `role="alert"`。

配套渲染层兼容（条款 3 副产物）：`refLabel` 只认字符串，而现网 `tasks[].assignee` 是 `{type,id}` 对象，旧写法会把有指派的行显示成「未指派」。新增 `refValue()` 摊平对象引用，`TaskRow` 指派位与 `AuditRow` 操作者位各用一次；DOM 与字符串形制下的计算值保持等价。

## 4. 测试（条款 4，先红后绿）

基线与交付都是 `vitest run src/pages src/modules/employees`：**25 files / 182 tests 全绿**（基线 24 files / 174 tests；净增本单 8 条用例）。

先红证据（修复前，同一文件、同一命令 `vitest run src/modules/employees/employees.detail.sectionRequests.test.tsx`）：

```
× 聊天：sessions 只认 employeeId，且值就是该员工
× 运行：runs 用 employeeId + limit=20（旧裸参数在现网是 400 missing_filter）
× 任务：tasks 用 assignee=employee:{id} + limit=20
× 审计：audit 用 resourceId（现网 actorId 两种形制都 0 条，resourceId 才取得到）
× 四个区块都不再拼裸 ?employee=（BFF 忽略它 ⇒ 未过滤越权显示）
× 任务里混进别人的 assignee ⇒ 该他人任务绝不出现，区块转错误态
× 聊天整页是别人的数据 ⇒ 同样拒绝渲染
Tests  7 failed | 1 passed (8)

AssertionError: expected '/agent-api/api/sessions?employee=emp_…' to be '/agent-api/api/sessions?employeeId=em…'
AssertionError: expected '/agent-api/api/tasks?employee=emp_86A…' to be '/agent-api/api/tasks?assignee=employe…'
AssertionError: expected '/agent-api/api/audit?employee=emp_86A…' to be '/agent-api/api/audit?resourceId=emp_8…'
AssertionError: 裸 ?employee= 仍在使用: …sessions?employee=…, …tasks?employee=…, …runs?employee=…, …audit?employee=…
AssertionError: expected '任务（2）整理竞品拆解 · 1待处理指派：未指派—别人名下的任务 · X待…' not to contain '别人名下的任务'
AssertionError: expected '聊天（1）别人的会话 · 0166858D—消息 — 条' not to contain '别人的会话'
```

（唯一「passed」的那条是空态诚实用例——它不依赖修复，红/绿两侧都该过。）
注意倒数两条红：旧代码不仅显示别人的行，还把 `{type,id}` 对象 assignee 渲染成「未指派」，护栏 + `refValue` 一并堵住。

修复后关键 stdout：

```
✓ … > 聊天：sessions 只认 employeeId，且值就是该员工 25ms
✓ … > 运行：runs 用 employeeId + limit=20（旧参数名在现网是 400 missing_filter） 9ms
✓ … > 任务：tasks 用 assignee=employee:{id} + limit=20 5ms
✓ … > 审计：audit 用 resourceId（现网 actorId 两种形制都 0 条，resourceId 才取得到） 4ms
✓ … > 四个区块都不再拼裸 ?employee=（BFF 忽略它 ⇒ 未过滤越权显示） 7ms
✓ … > 任务里混进别人的 assignee ⇒ 该他人任务绝不出现，区块转错误态 6ms
✓ … > 聊天整页是别人的数据 ⇒ 同样拒绝渲染 4ms
✓ … > 空列表是诚实空态，不是护栏误伤 45ms
Test Files  1 passed (1)
      Tests  8 passed (8)
```

四条参数名用例都断**完整 URL 逐字相等**（`toBe`），不是「id 出现在 URL 里」这种能被裸 `?employee=` 蒙过的弱断言；再加一条全站 `[?&]employee=` 归零用例（`?employeeId=` / `assignee=employee:` / `resourceId=` 都不会误命中它，已验证）。

### 与任务卡的三处偏差

1. **卡上「L253/L265/L277 带 `&limit=20`」的旧 URL 与磁盘不符**：修复前四个 URL 都**没有** limit 参数，是裸 `?employee=`。不影响结论（参数名错才是根因），limit 按新口径补齐。
2. **`employees.detail.requests.test.tsx` L155-158 并不查 `?employee=`**：该文件（R213）测的是 **module 页** `EmployeeDetailModulePage`，断言的是「开详情恰 1 条读口 / 成功路径零矩阵回落」，与四个区块参数名无关；而 module 页早已是正确口径（`runs?employeeId=`、`audit?resourceId=&limit=50`、`tasks?assignee=employee:…&limit=20`）。**裸 `?employee=` 的 bug 只在 fallback 组件 `pages/EmployeeDetailPage.tsx`**——即 `App.tsx:342` 的真实路由 `/employees/:employeeId` 所挂的那个。因此「改这个文件的 L155-158」无法产出先红后绿（module 页侧本来就是绿的），改测错对象。按卡上「不够可新增测试文件」的授权，四参数名契约 + 越权护栏落进新文件 `employees.detail.sectionRequests.test.tsx`，仍写在 `modules/employees/` 写域内，且红→绿证据齐全。原 R213 文件一字未动，85/85 仍绿。
3. **`pages/EmployeeDetailPage.test.tsx` 无需同步口径**：它的 mock 分流用 `url.includes("employee=")`，修复后不再命中区块 URL，但三条用例的断言只覆盖概览文案与「运行 404 只降级自己那块」，都不依赖区块返回值（其 runs 分支先匹配 `/api/runs`），实测三条全绿，故未改动这个写域外文件。

## 5. 自检数字

| 命令 | 结果 |
|---|---|
| `vitest run src/modules/employees/employees.detail.sectionRequests.test.tsx`（修复前） | 7 failed / 1 passed ← 红 |
| `vitest run src/modules/employees/employees.detail.sectionRequests.test.tsx`（修复后） | 8 passed ← 绿 |
| `vitest run src/pages src/modules/employees`（交付） | **25 files / 182 passed** |
| 同上 `--exclude` 本单新增文件（= 写域外既有测试在产品改动后回归） | **24 files / 174 passed**，0 失败 ⇒ 护栏与参数名改动没有打破任何既有用例（窄口径基线 14 files / 85 passed 亦全绿） |
| `vitest run src/shell src/App`（写域外消费方回归，`ConsoleEmployeeDetailPage` fallback 等） | 14 files / 117 passed + 1 skipped，0 失败 |
| `tsc -b . --noEmit` | **49 errors = 基线 49**，零新增；49 条全在 `../apps/shared/src/*.test.ts` 的 `TS2307 Cannot find module 'vitest'`，与 web/src 无关（按 AGENTS.md：web 侧判 delta，不判 exit code） |
| `vite build` | **EXIT=0**，`✓ built` 命中 1 次（日志 `/tmp/pe02-build.log`） |
| `pnpm install` / `git commit` / `git push` | 未执行（按令） |

未跑：`scripts/check`（Python 侧 lint，本单零 Python 改动）；eslint 未单独跑（不在任务卡自检清单内，未擅自扩面）。
