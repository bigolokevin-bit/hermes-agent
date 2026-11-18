# lane-D first-hour gates — raw evidence

- worktree: `/Users/kevin_studio/Projects/forks/hermes-agent`
- branch: `lane/hermes-console`  HEAD: `493388af3f4b469f80e702d7df238c54b59753d1`
- node: `v24.22.0` (`node -v` current; no nvm switch needed)
- captured at: `2026-11-18T15:11:10Z`
- cwd for every command: the repo root. The scripts resolve paths from their own location (`import.meta.url` -> `web/`), so repo-root invocation matches the brief exactly.
- `command -v just` at capture time: `/opt/homebrew/bin/just`  |  `just --version`: `just 1.59.0`
- `@playwright/test` / `playwright` are NOT dependencies of this fork -> the browser legs below are TOOL_MISSING, not failures.

## Headline results (values read back out of the raw logs below)

| # | command | exit | raw signal |
|---|---------|------|------------|
| 1 | `node web/scripts/assert-ia.mjs` | 1 | Error: ENOENT: no such file or directory, open '/Users/kevin_studio/Projects/forks/hermes-agent/web/docs/console-v4-skeleton.html' — the HTML baseline cannot run in this fork (no `web/docs/console-v4-skeleton.html`); behaviour is byte-for-byte the upstream script |
| 2 | `node web/scripts/assert-ia.mjs --source=react` | 1 | digest: `{"ok":false,"mode":"react","routes":51,"tabs":5,"chatHosts":3,"modules":6,"badCode":[],"missing":[]}` |
| 3 | `node web/scripts/crawl-routes.mjs --base http://127.0.0.1:9119` | 1 | TOOL_MISSING — Error: Cannot find module 'playwright' (9119 itself answers HTTP 200) |
| 4 | `node web/scripts/lint-fake-success.mjs` | 1 | Error: ENOENT: no such file or directory, open '/Users/kevin_studio/Projects/forks/hermes-agent/web/docs/console-v4-skeleton.html' — same missing HTML file as gate 1 |
| 5 | `node web/scripts/lint-reuse.mjs` | 1 | `violations=5` — JSON mirrored to `docs/_artifacts/tonight/lint-reuse.json` |

## 1-assert-ia-html

```
$ node web/scripts/assert-ia.mjs
--- stdout ---
--- stderr ---
node:fs:483
    return binding.readFileUtf8(path, stringToFlags(options.flag));
                   ^

Error: ENOENT: no such file or directory, open '/Users/kevin_studio/Projects/forks/hermes-agent/web/docs/console-v4-skeleton.html'
    at readFileSync (node:fs:483:20)
    at file:///Users/kevin_studio/Projects/forks/hermes-agent/web/scripts/assert-ia.mjs:67:14
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/Users/kevin_studio/Projects/forks/hermes-agent/web/docs/console-v4-skeleton.html'
}

Node.js v24.22.0
--- exit code ---
1
```

## 2-assert-ia-react

```
$ node web/scripts/assert-ia.mjs --source=react
--- stdout ---
{
  "script": "assert-ia",
  "mode": "react",
  "file": [
    "web/src/shell/routes.ts",
    "web/src/modules/*/manifest.ts"
  ],
  "sources": {
    "routesTs": true,
    "routeForm": "hash-rows",
    "manifests": [
      "web/src/modules/board/manifest.ts",
      "web/src/modules/chat/manifest.ts",
      "web/src/modules/duty/manifest.ts",
      "web/src/modules/employee-detail/manifest.ts",
      "web/src/modules/matrix/manifest.ts",
      "web/src/modules/runs/manifest.ts"
    ],
    "scannedFiles": 22,
    "chatHostMarkers": [
      "web/src/modules/chat/ChatModulePage.test.tsx attrs=2 mounts=0",
      "web/src/modules/chat/ChatModulePage.tsx attrs=0 mounts=1"
    ]
  },
  "missing": [],
  "counts": {
    "routes": 51,
    "tabs": 5,
    "chatHosts": 3,
    "modules": 6
  },
  "badCode": [],
  "checks": [
    {
      "name": "routes",
      "ok": true,
      "actual": 51,
      "expected": 51
    },
    {
      "name": "tabs",
      "ok": false,
      "actual": 5,
      "expected": 22
    },
    {
      "name": "chatHosts",
      "ok": false,
      "actual": 3,
      "expected": 1
    },
    {
      "name": "modules",
      "ok": false,
      "actual": 6,
      "expected": 8
    },
    {
      "name": "badCode",
      "ok": true,
      "actual": [],
      "expected": []
    }
  ],
  "ok": false
}
{"ok":false,"mode":"react","routes":51,"tabs":5,"chatHosts":3,"modules":6,"badCode":[],"missing":[]}
--- stderr ---
--- exit code ---
1
```

