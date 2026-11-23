# SE-06 · 会话面搜索 + 375 + a11y 收口（交付）

写域：`web/src/modules/sessions/`（看板 `task-lanes.json` 权威条目）
基线：`git ls-remote` + 显式 refspec fetch 现读 ⇒ `origin/lane/hermes-console` = **392be3ec1f1ff33fd72b1417517bebbb6dd782cd**

---

## 0. 基线与领工自证

```
$ cd /Users/kevin_studio/Projects/seakoi-agent-os-l0-board && scripts/task-lane.sh status SE-06 CODING
status SE-06 CODING                                             # CLAIM_EXIT=0
$ scripts/task-lane.sh get SE-06
{ "task": "SE-06", "slug": "会话搜索375收口", "branch": "task/SE-06-search-375",
  "worktree": "-", "session": "ses_e2336b084ffeb8",
  "write_scope": ["web/src/modules/sessions/"], "status": "CODING" }

$ git -C /Users/kevin_studio/Projects/forks/hermes-agent fetch origin '+refs/heads/lane/hermes-console:refs/remotes/origin/lane/hermes-console'
   29ad92208d..392be3ec1f  lane/hermes-console -> origin/lane/hermes-console   # FETCH_EXIT=0
$ git rev-parse refs/remotes/origin/lane/hermes-console
392be3ec1f1ff33fd72b1417517bebbb6dd782cd
$ git -C … ls-tree -r --name-only refs/remotes/origin/lane/hermes-console -- web/src/modules/sessions
web/src/modules/sessions/SessionsList.test.tsx
web/src/modules/sessions/SessionsList.tsx
web/src/modules/sessions/index.ts
web/src/modules/sessions/sessionsApi.ts        # SE-02 已进脸，SE-06 在其上扩
```

worktree：`/Users/kevin_studio/Projects/tasks/SE-06-search-375` @ `task/SE-06-search-375`（`--unset-upstream` 后建；node_modules 用符号链接指向 forks 对应目录，未安装依赖）。

## 1. 规格（backlog §SE-06 原文要点）

> 会话列表搜索（按 sessionId/员工内关键字）——上游无 q 参数：本卡先做**当前游标页内客户端过滤并标注「本页筛选」**（不谎称全局搜索），全局搜索列为 SE-05-B 同批后端提案；375 基线（详情抽屉全屏化、无横滚、44px）；a11y（抽屉焦点圈闭、消息列表 role=log、续跑表单 label）。

改动文件栏写的是 `EmployeeDetailModulePage.tsx` / `SessionDrawer` / 样式，但**看板写域更窄**（只 `web/src/modules/sessions/`）⇒ 本卡把能在写域内落的三项（本页筛选、375 列表口径、列表 a11y）落在 sessions 模块；抽屉焦点圈闭/`role=log`/续跑表单 label 属 `modules/employee-detail`，见 §5 移交。

## 2. 改动

| 文件 | 动作 | 内容 |
|---|---|---|
| `sessionsApi.ts` | +32 | 新增 `filterSessionRows(rows, query)`：sessionId / employeeId 大小写不敏感子串；空查询返回原引用；文档写明「本页筛选≠全局搜索」与上游白名单依据 |
| `SessionsList.tsx` | 改 | 筛选框（`se6-sessions-filter`）+ 作用域注记（`se6-sessions-scope-note`，aria-live）+ 本页无匹配态（`se6-sessions-filter-empty`）；`role="list"` / `role="listitem"` / 行 `aria-label` 全量 sessionId / `aria-busy` / `aria-controls` / `label htmlFor`；引入 `sessions.css` |
| `sessions.css` | 新 | 480px 断点：筛选框与按钮 `min-height: 44px`、宽度 100%（不撑横滚）；行 `min-width: 0` + `overflow-wrap: anywhere`；动作区窄屏纵排；**无** `overflow-x: auto/scroll` |
| `GLOBAL-SEARCH-PROPOSAL.md` | 新 | 后端提案：**「上游需加 q 或 search 端点」**（字面），A=加 q 参数 / B=独立 search 端点，需定匹配字段、作用域、排序上限、BFF 白名单；并入 SE-05-B |
| `SessionsList.test.tsx` | +80 | 新增 4 例（见 §3） |
| `index.ts` | 改 | 导出 `filterSessionRows` |

