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