## 3-crawl-routes

```
$ node web/scripts/crawl-routes.mjs --base http://127.0.0.1:9119
--- stdout ---
--- stderr ---
node:internal/modules/cjs/loader:1564
  const err = new Error(message);
              ^

Error: Cannot find module 'playwright'
Require stack:
- /Users/kevin_studio/Projects/forks/hermes-agent/web/scripts/crawl-routes.mjs
    at Module._resolveFilename (node:internal/modules/cjs/loader:1564:15)
    at wrapResolveFilename (node:internal/modules/cjs/loader:1118:27)
    at defaultResolveImplForCJSLoading (node:internal/modules/cjs/loader:1142:10)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1169:12)
    at Module._load (node:internal/modules/cjs/loader:1341:5)
    at wrapModuleLoad (node:internal/modules/cjs/loader:261:19)
    at Module.require (node:internal/modules/cjs/loader:1674:12)
    at require (node:internal/modules/helpers:157:16)
    at file:///Users/kevin_studio/Projects/forks/hermes-agent/web/scripts/crawl-routes.mjs:16:22
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    '/Users/kevin_studio/Projects/forks/hermes-agent/web/scripts/crawl-routes.mjs'
  ]
}

Node.js v24.22.0
--- exit code ---
1
```

## 4-lint-fake-success

```
$ node web/scripts/lint-fake-success.mjs
--- stdout ---
--- stderr ---
node:fs:483
    return binding.readFileUtf8(path, stringToFlags(options.flag));
                   ^

Error: ENOENT: no such file or directory, open '/Users/kevin_studio/Projects/forks/hermes-agent/web/docs/console-v4-skeleton.html'
    at readFileSync (node:fs:483:20)
    at file:///Users/kevin_studio/Projects/forks/hermes-agent/web/scripts/lint-fake-success.mjs:22:13
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/Users/kevin_studio/Projects/forks/hermes-agent/web/docs/console-v4-skeleton.html'
}

Node.js v24.22.0
--- exit code ---
1
```

## 5-lint-reuse

