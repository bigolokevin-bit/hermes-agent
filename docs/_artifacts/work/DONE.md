# DONE — lane/console-work · T14 任务板

- Repo: `/Users/kevin_studio/Projects/forks/console-work`
- Branch: `lane/console-work` (base `origin/lane/hermes-console` @ `7dd07981`)
- Scope: `web/src/modules/tasks/**`, `docs/_artifacts/work/**` only. No App/routes/registry/tokens/package.json changes.
- Status: **T14 delivered** (read-only board + detail). T15 runs (runs list/detail/events) is next in this lane.

## What changed

- `TasksBoardModulePage.tsx`: five real phases (loading / ready / empty / error / denied), five backend status columns
  (`open / in_progress / blocked / done / cancelled`), no drag or transition write — the board cannot report a state
  the backend did not confirm. Cards open a read-only detail panel.
- `tasksBoard.ts`: `/agent-api/api/tasks?status=…&limit=50` (one call per column) and
  `/agent-api/api/task-detail?id=…`; Chinese error copy; request id preserved; missing values `—`;
  actor labels never show bare `emp_` / `human:` ids; Beijing time to minute.
- `TasksBoardModulePage.test.tsx`: 5 phases, five columns, detail fetch, 500 request id + retry,
  no bare ids, no HTTP codes.

## Commands + raw output

```bash
$ cd /Users/kevin_studio/Projects/forks/console-work
$ git rev-parse --show-toplevel
/Users/kevin_studio/Projects/forks/console-work
```

```bash
$ PATH="/opt/homebrew/bin:$PATH" pnpm --filter web build
...
✓ built in 2.12s
built /Users/kevin_studio/Projects/forks/console-work/hermes_cli/web_dist/index.html
# EXIT: 0
# assets: 54 files / 2.8M (dist total 3.5M)
```

```bash
$ cd web && pnpm exec vitest run src/modules/tasks
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

```bash
# screenshot harness (temporary preview file removed after capture; no preview file committed)
# 1440 viewport / 375 viewport metrics:
{"w":375,"h":812,"sw":375,"bw":375,"cols":5}
# document.scrollWidth == 375 → no horizontal overflow; 5 status columns present
```

## Screenshots

- `docs/_artifacts/work/shots/t14-1440.png`
- `docs/_artifacts/work/shots/t14-375.png`

The screenshot page used a local dev-only preview harness (mocked BFF 200) because the shell registry is still
stage-1 `planned`; the module is not yet mounted into `#/work` by the shell lane (write-domain boundary).
The preview harness was deleted before commit. When the shell lane mounts the board, the same component reads
the real BFF.

## Honest gaps

- Not yet mounted in the shell: `web/src/shell/registry.ts` / `ConsoleModulePage` still render a planned pane for
  `#/work`; mounting belongs to the shell lane (App/routes/registry are outside this lane's write domain).
- No task create or status transition controls: write routes are not opened; buttons are intentionally absent
  rather than showing a fake success.
- 5 columns are loaded with `limit=50` each; the footer states this is the loaded page, not a full total.
- Screenshots are dev-preview with a mocked 200 response; real BFF 200 was not available in this worktree.

## Next in lane

- T15: runs list + detail (`/api/runs`, `/api/run-detail`, `/api/run-events`), 400 status readings, four states,
  Beijing time, missing `—`, no raw employee ids.

---

# T15 — 运行列表 + 只读详情（同分支第二交付）

- Scope: `web/src/modules/runs/**` only; no App/routes/registry/tokens changes.
- Source: `GET /agent-api/api/runs?since=&status=&limit=&cursor=`, `GET /agent-api/api/run-detail?id=`,
  `GET /agent-api/api/run-events?runId=&limit=50`.
- Behaviour: list filters by status and 24h/7d/30d; row click opens read-only detail + event timeline.
  `400` is rendered as「这次筛选没有被接受，请调整状态或时间范围后重试」with request id, never an empty list.
  Cost missing → `—`; `reasonCode` and event types are humanized; unknown values stay `其他事件`/`—`.
  No retry/cancel write control is rendered (write routes are outside this lane).

## T15 commands + raw output

```bash
$ PATH="/opt/homebrew/bin:$PATH" pnpm --filter web build
✓ built in 2.29s
built /Users/kevin_studio/Projects/forks/console-work/hermes_cli/web_dist/index.html
# EXIT: 0
# assets: 55 files / 2.8M (dist total 3.5M)
$ grep -o "runs-table" hermes_cli/web_dist/assets/RunsModulePage-*.js
runs-table
```

```bash
$ cd web && pnpm exec vitest run src/modules/runs
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

```bash
# 375 viewport metrics after opening a run:
{"w":375,"sw":375,"detail":true,"events":3}
# document.scrollWidth == 375 → no horizontal overflow
```

## T15 screenshots

- `docs/_artifacts/work/shots/t15-1440.png`
- `docs/_artifacts/work/shots/t15-375.png`

## T15 honest gaps

- Runs module is not yet mounted in the shell: `ConsoleRunsAdapter` probes `modules/runs/RunsModulePage.tsx`
  and will front `/runs` once the shell lane lands; App/routes/registry are outside this lane.
- Screenshots use the temporary dev preview with a mocked 200 response; preview file was deleted before commit.
- Cursor reads beyond the first 30 rows are shown as「还有更多」text, not silently paginated; a load-more
  control belongs to the next pass.
- Live BFF 200 / real 400 fixture was not available in the worktree; 400 rendering is covered by vitest.

---

# T15 深化 — costStatus / upstream 深链 / ToolIntent / 重试语义

- ① 成本三态：`known`（upstream/estimated/mixed）显示金额 +「已计价」徽章；`unknown` 与 `missing`
  强制显示 `—`，并给出可见原因（账本无计价记录 / 服务未返回计价状态），不显示 0、不空白。
- ② `upstreamRunId` 深链：详情内为真实链接 `/runs?upstream=<id>`，落地页展示上游编号与说明；
  不是 `#` 死链。上游运行时没有可复用的详情 UI，页面不伪造上游数据。
- ③ 时间线：`tool_result` 事件读 `payload.resultRef`；有值显示短引用，缺失显式「未记录」。
- ④ 重试：只显示禁用的「重试（新建运行）」，文案写明会生成新 runId、绝不复用本条；写入接口未开放，
  不发送假成功请求。
- ⑤ 四态：loading / empty / error（请求号+重试）/ denied（403/404 同体），400 另有人话说明。
- ⑥ 375：`document.scrollWidth=375`，详情与表格均无横向溢出。

## T15 深化命令 + 原始输出

```bash
$ PATH="/opt/homebrew/bin:$PATH" pnpm --filter web build
✓ built in 2.30s
built /Users/kevin_studio/Projects/forks/console-work/hermes_cli/web_dist/index.html
# EXIT: 0
# assets: 55 files / 2.8M
$ cd web && pnpm exec vitest run src/modules/runs
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

```bash
# 375 viewport after opening a run:
{"w":375,"sw":375,"detail":true,"events":5}
```

截图已覆盖更新：`docs/_artifacts/work/shots/t15-1440.png`、`t15-375.png`。

## T15 深化诚实缺口

- 上游运行没有详情页可用，② 的深链落在本控制台的真实 `?upstream=` 路由，而不是外部上游详情；
  若要跳 Hermes 运行时原生详情，需要新增上游 UI 路由（不在本车道写域）。
- ④ 仍是禁用态：BFF 没有 `POST /runs` 写路由；等 D 打开后才可真正新建 Run。
- 截图使用临时 dev preview + mock 200，preview 文件已删除；真实 BFF 200 未取。
