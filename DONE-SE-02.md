# SE-02 · 会话区真列表件 交付

写域：`web/src/modules/sessions/`（看板 `task-lanes.json` SE-02 条目 `write_scope`）
基线：`origin/lane/hermes-console` @ `29ad92208de1b0d75cdec3dde6797ded091509dd`（当拍 `ls-remote` 现读，非旧 tracking ref）

---

## 0. 基线与新鲜度自证

```
$ git ls-remote origin refs/heads/lane/hermes-console
29ad92208de1b0d75cdec3dde6797ded091509dd	refs/heads/lane/hermes-console
$ git worktree add /Users/kevin_studio/Projects/tasks/SE-02-sessions-list -b task/SE-02-sessions-list origin/lane/hermes-console
$ git rev-parse --abbrev-ref HEAD && git rev-parse HEAD
task/SE-02-sessions-list
29ad92208de1b0d75cdec3dde6797ded091509dd
$ git status --porcelain
（空）
```

依赖未安装，沿用符号链接（禁 `npm install`）：`node_modules → forks/hermes-agent/node_modules`、`web/node_modules → forks/hermes-agent/web/node_modules`。

---

## 1. 工单现状盘点（原始输出）

```
$ ls web/src/modules/sessions 2>&1
ls: web/src/modules/sessions: No such file or directory     # 写域目录此前不存在

$ grep -rn "console-sessions" web/src/modules/employee-detail/EmployeeDetailModulePage.tsx
1033:  … `zone === "sessions" && empId ? \`/agent-api/api/console-sessions?employeeId=${enc}&limit=20\` : ""`
1038:  … chat 区 `/api/console-sessions?...&limit=5`
1182:  … <SessionsZone resource={sessions} … />

$ grep -n "_NOT_WIRED\|console-sessions" apps/console/server.py（sekoi-agent-os 主仓）
555:   spec"/api/console-sessions"（白名单 employeeId/limit/cursor → 上游 GET /v1/console-sessions）
787:   CONSOLE_SESSIONS_PREFIX = "/api/console-sessions/"
927-960: 详情 GET → /v1/console-sessions/{sessionId}；POST → …/{sessionId}/messages
```

实况：**BFF 的 console-sessions 路由族已具备**（列表/详情/发消息，白名单只放 `employeeId`/`limit`/`cursor`；`offset`/`sort` 等被拒），员工详情页**已在发真请求**，但页面自己那套 resource 只渲染 GAP 悬停文案（「本代次部署面整体返回 200/0，筛前筛后都没有行可对照」），没有真行列表件、没有游标「加载更多」、缺值处没有统一「—」。

---

## 2. 改动（全部在写域内，新增 4 文件）

| 文件 | 作用 |
|---|---|
| `web/src/modules/sessions/sessionsApi.ts` | 读口封装：`CONSOLE_SESSIONS_URL="/agent-api/api/console-sessions"`、`buildSessionsUrl`（只白名单 employeeId/limit/cursor，limit 夹 1..100，cursor 去空白）、`parseSessionsPage`（严格：非对象/非数组/缺 sessionId 即抛；`optCount` 只认有限数，`"0"`/`null`/缺键 → null，绝不折 0）、`fetchSessionsPage`、`shortSessionId`（前 6+…+后 6）、`formatSessionTime`（zh-CN + Asia/Shanghai 到分钟，非法 → —）、`formatMessageCount`（null → —，0 → "0 条"）、`MISSING_PLACEHOLDER="—"` |
| `web/src/modules/sessions/SessionsList.tsx` | 自读列表件（props `{employeeId, pageSize?}`）：首屏 loading → 真行（短 sessionId / 更新时间 / 消息数）；有 `nextCursor` 才出「加载更多」，续页按 sessionId 去重追加；迟发响应用单调令牌丢弃；续页失败保留已加载行并给局部告警；空集「该员工暂无可查会话」与失败态分离；**404/501 → 显式「未接入」零样例**；401 登录态提示、403 无权限态；错误态带 `requestId`；空 employeeId 不发请求 |
| `web/src/modules/sessions/SessionsList.test.tsx` | jsdom + `vi.mock("@/modules/models/fetchJson")`，9 例（见 §3） |
| `web/src/modules/sessions/index.ts` | 公开导出 + 页面接线说明 |

**未改动任何既有文件**（含 `EmployeeDetailModulePage.tsx`：页面接线属 `modules/employee-detail/`，不在本卡写域）。

### 页面接线（交页面车道，一行）

```tsx
import { SessionsList } from "@/modules/sessions";
<SessionsList employeeId={empId} />
```

替换 `EmployeeDetailModulePage.tsx:1182` 的 `<SessionsZone resource={sessions} … />` 即可；页面自己那条 `limit=20` 的 resource 可同时下线，避免双拉。

---

## 3. 测试与构建（原始输出）

```
$ cd web && ./node_modules/.bin/vitest run src/modules/sessions --reporter=dot
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  433ms
VITEST_MODULE_EXIT=0
```

9 例覆盖：
1. URL 只带白名单参数（无 offset/total/sort）；`limit=500` 被夹到 100；cursor 两端空白被 trim
2. `parseSessionsPage` 严格：非对象、items 非数组、缺 sessionId 均抛
3. 缺值口径：`messageCount: null` → 「—」、`messageCount: 0` → 「0 条」、缺 `updatedAt` 键 → 「—」、非法时间 → 「—」、`shortSessionId`
4. 真行渲染：三行按序、标题 title=完整 id、按钮仅在 `nextCursor` 非空时出现
5. 上游缺键行（无 updatedAt / 无 messageCount）→ 两个「—」，不折 0
6. 「加载更多」：追加且去重，末页（nextCursor 为空）按钮收起，第二次请求 URL 带 `cursor=cur-1`
7. 空集（`items: []`）→ 「暂无可查会话」，与失败态分离；失败 → 可重试并恢复
8. 404 → 「未接入」零样例行；401 → 登录态；403 → 无权限
9. 空 `employeeId` → 不发请求

全量回归：

```
$ cd web && ./node_modules/.bin/vitest run --reporter=dot
 Test Files  514 passed (514)
      Tests  3797 passed | 1 skipped (3798)
   Duration  46.27s