```
$ node web/scripts/lint-reuse.mjs
--- stdout ---
violations=5
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: 对话 ChatPage（modules/ 内现有 reuse: 标记 0 处）
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: 运行详情 RunDetailPage（modules/ 内现有 reuse: 标记 0 处）
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: 任务看板 TasksListPage（modules/ 内现有 reuse: 标记 0 处）
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: schema 表单 AutoField（modules/ 内现有 reuse: 标记 0 处）
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: 能力矩阵 /v1/matrix/employees 数据口（modules/ 内现有 reuse: 标记 0 处）
{
  "script": "lint-reuse",
  "root": "web/src/modules",
  "scanned": 20,
  "reuseMarkers": 0,
  "chatHostFiles": [],
  "violations": [
    {
      "file": "web/src/modules",
      "line": 0,
      "rule": "reuse-marker-incomplete",
      "message": "五处复用标记缺一：未见 reuse: 对话 ChatPage（modules/ 内现有 reuse: 标记 0 处）"
    },
    {
      "file": "web/src/modules",
      "line": 0,
      "rule": "reuse-marker-incomplete",
      "message": "五处复用标记缺一：未见 reuse: 运行详情 RunDetailPage（modules/ 内现有 reuse: 标记 0 处）"
    },
    {
      "file": "web/src/modules",
      "line": 0,
      "rule": "reuse-marker-incomplete",
      "message": "五处复用标记缺一：未见 reuse: 任务看板 TasksListPage（modules/ 内现有 reuse: 标记 0 处）"
    },
    {
      "file": "web/src/modules",
      "line": 0,
      "rule": "reuse-marker-incomplete",
      "message": "五处复用标记缺一：未见 reuse: schema 表单 AutoField（modules/ 内现有 reuse: 标记 0 处）"
    },
    {
      "file": "web/src/modules",
      "line": 0,
      "rule": "reuse-marker-incomplete",
      "message": "五处复用标记缺一：未见 reuse: 能力矩阵 /v1/matrix/employees 数据口（modules/ 内现有 reuse: 标记 0 处）"
    }
  ],
  "count": 5,
  "ok": false
}
--- stderr ---
--- exit code ---
1
```

## 6-commit-hook-blocked

```
$ git commit -m "feat(console): lane-D verification scripts, lint-reuse, e2e specs and first-hour gate artifacts"
--- stdout+stderr (verbatim, lefthook ANSI escapes preserved) ---
[38;2;56;56;56m╭─────────────────────────────────────────╮[m
[38;2;56;56;56m│[m 🥊 lefthook  v2.2.1   hook:  [1mpre-commit[m [38;2;56;56;56m│[m
[38;2;56;56;56m╰─────────────────────────────────────────╯[m
│  lint python (skip) no files for inspection
┃  lint web ❯ 
sh: just: command not found

exit status 127
│  lint bootstrap installer (skip) no files for inspection
│  lint desktop app (skip) no files for inspection
│  lint tui (skip) no files for inspection
│  lint shared (skip) no files for inspection
│  lint tests (skip) no files for inspection
[38;2;56;56;56m  ────────────────────────────────────[m
summary: (done in 0.00 seconds)
🥊 lint web (0.00 seconds)
--- exit code ---
1

--- git log after attempt (unchanged HEAD => no commit created) ---
6fc0bfd4 feat(console): chat module on upstream host

--- root cause: pre-commit job "lint web" shells out to just, which is not installed ---
$ command -v just
$ for p in /opt/homebrew/bin/just /usr/local/bin/just ~/.cargo/bin/just /usr/bin/just; do [ -x "$p" ] && echo FOUND $p; done
(no output: just absent everywhere on PATH and in the usual install prefixes)
$ grep -n -A2 "^eslint" justfile
203:eslint +files:
204-    pnpm exec eslint "$@"

--- equivalent lint run on the exact lane-D files (this is what the job would have checked) ---
$ cd web && pnpm exec eslint e2e/ia-smoke.spec.ts e2e/density.spec.ts scripts/assert-ia.mjs scripts/lint-fake-success.mjs scripts/crawl-routes.mjs scripts/lint-reuse.mjs; echo ESLINT_EXIT=$?
ESLINT_EXIT=0
```

## e2e specs (delivered; run leg TOOL_MISSING)

- `web/e2e/ia-smoke.spec.ts` — 8 modules x 22 visible tabs (the `visible: true` rows of `web/src/shell/routes.ts` CONSOLE_TABS), hash routes off `http://127.0.0.1:9119`, first probe `/#/overview`; console errors asserted = 0; four-state per pane asserted with a deliberately loose selector because lane A has not pinned `data-state` yet; totals asserted 8/8 modules and 22/22 tabs.
- `web/e2e/density.spec.ts` — the same 22 tabs at 1440x900, 1280x720, 375x667; asserts `document.documentElement.scrollWidth <= window.innerWidth` with 1px slack (same tolerance as crawl-routes.mjs).
- Verification actually performed on them (no dependency added):
  - `web/node_modules/.bin/tsc --ignoreConfig --noEmit --noResolve --skipLibCheck` over both specs: the only diagnostics are the absent `@playwright/test` types and the `process` global, i.e. the missing dependency itself; no syntax errors.
  - `node_modules/.bin/eslint` (from `web/`, repo eslint.config.js) over both specs + both new scripts: exit 0, no findings.