口径纪律：
- 过滤注记**不含**「搜索全部 / 全部会话」字样（有测试断言），且正面写明「全局搜索待后端支持（上游需加 q 或 search 端点）」。
- 本页筛选**不发新请求**（测试钉住 `fetchMock` 只被首屏调用 1 次）。
- 服务端空集（`se2-sessions-empty`「该员工暂无可查会话」）与本页无匹配（`se6-sessions-filter-empty`）严格分离。
- 缺值仍走 SE-02 口径：`null → 「—」`，`0 → 「0 条」`。

## 3. 测试原始输出

```
$ cd web && ./node_modules/.bin/vitest run src/modules/sessions --reporter=dot
 Test Files  1 passed (1)
      Tests  13 passed (13)
VITEST_EXIT=0                                     # 日志 …/opencode/se06-vitest2.log（SE-02 9 例 + 本次 4 例）
```

新增 4 例：
1. `按会话编号子串筛已加载行，注记明写「本页筛选」与上游缺口`（大小写不敏感；`fetchMock` 仍 1 次；断言不含「搜索全部/全部会话」）
2. `筛不到时给「本页无匹配」而非服务端空集，清空筛选后行回来`
3. `a11y：列表有 role=list、行有 aria-label 全量编号、注记 aria-live、筛选框有 label`
4. `sessions.css 声明 480px 断点与 44px 触控目标，且行允许换行不撑宽`（静态断言 css 文本；jsdom 下 `import.meta.url` 非 file 协议，改用 `process.cwd()`）

全量回归：

```
$ ./node_modules/.bin/vitest run --reporter=dot
 Test Files  541 passed (541)
      Tests  4166 passed | 1 skipped (4167)
FULL_EXIT=0                                       # 日志 …/opencode/se06-full.log（45.15s）
```

## 4. 375 与 a11y 取证

| 项 | 状态 | 证据 |
|---|---|---|
| 375 无横滚 / 44px 触控 | **样式级取证**（静态断言 + css 原文） | `sessions.css`：`@media (max-width: 480px)` 内 `min-height: 44px`、`width: 100%`、`box-sizing: border-box`；行 `min-width:0` + `overflow-wrap:anywhere`；无 `overflow-x: auto/scroll` |
| 375 两态截图 | **NOT MEASURED** | 唯一登录态 `~/.local/state/sekoi-ops/ui-qa-auth-state.json` 的 JWT `exp=2026-11-23T01:12:26Z` 已过期（当前 2026-11-24），`whoami` 恒 401；本机无 opsadmin 凭据、viewer01 无控制台入口权限 ⇒ 无法签新 cookie。匿名态只能看到登录门，不构成组件证据 |
| 列表 a11y | 已实现 + 测试 | `role=list` / `role=listitem` / `aria-busy` / `aria-controls` / `aria-live=polite` / `label htmlFor` / 行 `aria-label` 全量 sessionId |
| 抽屉焦点圈闭、消息列表 `role=log`、续跑表单 label | **移交** | 均在 `modules/employee-detail`（写域外），见 §5 |

## 5. 移交（写域外，如实点名）

1. **页面接线**：`EmployeeDetailModulePage.tsx` 的会话区仍是自带 `SessionsZone`；接 `import { SessionsList } from "@/modules/sessions"` 后即可获得本卡全部行为（SE-02 已说明同一接线点）。
2. **抽屉 a11y**：焦点圈闭（Tab 循环 + 初始焦点 + Esc 关闭后回焦）、消息列表 `role="log" aria-live="polite"`、续跑表单 fieldset/label —— 属 `SessionDrawer` 与员工详情表单，归页面车道。
3. **全局搜索**：见 `GLOBAL-SEARCH-PROPOSAL.md`；落地需 runtime console-sessions 面加 `q` 或 search（L2-dataplane）+ BFF 白名单放行（L7）。

## 6. 边界自查

```
$ git status --porcelain
（见 §7 的提交清单；除下列 6 项外无改动）
```
未触碰：`modules/employee-detail/**`、`web/src/lib/**`、`pages/**`、其它 `Projects/tasks/*` worktree；未安装依赖、未改构建配置。

## 7. 交付

- 分支：`task/SE-06-search-375`
- 基线：`392be3ec1f1ff33fd72b1417517bebbb6dd782cd`
- 提交清单（显式路径）：`web/src/modules/sessions/{sessionsApi.ts,SessionsList.tsx,SessionsList.test.tsx,index.ts,sessions.css,GLOBAL-SEARCH-PROPOSAL.md}` + `DONE-SE-06.md`
- tip sha 与 `ls-remote` 回读见会话回执（文档不能内嵌自身提交 sha，此节不预勾）。