VITEST_FULL_EXIT=0
```

（基线现脸 510 files / 3769 tests；本模块 +4 files / +18 tests，与新增相符。）

类型检查：

```
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
TSC_EXIT=2
error TS… 共 49 条，**全部在 ../apps/shared/**（`Cannot find module 'vitest'` 等），零条命中 src/modules/sessions/**
```

即 `tsc` 红是符号链接 node_modules 下的类型解析历史问题（共享包看不到 vitest 类型），与本次改动无关；本模块新文件无类型错误。如实登记，不声称「类型全绿」。

---

## 4. 未接与缺值口径（DoD 对照）

| 场景 | 表现 |
|---|---|
| BFF 404 / 501（读口未接） | 显式「本环境未接入会话读口」+ 不渲染任何样例行 |
| 401 / 403 | 「会话已过期，请重新登录」/「当前账号无权限查看」 |
| 接口失败 | 「会话读取失败」+ 重试按钮 + requestId |
| 空集 | 「该员工暂无可查会话」（与失败区分） |
| `messageCount` / `updatedAt` 缺失 | 「—」，**绝不折 0、绝不编时间** |
| 续页失败 | 保留已加载行 + 「更多会话读取失败」局部告警 |

无任何 fixture/样例数据：唯一数据来源是 `fetchJsonStrict("/agent-api/api/console-sessions?employeeId=…&limit=…[&cursor=…]")`。

---

## 5. 边界自查

```
$ git status --porcelain
?? DONE-SE-02.md
?? web/src/modules/sessions/
```

未触碰其它 `tasks/*` worktree、未安装依赖、未改构建配置、未碰现网服务。

---

## 6. 交付

- 分支：`task/SE-02-sessions-list`，基线 `29ad9220…`（见 §0）
- 提交 message：`feat(sessions): real session list with cursor paging for employee detail`
- push：`git push origin task/SE-02-sessions-list:refs/heads/task/SE-02-sessions-list`
- 推送后 tip sha 与 `ls-remote` 回读见会话回执（本文档不内嵌自身提交 sha）。

### 遗留（点名归属）

1. **页面接线**：`modules/employee-detail/EmployeeDetailModulePage.tsx:1182` 换成本组件，属页面车道写域。
2. **tsc 全量红**：`apps/shared` 在符号链接 node_modules 下的 vitest 类型解析问题，属构建/依赖面，非本卡。
3. **会话区真数据可验收前置**：需要受管 BFF 与运行时 console-sessions 读口在同一次部署里（BFF 代理已具备，运行时侧见 CONSOLE-SESSIONS-SHAPE.md）。