- `npx playwright test` was NOT attempted; `@playwright/test` is not in package.json and adding it is out of this lane (package.json/pnpm-lock are read-only here).

## Files written by lane-D (write domain only)

- `web/scripts/assert-ia.mjs` (verbatim copy + `--source=react` extension)
- `web/scripts/crawl-routes.mjs` (verbatim copy)
- `web/scripts/lint-fake-success.mjs` (verbatim copy)
- `web/scripts/lint-reuse.mjs` (new)
- `web/e2e/ia-smoke.spec.ts`, `web/e2e/density.spec.ts` (new)
- `docs/_artifacts/D/1-assert-ia-html.txt` … `5-lint-reuse.txt` (five raw gate logs) and `docs/_artifacts/D/DONE.md` (this file). `docs/_artifacts/D/6-commit-hook-blocked.txt` was a hook-failure transcript from the `just` outage: it was never committed and has since been deleted (see the `T00 收口 + T02` section below).
- `docs/_artifacts/tonight/lint-reuse.json` (written by `lint-reuse.mjs` itself)

## Commit status at capture time

Attempt 1, before the toolchain fix: `git commit` exited 1. The lefthook pre-commit job `lint web` runs `just eslint {staged_files}` and `just` was not installed then (`command -v just` and the usual install prefixes were all empty). The verbatim hook output is reproduced in the `## 6-commit-hook-blocked` section below; the standalone log file stays local and is not part of this commit.
No bypass was used in any attempt: no `--no-verify`, no `LEFTHOOK=0`, no `--amend`, no `git push -f`, no hook-file edit.
That hook log is deliberately NOT part of the committed set: a hook-failure transcript is local evidence, not a deliverable. Same rule applies to any later one.
The lint the job would run is clean either way: the job is a thin wrapper over `pnpm exec eslint "$@"` (justfile:203-204), and that command, run on exactly lane D's six source files, returns exit 0 with no findings.
After `just` became available the commit was retried with the hook running normally; whether it landed is asserted by `git log` / `ls-remote` in the lane-D report, not by this file, because DONE.md is regenerated before the commit executes.
Lane D wrote nothing outside its 13 delivered paths: nothing under `web/src/`, no `package.json`, no `pnpm-lock.yaml`, no `web.mjs` or build output, no dependency install.

## Concurrent-lane caveat (read before trusting a number)

This worktree is shared with lanes A/B/C/E on the same branch. While lane D worked, `web/src/shell/` and `web/src/modules/` appeared and kept changing (module count moved 5 -> 6 -> 7 during the session). Gates 2 and 5 above are a snapshot of live disk state at the timestamp on top; re-run them after lane A settles. Lane D wrote nothing under `web/src/`.

---

## T00 收口 + T02 @ f25f0677（2026-11-18）

波 0 第二轮。HEAD 基线 `f25f0677`（= 远端 tip，先 fetch 坐实 local==FETCH_HEAD，无需 rebase）。

> 时效说明：本节所有产物（vitest/ia/crawl/lint-fake/lint-reuse/build/pytest）都在 `f25f0677` 树态下采集。提交前再次 fetch 时 tip 已前进到 `c3746cc6`（lane A 的 `feat(console): shell fixture primitive ?state= four-state repro (Wave-0 T03)`，只动 `web/src/shell/fixtures*.ts` 与 `docs/_artifacts/A/T03-CONTRACT.md`，未卷入 lane-D 文件）。因此 gate 2/5 里的 `tabs/modules/reuseMarkers` 是 `f25f0677` 的快照而非本提交树的重算；`console.tsx` 在 `c3746cc6` 仍是未跟踪状态（`git ls-tree HEAD web/src/shell/console.tsx` 为空），故第 6 行的 BUILD_FAIL 归因不变。

### 五命令三元组（cwd + 完整命令 + 期望/实际）

| # | cwd | 命令 | 期望 | 实际（exit） | 产物 |
|---|-----|------|------|--------------|------|
| 1 | `web/` | `node_modules/.bin/vitest run src/lib/usePaneData.test.ts` | T02 hook 纯函数层全绿 | **exit 0** — `Test Files 1 passed (1)` / `Tests 7 passed (7)` / `Duration 82ms` | `tonight/vitest.txt` |
| 2 | `web/` | `node scripts/assert-ia.mjs --source=react` | routes=51, tabs=22, chatHosts=1, modules=8, badCode=[] | **exit 1** — routes **51 ✓**、tabs **5 ✗**、chatHosts **3 ✗**、modules **6 ✗**、badCode `[] ✓`、missing `[]`（lane A 仍在落 manifest，非 lane-D bug） | `tonight/ia.json`（react 段 + `--- baseline(html) ---` 段） |
| 2b | `web/` | `node scripts/assert-ia.mjs`（HTML baseline） | 与上游脚本逐字一致 | **exit 1** — `ENOENT … web/docs/console-v4-skeleton.html`（本 fork 无 `docs/`，逐字行为即如此；等价性另在临时 fixture 用同一份 skeleton 验过 stdout byte-identical） | 同上 `tonight/ia.json` 尾段 |
| 3 | `web/` | `node scripts/crawl-routes.mjs --base http://127.0.0.1:9119` | 逐路由 deadLinks/overflow 清单 | **exit 1** — `Cannot find module 'playwright'` = **TOOL_MISSING**；9119 本身在服（`/api/status` HTTP 200），未重启、未加依赖 | `tonight/crawl.json` |
| 4 | `web/` | `node scripts/lint-fake-success.mjs` | violations=0 | **exit 1** — `ENOENT … console-v4-skeleton.html`（同 2b 根因） | `tonight/lint-fake.json` |
| 5 | `web/` | `node scripts/lint-reuse.mjs` | 五处复用标记齐、无硬编码 | **exit 1** — `violations=5`，全为 `reuse-marker-incomplete`；`scanned=21`、`reuseMarkers=0` | `tonight/lint-reuse.json`（脚本自产）+ `tonight/lint-reuse.stdout.txt` |

构建与主仓腿：

| # | cwd | 命令 | 实际（exit） | 产物 |
|---|-----|------|--------------|------|
| 6 | 仓根 | `nvm use 26 && npx --yes pnpm@12.15.0 --filter web build`（node v26.13.1） | **exit 1 — BUILD_FAIL，非 lane-D 成因**：`TypeScript build failed (2)`，两处均在 `src/shell/console.tsx:210:9` 与 `src/shell/console.tsx:603:30`（TS2367 `ZoneId` 与 `""` 无重叠；该文件是 **lane A 当日未跟踪新文件**，不在 lane-D 写域，故只报不改）。日志内 `usePaneData` 出现 0 次，lane-D 两文件未引入任何错误。无 `vite built` 行。 | `tonight/build.log` |
| 7 | 主仓 m0-d 树 `apps/console` | `uv run --no-project --with pytest python -m pytest tests -q`（本轮按派工直接取产物尾行，lane-D 未在主仓执行） | 尾行 `321 passed in 8.41s` | `tonight/pytest.log` |

### T02 交付：`web/src/lib/usePaneData.ts` + `usePaneData.test.ts`

写域例外（仅此二文件进 `web/src/lib/`）：`cp` 后 `cmp` 双双 IDENTICAL，`web/src/lib` 文件数 119 → 121。

接入用法（**文档形式，未改任何页面文件** —— `modules/`、`shell/`、`App.tsx` 均禁碰）：

```tsx
// PaneQuery 只有 url/itemsKey/ignoreForceState——参数先拼进 url（buildUrl 未导出，用 URLSearchParams）
const url = `/api/employees?${new URLSearchParams({ limit: "20" }).toString()}`;
const pane = usePaneData<{ items: Employee[] }>({ url });
// pane.state: loading|empty|error|ready；pane.error.requestId 上屏；失败自动重试一次
```

口径（详见 `T02-ENDPOINT-RECONCILIATION.md`）：请求号取 BFF 头 `X-Console-Request-Id` 且错误态必须能拿到；仅网络错误与 5xx 自动重试一次、4xx 不重试；`items:[]` 或 `data:null` 判 empty；`?state=` 可短路复现四态供 QA 逐态验收。

### 命名冲突处置（一处偏离派工字面）

派工第 3 步要求 lint-reuse 的**原始 stdout** 落到固定名 `tonight/lint-reuse.json`，但 `lint-reuse.mjs` 自身就把结构化 JSON 写在同名路径（该 JSON 是第一轮已入库的机读产物）。用文本覆盖会毁掉 JSON 契约，因此：脚本自产的 `lint-reuse.json` 保留（本轮已刷新，`python3 -c json.load` 复验 keys=`count/reuseMarkers/root/scanned/violations`、`count=5`、`scanned=21`），原始 stdout 另存 `tonight/lint-reuse.stdout.txt`（文件内 NOTE 行说明缘由）。

### 上轮遗留处置

- lane-D 首批 13 个文件的内容已上线于 **`f25f0677`**（原提交 `0a227c51` 被并发车道 amend 吞并；已采纳方案 A：内容等价即算上线，不补署名提交，见上轮 `git diff 0a227c51 f25f0677 -- <13 paths>` = 0 字节）。
- `docs/_artifacts/D/6-commit-hook-blocked.txt` 按拍板**已删除**（`just` 阻塞已解除，旧钩子日志无价值）。

---

## lint-reuse 豁免台账（区分「未落地」与「违规」）@ f0e85bd4（2026-11-19）

开工现查：`HEAD == FETCH_HEAD == f0e85bd4`（`feat(console): 8 IA-group manifests + App live wiring`），工作区仅本车道 9 个路径为脏。

### 三元组（cwd + 命令 + 真 exit）

| cwd | 命令 | exit | 产物 |
|-----|------|------|------|
| `web/` | `node scripts/lint-reuse.mjs` | **0** | `tonight/lint-reuse.json`（脚本自产纯 JSON）+ `tonight/lint-reuse.stdout.txt`（原始 stdout/stderr + `exit=0`） |
| `web/` | `mv tonight/lint-reuse-exemptions.json /tmp && node scripts/lint-reuse.mjs`（回滚安全测试） | **1** | `/tmp/rollback.txt`：`violations=4`、`exemptionFile: "missing"`，随后台账已还原（4 条） |
| 临时 fixture | R5 失效检测：给 chat 补上 `reuse: 对话 ChatPage` 后台账仍在列 | **1** | 命中 `exemption-stale 豁免已失效须删除：对话 ChatPage 现已声明（pending=T40）` |

### 规则摘要（脚本头注释同步）

- R1 `local-impl-needs-marker`：模块文件本地定义 `useChat`/`TaskBoard`/`SchemaForm` 而本文件无 reuse 声明（`reuse:` 标记或 manifest `kind:'reuse'`）→ 违规。
- R2 `hardcoded-matrix`：`skills: […emp_…]` 硬编码员工×技能数组 → 违规，**不可豁免**。
- R3 `chat-host-not-unique`：modules/ 下 import ChatPage/ChatHost 的文件数 >1 → 违规，**不可豁免**。
- R4 `reuse-marker-incomplete`：五个复用面（对话 ChatPage / 运行详情 RunDetailPage / 任务看板 TasksListPage / schema 表单 AutoField / 能力矩阵 /v1/matrix/employees）逐个判定，声明方式两选一：某处 `reuse:` 标记文本点名该面，或宿主模块 manifest 有 `kind:'reuse'`（这是 lanes 实际采用的约定，T10 duty / T12 employees / T13 matrix 都这么写）。清单外命中才判违规。
- R5 `exemption-stale`：豁免项对应的面一旦声明，必须从台账删除，否则判违规——防止豁免台账烂成永久白名单。
- 台账：`docs/_artifacts/tonight/lint-reuse-exemptions.json`，条目 `{module, reuse, pending, owner, reason, evidence, rules?}`；文件缺失 = 零豁免（照判 R4 违规）。

### 现态结果：violations=0 / exempted=4 / scanned=31 / reuseMarkers=5

| 面 | 宿主 | pending | 真因（未落地 vs 落地缺声明） |
|----|------|---------|------------------------------|
| 对话 ChatPage | chat | T40（lane B chat 宿主） | **已落地缺声明**：`chat/ChatModulePage.tsx:59` 已 `lazy(() => import("@/pages/ChatPage"))`，但 chat/ 无 manifest.ts，无处写 `kind:'reuse'`；补声明属 web/src 写域 |
| 运行详情 RunDetailPage | work | T15（console-work，已合 edbc9575） | **已落地缺声明**：代码在 `modules/runs`、经 `shell/bridge.ts:211` 接线并 `console.tsx:530` 渲染，而 `work/manifest.ts` runs tab 仍 `kind:'planned'` |
| 任务看板 TasksListPage | work | T14（console-work，已合 edbc9575） | **已落地缺声明**：代码在 `modules/tasks`；A 车道 `TAB-REACHABILITY.md` L13 自证「tasks 模块已交付未接线，待 E 车道 manifest」 |
| schema 表单 AutoField | system | `SET01/CR-M2-02`（**盘上无 T 号**） | **真未落地**：modules/ 内 `AutoField`/`SchemaForm` 0 引用，AutoField 仅上游 `pages/ConfigPage.tsx` 使用；`system/manifest.ts` defaults tab `kind:'planned'`（routes.ts row 20 注 CR-M2-02 未落地） |
| 能力矩阵 /v1/matrix/employees | employees | 不需豁免 | **已声明**：`matrix/MatrixModulePage.tsx:78` 与 `matrix/matrix.ts:5` 带 `reuse: /v1/matrix/employees`，`employees/manifest.ts` matrix tab `kind:"reuse"` |

### 两处必须记在案上的偏离与纠正

1. **台账是 4 条不是 5 条**：上一轮快照里的 `chat-host-not-unique`（判 chat/ 与 employee-detail/ 两处 import ChatPage = 入口不唯一）经复核是**脚本假阳**——旧正则在 `employee-detail/EmployeeDetailWorkbench.tsx:97` 命中的是用户可见文案字符串 `"生产环境在此 import Hermes ChatPage（同源部署…）"`，不是 import 语句；同时它**漏掉**了 chat/ 的真实动态 import（`import(` 后无空白）。R3 已改为**结构化**判定（只取静态 `from '…'` / 动态 `import('…')` / `export * from` 的模块说明符，外加 `<ChatHost` JSX 挂载），现在 `chatHostFiles` = 1（chat，via `<ChatHost> mount`），R3 自然通过，故无需也不应为它写豁免。若 L0 仍认为「employee-detail 复用 ChatPage」是 DoD-6 的真违例候选，那是判定口径问题，不是台账问题，请回话我按口径改规则而不是加豁免。
2. **`tonight/lint-reuse.json` 仍是脚本自产的纯 JSON**：任务书写「`; echo exit=$?` 覆盖 tonight/lint-reuse.json」，但该路径是脚本自己的机读产物（其它车道在 `json.load` 它），追加 `exit=` 行会把它变成非 JSON。故真码记在 `lint-reuse.stdout.txt` 与 `gates.exit.json`，JSON 保持可解析。这是延续既定的处置口径，非新发明。
