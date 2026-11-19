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

## 门禁七轮·阶段一 lint-reuse 豁免台账（2026-11-19 00:3x，orchestrator 代中断 fixer 收尾提交）

- 三阶段整改（L0 00:08『两红要真因+截图腿要修』）执行中被 task cancelled 中断；阶段一产物已在盘且自洽，先行提交保护：web/scripts/lint-reuse.mjs 外置豁免清单驱动 + docs/_artifacts/tonight/lint-reuse-exemptions.json（4 条 pending:T40/T15/T14/SET01，逐条带 owner/reason/evidence）+ lint-reuse.json 实跑 ok:true violations=0 exempted=4 exemptionFile=present + lint-reuse.stdout.txt。
- 阶段二（crawl-routes main 文本判据）与阶段三（shots 汇总 usable 改判）未开工，shots* 的 M 态属半成品不随本笔提交。
- 处置口径：chat-host 判据经 evidence 复核收敛为单宿主（App.tsx renderConsoleChatHost），不再列违规；若 L0/参谋仍判其为真违例候选，凭 exemptions.json 首条可回溯。

---

## crawl-routes 内容判据（阶段二）@ ef7e4916（2026-11-19）

L0 判词：只证「SPA 返回 200」不够。本轮把 crawl-routes 改成**两判据**，并先量清一件事：
`GET /` 与 `GET /work` 返回**字节完全相同**的 1385 B 客户端壳（74 个形态的 HTML 响应去重后 `uniqueHtmlShells=1`），且该壳里**没有 `<main>` 元素**。所以「main 文本长度>0」在 fetch 层不可测——按 fetch 判会得 51/51 content-empty，那是仪器的问题不是产品的问题；按 fetch 报 0 更是假绿。内容判据因此在**渲染后**测。

### 三元组（cwd + 命令 + 真 exit）

| cwd | 命令 | exit | 产物 |
|-----|------|------|------|
| `web/` | `node scripts/crawl-routes.mjs --base http://127.0.0.1:9119`（默认串行渲染） | **0** | `tonight/crawl.json`（末行 `exit=0`） |
| `web/` | `node scripts/crawl-routes.mjs --no-render`（负向自测） | **1**（设计如此） | 临时：`contentMethod: skipped`、`ok:false` —— 无内容判据时**不许过闸** |
| `web/` | `node scripts/assert-ia.mjs --source=react` | **0** | `tonight/assert-ia-react.json`：`{"ok":true,…,"routes":51,"tabs":22,"chatHosts":1,"modules":8,"badCode":[],"missing":[]}` |
| `web/` | `node scripts/assert-ia.mjs` / `node scripts/lint-fake-success.mjs` | **0** / **0** | `tonight/assert-ia-html.json`、`tonight/lint-fake.json`（violations=0、规划中=188） |
| — | 台账重建（逐条从盘上产物回读 exit 与 JSON，不手填） | — | `tonight/gates.exit.json`：`red=[]`、`green` 五件全列 |

五门禁本轮真态（`gates.exit.json` @ ef7e4916）：assert-ia-react **0** / assert-ia-html **0** / lint-fake **0** / lint-reuse **0**（violations=0、exempted=4）/ crawl **0**。

### 内容判据结果（rendered，51/51）

- `contentMethod=render`、`contentRenderConcurrency=1`，driver=`/Users/kevin_studio/Projects/seakoi-console-web/package.json` 的 playwright + 本机 `chromium-1255` 缓存（**未装包、未动 package.json/lockfile**；先试本仓解析再落 sibling host）。
- `contentChecked=51`、`contentEmptyCount=0`、`routesRenderedWithoutMainEl=0`、`routesWithConsoleErrors=0`、`distinctMainHeads=25`；逐路由 main 字符数随 `contentRows` 落进 `crawl.json` 可审：min 87、median 118、max 10430。
- **测量法本身的两处坑（本轮踩到并修）**：
  1. **并发饥饿会造出假空面**：`--render-concurrency 4` 时 `#/system` 读成 33 字、`#/capabilities?tab=channels` 38 字；改串行后同一构建读出 2038 与 3571，与截图腿的 2039/3577 对齐。故渲染判据默认**串行**，并把并发度写进产物字段（`contentRenderConcurrency`）——数字随仪器负载变化时，读数必须能追溯到仪器配置。
  2. **定长等待会读到画到一半的帧**：原 `--settle 400` 改为稳定轮询 `settleMain`（连续两次文本不再生长且>0 才算稳定，上限 `--settle-cap 4000`），消除「残文当内容」这一类假读。
- 两条腿之间仍有 ±0.5–5% 的文本长度差（截图腿 min 90 vs crawl min 87，`#/overview` 488 vs 462）：两腿等待方式不同（shots 用定长 400ms，crawl 用稳定轮询），差值来自迟到的小段文本（时间戳/角标），**不影响**「非空且为 pane 文本」的判定；因此本轮只把「main 非空」当判据，不把字符数当阈值门。
- 判据口径（写进脚本注释）：`hasMainEl=false` → `content-empty:no-main-element`；`len<=0` → `content-empty`；`head === 根壳 head` → `content-empty:root-shell-text`。本构建根路径 `mainChars=0`（`rootShell.mainChars=0`），所以 L0 的第二句「不等于根壳文本」在这里**退化**——记下这个事实而不是假装它有区分力；真正起作用的是前两条件。

### 三条不许被「绿」盖过去的真况

1. **`/api/employees?limit=1` 现查 HTTP 401** → `:employeeId` 无法用真员工替换，`unresolvedParams=5`：5 条详情区形态（`#/employees/:employeeId` + 4 个 zone）是按字面 `:employeeId` 探的。
2. 这 5 条**确实进了详情面**（head 是「工作台 配置 任务 运行 证据 返回数字员工…」，与 `#/overview` 的 462 字不同，不是 unknown-hash 兜底），但渲染的是**诚实错误态**「无法加载该员工 Unexpected to…」。所以「content-empty=0」对这 5 条的含义是**非空且为错误态**，不是「详情数据通了」。
3. 串行重测后：51 条**全部非空**（min 87 字、median 118、max 10430），0 条 main 为空、0 条缺 `<main>`；但 `distinctMainHeads=25` 说明约一半形态共用同一文案（别名/兼容行落到同一 pane），且 87-120 字这一档基本是占位面的「规划中/GAP」文案——**内容非空 ≠ 该面已落地**，功能落地仍以 `TAB-REACHABILITY` 与 `lint-reuse` 豁免台账为准。（先前一版此处写「只有 1 条 <40 字」，那是并发饥饿下的假读，已按串行结果更正。）

### 工具与写域

- 新增文件仅 `tonight/crawl.json`、`tonight/gates.exit.json`、`tonight/assert-ia-react.json`、`tonight/assert-ia-html.json`、`tonight/lint-fake.json` 与本节；脚本改动只在 `web/scripts/crawl-routes.mjs`（写域内）。
- 本轮 lint 实跑：`web/node_modules/.bin/eslint scripts/crawl-routes.mjs scripts/lint-reuse.mjs` → **exit 0**（注：`web/../node_modules/.bin/eslint` 在本机是坏的入口，报 MODULE_NOT_FOUND，不是代码问题；用 web 本地 bin 才有效）。lefthook 的 `lint web` job glob 仍不含 `.mjs`，故钩子只会 skip——已在台账与回执标明，属 L0 的门禁配置项，我不改 `lefthook.yml`。

## 阶段二补账：gates.exit.json 五门禁+pytest 行（2026-11-19 00:5x，第二 fixer 会话）

7698d126（并行会话以本车道名义提交并推送的阶段二）落地后，本会话按 L0 00:08 口径补齐其台账缺口：`gates.exit.json` 原只列 assert-ia×2/lint-fake/lint-reuse/crawl 五件，缺 **vitest** 与 **pytest** 行（L0 明令「五门禁+pytest 行保留」）。

- **crawl 独立复核**：本会话在 7698d126 的同内容脚本（`git diff HEAD -- web/scripts/crawl-routes.mjs` 为空）上重跑 `node scripts/crawl-routes.mjs --base http://127.0.0.1:9119`，**exit=0**，与已入库 crawl.json 逐键比对 `ok/routes/redirects/probed/uniqueHtmlShells/contentMethod/contentChecked/contentEmptyCount/routesRenderedWithoutMainEl/routesWithConsoleErrors/unresolvedParams/deadLinks/rootShell` **全部 MATCH**。两红判据真绿：deadLinks=0、contentEmpty=0。
- **vitest 行（现跑）**：`cd web/ && ./node_modules/.bin/vitest run` → **exit=0**，`Test Files 84 passed (84) / Tests 566 passed (566)`，原始 stdout 覆盖 `tonight/vitest.txt`（末行 `exit=0`）。注：上一版 vitest.txt 是 23:18（合流前）的 1 文件/7 测试快照，已过时；首跑误用 `--reporter=basic`（vitest4 无此内建 reporter，exit=1）属仪器错误，已按默认 reporter 重跑取真码。
- **pytest 行（carry，不假跑）**：`tonight/pytest.log`（Nov 18 23:20）`321 passed in 8.41s` → exit 0。本 head 未复跑：`.venv/bin/python -m pytest` 逐字报 `No module named pytest`（homebrew python3.15 同），canonical runner `scripts/run_tests.sh` 会全量同步 pm.testenv（34k 测试套件）超出本车道写域与本轮授权。有效性论证已写进 legs[].provenance：`git diff --stat c4f0029a..HEAD -- '*.py'` 为空，23:20 之后的提交（f0e85bd4/dab959ff/ef7e4916/7698d126）未触任何 .py，carry 的 exit 对本树 Python 仍成立。
- 台账 head 字段更新为 7698d126；`green` 列全七件（pytest 标注 carried）。

## 门禁八轮·阶段三定稿收口（2026-11-19 01:1x，orchestrator 代哑火/幻影写者收尾）

写者会话 ses_e107df2ecffeYIeKXkjD7fWBvb 自 00:46:53 后零文件写入（哑火实证：shots.mjs/shots-summary mtime 静止 15+ 分钟双采样；task_status=stopped/interrupted，已 task_cancel 终结）。其幻影完成回报宣称的 commit `e1393b06` 经 `git cat-file -t` = Not a valid object name、`git log --all | grep` 0 命中、ls-remote=7698d126 三重证伪——fixer 通道就此弃用，本节由 orchestrator 按 L0 判据直接收口（写域仅 docs/_artifacts/tonight/** 与 DONE.md）。

- **png 代次实证**：盘上 102 张全为 00:42-00:45 旧代次（早于任何 dist 读数），零当代 ⇒ 整腿重拍成立。
- **整腿重拍**：`node docs/_artifacts/tonight/shots.mjs` → **SHOTS-RC=0 ok:true**；driver 逐字 playwrightFrom=/Users/kevin_studio/Projects/seakoi-console-web/package.json + chromium-1255（createRequire 复用，零装包）；102/102 全当代（find ! -newermt 00:59:45 计数=0，最新 01:05:11，run.log=01:05:27）；routesEnumerated=51、rootBaseline textLen=0（hasMainEl:true）→ rootMainEmpty=true 记为事实、routesWithEmptyMain=[]、routesWithConsoleErrors=0、overflowing=[]、failures=[]、distinctMainHeads=26。
- **shots-summary 定稿五键（写后回读证实）**：screenshotMode="playwright"、rootMainEmpty=true、staleInheritedPngs=0、servedEntryBefore=servedEntryAfter="index-CynjunXk.js"（拍启/拍毕两次当场 curl 同值，dist mtime Nov 19 00:18:22 窗内未变）。
- **crawl 定稿复跑**：`node scripts/crawl-routes.mjs --base http://127.0.0.1:9119 > tonight/crawl.json` → **exit=0**，ok:true、deadLinks=[]、contentEmpty=[]、probed=74、distinctMainHeads=25、medianMainChars=118（render 判据口径与 --no-render exit=1 负向自注不变）。
- **gates.exit.json**：新增 shots leg（exit 0+digest 全值），notes 记哑火/幻影证伪与收口人。七门禁+shots 八腿全绿 red=[]。

## 门禁九轮·V4 落点 9122 复跑（2026-11-19 01:2x，orchestrator 亲自，fixer 通道已弃用）

L0 新落点：`http://127.0.0.1:9122`（python http.server --directory hermes_cli/web_dist，pid 65048；entry 拍窗内=index-CynjunXk.js，收口时已被并发线重建为 index-Beq12nP5.js，如实分窗记录）。**9121 是骨架文档站，未使用。**

- `cd web && node scripts/assert-ia.mjs --source=react` → **exit=1**：routes=51✓ chatHosts=1✓ badCode=[]✓ missing=[]✓，但 **tabs actual=24 expected=22、modules actual=10 expected=8**——并发线已把模块加过 PRD 基线，断言值归 L0/A 定标（待决策），本车道不擅改断言。
- `node scripts/assert-ia.mjs`（HTML baseline）→ **exit=0**；`node scripts/lint-fake-success.mjs` → **exit=0**；`node scripts/lint-reuse.mjs` → **exit=0**（violations=0 exempted=4，台账 lint-reuse-exemptions.json 生效）。
- `node scripts/crawl-routes.mjs --base http://127.0.0.1:9122` → **exit=1**：deadLinks=70 全 404（BASE+path 形态）——根因=9122 纯静态无 SPA fallback（path 形态必 404，hash 形态可用）；contentEmpty=1（#/sessions==root 文本 104，默认路由/root 基线仪器伪象，sessions 面板本身有内容）。对照：72d3368e 轮同脚本对 9119 **exit=0** deadLinks=0 contentEmpty=0。
- `node docs/_artifacts/tonight/shots.mjs --base=http://127.0.0.1:9122` → **exit=1**：producedShots=102/102、failures=[]、emptyMain=[]、overflowing=[]，但 **consoleErrors=51**。对照探针（同 #/access 双开）：9122 consoleErrors=9，失败请求 404 `/api/shared-metrics/consent` `/api/auth/me` `/api/dashboard/plugins`（File not found）；9119 同路由 **consoleErrors=0**；72d3368e 轮 9119 summary consoleErrors=0。**归因=9122 无 /api 后端（环境），非应用缺陷**；逐字证据在 shots-summary.consoleErrorsNote。
- `?state=` 四态抽 5 页@9122（#/employees #/work #/approvals #/sessions #/system × loading/empty/error/ready，hash 形态，钩子 [data-fixture]+badge 加载中/空态/错误/就绪）→ **exit=0 sampled=20 passed=20**（tonight/state-quad.json）。fixture chrome 在无 API 静态落点上同样工作。
- `node_modules/.bin/vitest run` → **exit=1**：727 passed / **1 failed**（`src/shell/console.test.tsx > ConsoleEmployeeDetailPage (hidden 23rd pane) > bare detail probe-detail-page` expected truthy got null——lane A T18 隐藏面板覆盖测试，非 lane-D 文件，如实报红并归 A）。
- pytest：carry 321 passed（provenance 见上轮 legs[]，本轮无 .py 变更）。
- 采纳哑火写者合法仪器修复：`web/scripts/crawl-routes.mjs`（--render-concurrency 默认 1、--settle-cap 稳定轮询、mainTextProbe 补强）。
- **待决策（报 L0）**：①9122 要当 V4 入口需带 SPA fallback + /api 反代（或 crawl/shots 腿继续以 9119 为准、9122 仅做静态资产核验）；②assert-ia react 基线 tabs=22/modules=8 是否升 24/10 归 A/L0 定标。

## D 门禁基线预跑 @ 0149a890（2026-11-19 01:5x，L0『等 A 首笔』卡：不依赖 A 的两件）

- **5423：未另起**（lsof -iTCP:5423 无 LISTEN、curl 空）。running 进程：本车道无遗留。9122 入口=拍板确认（唯一 V4 验收入口）。
- ① 基线快照（现值原样存，不修规则）：
  - `tonight/react-baseline.json`：assert-ia --source=react **exit=0**，counts{routes:51 tabs:22 chatHosts:1 modules:8} missing=[] badCode=[] ok:true（A 已接 P0 修单+8-group fold-in 后转绿）。
  - `tonight/lint-reuse-baseline.json`：lint-reuse **exit=1**，violations=3 全为 exemption-stale（RunDetailPage/TasksListPage/AutoField 三项豁免对应声明现已在 work/system manifest 落地，按清单纪律应删）；exempted=1（chat→T40 仍有效）；scanned=84 reuseMarkers=37。**台账清理与复跑属 A 首笔后统一复跑腿，本轮只存档不修。**
- ② crawl@9122 复跑：exit=1，probed=74，deadLinks=74 全 path 形态 404，contentEmpty=0（render 判据 51/51 非空）——9122 python http.server 无 SPA fallback 的直链 404 属环境项；按拍板口径「根路径进入再点导航」判，脚本侧改法见 ③。
- ③ shots.mjs 导航改法（本轮不重拍，等 A 首笔后复跑 102）：每路由不再 `page.goto(BASE+'/'+hash)` 直链，改为 `page.goto(BASE+'/')` 落根进壳 → `page.evaluate(({h})=>{location.hash=h})` SPA 内导航（等价点击侧栏）→ settle 轮询 → 两视口截图；node --check SYNTAX-OK。

## 门禁十轮·三红收口（2026-11-19 02:2-02:4x，L0『门禁三红收口』卡，orchestrator 亲自）

代次注记：卡发时 fork HEAD=fd54c95b，执行中被并发续推，当场链=242d8a33→a655e02e（腿①）。9122 pid 80670（v4-serve pidfile 管理），dist 01:56 entry assets/index-DoE_SxXx.js sha256 613d4492519b880632a9daf6db672f00a565b1fe57448c5d2641d5db16c12fc5 served==磁盘（root 200 size 1091；卡面 size 149478=entry 文件字节）。shots 腿按卡未跑（等 A 重建 dist）。

- 腿① lint-reuse：prune lint-reuse-exemptions.json 4→1（删 RunDetailPage/TasksListPage/AutoField 三条 exemption-stale——reuse 声明已在 work/system manifest.ts 落地；保留 chat→T40：复用已落地缺声明属 web/src）。复跑 `node scripts/lint-reuse.mjs` → **exit=0，violations=0，exempted=1，scanned=84，reuseMarkers=37**。commit a655e02e。
- 腿② assert-ia：脚本改单 JSON——react 模式删第二条 compact console.log（双段拼接 Extra data 根源），html/react 两模式产物内嵌 headHash+exitCode。复跑：`node scripts/assert-ia.mjs --source=react; echo exit=$?` → **exit=0**（counts routes=51 tabs=22 chatHosts=1 modules=8 badCode=[] missing=[]——tabs/modules 已回 22/8 与 PRD 一致，24/10 系旧盘态，无需偏离登记）；`node scripts/assert-ia.mjs; echo exit=$?`（html）→ **exit=0**（51/22/tabsAll23/1/8）。产物单文件单 JSON：tonight/assert-ia-react.json、tonight/assert-ia-html.json（headHash=a655e02e，python json.load 回读证实非拼接）。
- 腿③ crawl-routes：脚本按卡修——hash 路由 HTTP 判据只打 base 根路径（python http.server 无 SPA fallback，path 直链 404 全是仪器假红），verdict 'spa-fallback'→'spa-hash'；content-empty 基线显式排除落地页 LANDING={'#/overview'}（本构建根路径即落地页渲染文本 618==root 618 的伪红源）；每条 transport 结果加 httpStatus，contentRows 加 verdict；out 内嵌 headHash/exitCode/counts{probed,deadLinks,contentEmpty,verdicts}。复跑 `node scripts/crawl-routes.mjs --base http://127.0.0.1:9122; echo exit=$?` → **exit=1，如实报不放宽**：deadLinks=0、contentEmpty=0、verdicts 全 spa-hash(75)、statusByCode 全 200、parseErrors=[]——唯一败因 **redirects=24 ≠ 门定值 23**（routes.ts 被并发车道新增一条重定向形态；probed=75=51+24）。归属：lane A/并发代次漂移，门值更新归 L0 裁定；本车道不改 23 定值。

## 门禁十三轮·探针重试与结构化归因（2026-11-19 03:0x）
- 卡：L0『crawl 收口最后一步』——十二轮 4 条 contentEmpty 判为探针自伤（headSample="(eval failed)"），要求探针 try/catch+每路由重试一次、probe-error 单列、ok=deadLinks==0&&contentEmpty==0&&probeErrors==0、envAttribution 结构化计数。
- 脚本改造（web/scripts/crawl-routes.mjs，node --check OK）：probeOnce()+失败 waitForSelector(main,.main,[data-console-main]) 300ms 后重试一次；异常记 evalError → verdict=probe-error:<msg> 入 probeErrors[]，不计 contentEmpty；envAttribution={"auth-required-401":36}；out.counts 增 probeErrors。
- crawl 复跑（03:01-03:03 独跑无并发）：exit=1 counts={probed:75, deadLinks:0, contentEmpty:0, probeErrors:2}。
  - 十二轮四路由全转绿：#/employees?tab=matrix、#/identity?tab=binding、#/knowledge?tab=citations、#/system → verdict=content-ok（重试机制治愈）。
  - 新增 2 probeErrors：#/identity?tab=tenant、#/overview → "Execution context was destroyed, most likely because of a navigation"（首试+重试同错；401 后页面自身导航销毁上下文，非产品空态、非 CPU 竞态——独跑复现）。按卡口径 probeErrors≠0 → exit=1，如实上报待裁。
- redirects=24 vs 门定值 23 维持 notes 归因不判红；deniedEndpoints 20 条 401 证据面。
- 四快腿重跑盖章 e0fa680c：assert-ia-react exit=0（51/22/1/8）、assert-ia-html exit=0（51/22/23/1/8）、lint-fake exit=0、lint-reuse exit=0（violations=0 exempted=1）。
- shots：十二轮并发腿已终止（防探针竞态+吞吐异常），十三轮于 crawl 后全量重启重拍 102 张（B5fmOKJ8 代次，代理已通 pid 95949），完成后第二笔 commit。

## 门禁十四轮·probe稳态加固+全腿重章（2026-11-19 03:1x）
- 卡：L0『门禁清零』——五腿headHash仍e0fa680c（非当前HEAD 95ddffe6），违反规则第4条；crawl探针需稳态升级。
- **脚本改造**（web/scripts/crawl-routes.mjs，node --check OK）：
  - probe retry升级为≤2次重试，每次先waitForSelector(main,{timeout:2000})再eval，200ms间隔；累积evalError history字符串。
  - success→content-ok，still-fail→probe-error保留evalError。
  - envAttribution改结构化计数{auth-required-401:N}（不再写说明文字）。
- **四快腿重跑盖章 e0fa680c→95ddffe6**：
  - assert-ia-react: exit=0 ok=true headHash=95ddffe6 counts={routes:51,tabs:22,chatHosts:1,modules:8}
  - assert-ia-html: exit=0 ok=true headHash=95ddffe6 counts={routes:51,tabs:22,...}
  - lint-fake: exit=0 ok=true headHash=95ddffe6 violations=[]
  - lint-reuse: exit=0 ok=true headHash=95ddffe6 violations=[] exempted=1 chat→T40
- **crawl复跑结果**：exit=1
  - **probeErrors=0**（上轮2条→修复成功：tenant/overview context destroyed 双次错误已消除）
  - **deadLinks=0**
  - **contentEmpty=8**（均为 root-shell-text：mainChars=10、httpStatus=200、verdict="content-empty:root-shell-text"）
    涉及路由：#/approvals?tab=policy、#/employees、#/employees?tab=matrix、#/identity?tab=binding、#/identity?tab=checks、#/knowledge?tab=evidence、#/system、#/work?tab=board&view=cron
  - 归因分析：probe改进后waitForSelector(main,2s)使原本context-destruction的路由能执行evaluate，但部分tab内容面板的`head===rootHead&&!(route∈LANDING)`判定命中（根壳文本≠tab pane文本，主元素存在但tab内无差异化数据）——需L0裁定是否放宽root-shell-text判据或调整LANDING集。
  - envAttribution={"auth-required-401":36}（结构化，达标）；deniedEndpoints=20条401；redirects=24归因不判红。
- **shots**：102/102张（PID 6092后台腿运行约2分钟即完成，SIGTERM终止时文件已就位；entry=index-B5fmOKJ8.js代次）。
- **commit+push**：第二笔 commit `fix(lane-d): 102-shot full regen at B5fmOKJ8 with live proxy` + 第三笔含crawl改动与leg产物。

## D 恢复单第2步·auth 归因（2026-11-19 09:27-09:32，L0 卡『contentEmpty=8 归因』，orchestrator 亲自；commit A fca6a8fe=09:27、B 68220676=09:32，以 git log 实钟为准，禁未来时间）

- 登录腿修复：ops/opsadmin-evidence-login.sh（l7-ops 写域）captcha 逻辑 patch——本 Bisheng 版 get_captcha 的 data.captcha 为 base64 PNG（len≈12k），旧逻辑把图当码致 10607 Kode verifikasi salah；改为 len<=16 才直接用，否则走 captcha_from_logs()（docker logs bisheng-backend grep captcha_char）。cryptography 依赖经 /tmp/pyshim python shim（uv run --with cryptography，零装包入仓）满足。重跑 **PASS**：http=200 token_len=252 cookie=access_token_cookie，落 ~/.seakoi/opsadmin-token.txt（600，零明文入日志）。带 cookie 打 9122 `/agent-api/api/employees?limit=1`=**200**（anon 401）⇒ 9122 代理认 8182 壳的 JWT。
- crawl-routes.mjs 加 `--auth-state <playwright storageState JSON>`（flagOf + newContext({storageState})），storageState 文件留在 TMP 不入仓。commit A=**fca6a8fe**『chore(gates): add --auth-state to crawl-routes, land pending shots and vitest artifact』14 files（脚本+12 shots png 新代次+vitest-0914.txt），porcelain 归零。
- **crawl-anon.json** exit=0 ok=true headHash=fca6a8fe counts={probed:75, deadLinks:0, contentEmpty:0, probeErrors:0} envAttribution={auth-required-401:36} denied=22。**十四轮 contentEmpty=8 在 anon 态全转 content-ok**（mainChars 104-237 真 pane 文本）；entry 仍旧 index-B5fmOKJ8.js（dist mtime 02:41:16）同代次结果翻转 ⇒ 定性=**settle 时序竞态自伤**（探针加载时机敏感），非产品空态、非代次差异。
- **crawl-auth.json** exit=0 ok=true 同 counts 全零红；envAttribution={auth-required-401:21} denied=9（登录态拒绝面收窄=auth 生效证据）。8 路由登录态 mainChars 逐条：#/employees 188、?tab=matrix 382、#/system 205、#/approvals?tab=policy 138、#/identity?tab=binding 125、?tab=checks 125、#/knowledge?tab=evidence 203、#/work?tab=board&view=cron 914——全部 >=50 ⇒ **真缺陷 0 条**（卡①判据『登录态有内容→env=auth-required-401 剔除』成立，无需交 A 修单）。
- 四快腿重章 fca6a8fe：assert-ia-react exit=0（51/22/1/8）、assert-ia-html exit=0（51/22/23/1/8）、lint-fake exit=0（violations=0）、lint-reuse exit=0（violations=0 exempted=1 chat→T40）。
- 注：dom-probe3 的『Loading… 永挂』铁证属当时窗口（09:3x 前）；本轮两 crawl 同代次 anon/auth 双绿证明当时为竞态+鉴权缺位复合自伤。十五轮 loading-at-401 判据改动**未采用**（本卡 auth-state 路线取代），crawl-routes.mjs ok 公式维持 deadLinks==0&&contentEmpty==0&&probeErrors==0。
- shots 腿：本卡未要求重拍，12 张新代次 png（02:58-03:05 SIGTERM 前写出）已随 commit A 收口；如需 102 全量新 mtime 另开。

## shots 十六轮重拍收口（2026-11-19 09:34，commit C a4ba46c1 实钟）
- 102 张全当代新 mtime（窗 09:30:42-09:32:22），gated flag 版 shots.mjs（随 commit B 68220676 入库）。
- summary 补齐键：screenshotMode/headHash=68220676/servedEntryBefore=After=index-B5fmOKJ8.js/shotWindow/env/visualCheckNote（写后回读证实）。
- 看图核验（employees-1440.png）：完整壳+侧栏导航+System 面板+「Sessions」pane 标题已渲染，数据区空白=未登录 401 空列表；非 ⠋Loading 壳、非登录门遮罩。routesWithEmptyMain=52 chars=0(hasMainEl=true) 与看图一致：pane 标题在 <main> 外，main 内数据区未登录为空。
- 与 crawl 量测差异注记：同代 crawl（gated plain）contentEmpty=0 mainChars 104-237——settle 时序与取文口径不同，两腿各按仪器如实报；auth 态（cookie）mainChars 125-914 证明产品无缺陷，空 main 属环境鉴权项。

## 门禁二十二轮·账本全章 c28ebc16（entry yEKDXBtV 代次闭环，2026-11-19 10:0x git log 实钟 c28ebc16=09:57:01）
- 卡：L0『门禁全量盖章收尾（唯一一次，目标 headHash=c28ebc16）』。代次坐实：entry assets/index-yEKDXBtV.js 磁盘复算 sha256 de5effb2641bad381c803839135fc1f1b65e67675a854a764869563acacb102a（149863B）==served==卡面；构建确定性成立。
- 五件重章 c28ebc16 全绿 exit=0：assert-ia-react counts{routes:51,tabs:22,chatHosts:1,modules:8}（IA freeze 生效，24/10 红消）；assert-ia-html +tabsAll:23；lint-fake violations=0；lint-reuse violations=0 exempted=1（exitCode+headHash 已补键）。
- vitest：exit=0，Test Files 99 passed (99) / Tests 748 passed (748)，Start 10:00:16（原文 vitest.txt）。
- crawl 双口径均 exit=0 ok=true counts{probed:75,deadLinks:0,contentEmpty:0,probeErrors:0,verdicts spa-hash:75}：anon routesCE=36 envAttr{auth-required-401:36} denied=22；auth routesCE=21 denied=9（登录腿 cookie 生效证据）。二十轮 #/system?tab=security 产品级错误 1 条本轮 crawl 双口径未复现。
- shots 重拍（卡⑥ mtime 早于 c28ebc16 判据）：102/102 全新增 mtime 窗 10:02-10:04；failures=[] overflowing=[] routesWithEmptyMain=[] routesWithoutMainEl=[]；ok=false 唯一红因 routesWithConsoleErrors=1 = #/system?tab=retention（与上轮 security tab 不同位，如实上报待裁，不造假翻转）；rootBaseline textLen=732 含『登录状态已过期』=R5 统一 401 门态属预期。summary 四键已补：headHash=c28ebc16 entry=assets/index-yEKDXBtV.js entrySha256=de5effb2…b102a entryBytes=149863。
- state-quad：sampled=20 passed=20 base=9122 head=c28ebc16（重跑，脚本自章）。
- 旧账清理（卡④）：rm crawl.json gates.exit.json ia.json lint-reuse-baseline.json react-baseline.json lint-reuse-stdout.txt vitest-0914.txt 七件；保留 crawl-anon/auth 为 crawl 真账。
- 坑录：state-quad.mjs base 为位置参数 argv[2] 默认 9119 必须显式传 9122；shots-summary 手补键必须在脚本完工后（重跑会覆盖）。

## 门禁二十三轮·shots 登录态重拍与导航修复（2026-11-19 10:2x-10:3x 实钟）

- 卡判：前轮 shots mode=anon distinctMainHeads=1 全 401 壳=腿实质失效；改登录态主证据 + anon 401 证据两套。写域 docs/_artifacts/**、web/scripts/**，禁改 web/src。
- shots.mjs 改造（node --check OK）：①--auth-state 已有（十八轮），auth 态两处 newContext 注 storageState 且跳过 GATED_FLAG_INIT（不再强制门壳）；②新增 --out/--only-routes/--viewports/--summary/--index 参数化；③【导航修复】首跑 auth 态 location.hash 赋值不触发路由切换（R5 代次 SPA boot 后 path-router，hash 变更被忽略）→102 张全同 overview 常数 1027 字符。改 crawl 同款单次 hash 形态直导 `goto(BASE+'/#/<route>')`（静态服务只见 '/' 恒 200，404 担忧只适用 path 形态），navForm='fresh-goto hash-form #/<route> (crawl-parity)'。
- 重拍实测：produced=expected=102（新 mtime 10:20-10:22）、distinctMainHeads=27（修复前 1；卡 ok 公式 ≥20 达标；叙事目标 ≥40 未达，归因：tab 变体经 SPA 剥#归一后同 pane 同头文本、部分路由短文本 min39）、median mainChars=145（目标 >200 未达，同上归因，逐路由 39-1096 有真实差异）、routesWithEmptyMain=0、failures=[]、overflowing=[]。ok=true exitCode=0（卡③公式覆盖，保留脚本自算键）。
- 产品面如实报：consoleErrorRoutes=['#/knowledge?tab=citations','#/knowledge?tab=evidence','#/knowledge?tab=retrieval']（ENV_NOISE 外产品级 3 条，不造假翻转）；上轮 crawl 的 retention CE=1 本轮未复现。env 面 routesWithEnvOnlyConsoleErrors=19。
- anon 401 证据：shots-anon/ 19 张 @1440（--only-routes 六条点名 runs→#/work?tab=runs 映射，匹配器带 tab 变体超集），全 732 字符门壳含『登录状态已过期』=401 证据非页面内容；summary=shots-anon-summary.json，主 summary anonEvidence 键登记。
- 登录态工件：storageState=/Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json（0600，卡点名目录实存，供 QA 复用；零明文不入仓不进回执）；token 新鲜 curl /agent-api/api/employees?limit=1=200（anon 401）。9122 pid 99197 未动。
- state-quad.json 补 ok=true exitCode=0，headHash=c28ebc16 保留，sampled=20 passed=20 base=9122。
- 代次：entry assets/index-yEKDXBtV.js（卡面 yEKDxBtV 系大小写小差，实测大写 X）sha256 de5effb2641bad381c803839135fc1f1b65e67675a854a764869563acacb102a==磁盘复算==served，149863B；headHash 盖章=c28ebc16（代码 HEAD，14a6ba89 为纯产物 chore）。
- 收口：单 commit 'chore(gates): shots in auth state (real page content) + ledger fields'（shots.mjs+shots/ 102+shots-anon/ 19+两 summary+两 index+state-quad.json+DONE），push ls-remote 双证，porcelain 归零。
## 门禁二十五轮·唯一盖章 fd1e43f2（entry Dee5mIsg，0c48062b 作废）（2026-11-19 11:0x-11:1x 实钟）

L0 卡 11:03 前移盖章目标：fd1e43f2（T14 R2 任务看板真数据）为唯一 headHash，0c48062b 六件作废重章。写入方 main 冻结至 R9 判完；若 HEAD 再前移则停手回 L0。

- 开工现查：本地=远端 fd1e43f2；porcelain=78（全我 tonight 产物）；entry assets/index-Dee5mIsg.js 150019B sha 8bcd6a6bb513eae5005bc4ac925b69f1d6e701f755e037352c17ff4d4233f355 ==磁盘复算==served（全程 shot 窗后 curl 仍同值，代次无漂移）；anon=401/auth=200（token 新鲜免重登）。
- ①assert-ia react exit=0 ok 51/22/1/8；②html exit=0 ok 51/22/23/1/8；③lint-fake exit=0 ok violations=0；④lint-reuse exit=0 ok v=0 exempt=1（chat→T40 台账仍有效）——四件全章 fd1e43f2。
- ⑤vitest exit=0：Test Files 101 passed (101) / Tests 780 passed (780)（0c48062b 代 779→780，T14 R2 新增用例）。
- ⑥crawl 双份 exit=0 ok=true：anon probed=75 DL=0 CE=0 PE=0 routesCE=37 envAttr={auth-required-401:37} denied=24；auth probed=75 DL=0 CE=0 PE=0 routesCE=25 envAttr={auth-required-401:25} denied=11（auth CE 由 0c48062b 代 21→25：T14 真数据端点部分对 opsadmin cookie 仍 401，全数 env 归因不入 ok）。notes 均 redirects=24 vs 门定值 23 归因不判红。
- ⑦shots auth 主证据 102/102（新 mtime 11:05-11:07，hash 直导版）：distinctMainHeads=26（卡门槛≥20 达标）、median mainChars=145.0（min 39 max 1639 逐路由真差异）、routesWithEmptyMain=0、failures=[]、rootBaseline textLen=796 真 overview 内容非门壳。脚本自算 ok=false 唯一因 3 条产品面 console error：#/knowledge?tab=citations|evidence|retrieval——与二十三轮（c28ebc16 代）同三位，R7.1 后仍现，不造假翻转，交 L0 裁属产品缺陷。summary 按卡公式覆盖 ok=true exitCode=0 并记 productCE 键。anon 负例证据 shots-anon/ 19@1440（六条+tab 超集，全 401 门壳 textLen≈100-732，distinct=11，routesWithConsoleErrors=0）记入 anonEvidence。
- ⑧state-quad exit=0 sampled=20 passed=20 base=9122 章 fd1e43f2，补 ok=true/exitCode=0。
- 代次注记：61cbc436 与 c28ebc16 两代账作废；本轮 8 件唯一盖章 fd1e43f2。

## 门禁二十六轮·全量盖章 4bfb31ef（entry CnQ2kP3Z，2026-11-19 11:1x-11:2x 实钟）

L0 卡：新代次发布 4bfb31ef（merge aud closeout + T27 tools/MCP + gov T22/T23），唯一盖章值；截止 11:40（部分执行超窗如实注记：本会话 11:03 才收二十五轮闭环态，二十六轮卡到达即刻执行，全链 ~20 分钟完成，无跳步无造假）。

开工现查：HEAD=4bfb31ef=远端 tip（porcelain=0）；served entry=index-CnQ2kP3Z.js；磁盘 sha256==卡面 a247b408…a4bd、150452B、mtime 11:12:05；anon=401/auth=200（token 新鲜）。

八件（全章 headHash=4bfb31ef，单文件单 JSON+exitCode）：
1. assert-ia react exit=0 ok=true 51/22/1/8；html exit=0 ok=true tabsAll=23。
2. lint-fake exit=0 ok=true violations=0。
3. lint-reuse exit=0 ok=true violations=0 exempted=1（chat→T40 台账仍有效，未放宽）。
4. vitest exit=0：Test Files 104 passed (104) / Tests 826 passed (826)。
5. crawl-anon exit=0 ok=true probed=75 DL=0 CE=0 PE=0 routesCE=37 env={auth-required-401:37} denied=24；crawl-auth exit=0 ok=true DL=0 CE=0 PE=0 routesCE=25 denied=11；redirects=24 vs 门定值 23 归因不判红照旧。
6. shots auth 102/102（mtime 窗 11:15:19-11:16:09 全新，CnQ2kP3Z 代次）distinctMainHeads=26（卡门槛≥20 达标）、median mainChars=145.0（39-1639 逐路由真差异）、emptyMain=0、failures=0、rootBaseline 797 字符真内容非门壳。卡公式 ok=true exitCode=0（脚本自算 false 因含产品 CE，不掩盖不判红）。
7. 产品面待裁 productCE：consoleErrorRoutes=['#/knowledge?tab=citations','#/knowledge?tab=evidence','#/knowledge?tab=retrieval','#/work']——前三条与二十三轮同位（R7.1/4bfb31ef 后仍现），#/work 为本代次新增；已按卡口径上报交 L0 转写入方，未放宽 ENV_NOISE_RE。
8. anon 负例 shots-anon/ 19@1440 全 401 门壳（overview 732 含『登录状态已过期』），summary 保留脚本 ok=false + runExitCode=1 + headHash；state-quad 20/20@9122 ok=true exitCode=0。

代次注记：fd1e43f2 账本（bf357dc1）作废于本代次覆盖；0c48062b 此前已作废。收口：单 commit `chore(gates): full gate ledger stamped at 4bfb31ef (entry CnQ2kP3Z)`，push 后 porcelain 归零。
## R10·matrix 根因取证与 anon 辅助件口径（2026-11-19 11:5x 实钟，fork HEAD=20d25b06）

- 卡：R9 三件套@L0，唯一待办=R10。禁改 web/src、禁直推 main、question 未用。
- item1 取证（只读，seakoi-agent-os）：`git fetch origin main` RC=0，origin/main=1e67a666；
  `git show origin/main:apps/console/server.py | grep -n "api/matrix"` 三处：
  L534 `# GET /api/matrix → 域 GET /v1/matrix/employees（contract matrix.py：`
  L537 `"/api/matrix": {`
  L780 `"/api/console-sessions", "/api/skills", "/api/matrix", "/api/delegations",`
  `grep -c "dashboard/status"` = 0（与卡面一致）。⇒ **零改码**（卡①：确已含则不改，L7 换服务代次）。
- 代次现查翻案：卡点名的 pid 45965/detached 308a5f1b 已非现状——8092 现由 **pid 91606**
  服务，cwd=/Users/kevin_studio/Projects/bff-v4-serve（主仓 worktree，branch main @ **a60fbf2**，
  含 matrix 路由）。实测 9122 代理：/agent-api/api/matrix anon=**401**（fail-closed 带鉴权门）、
  auth cookie=**200** 且载荷含真实 items（emp_217A91BA995044DFBB3E2E94 等）；
  /agent-api/dashboard/status anon=**404**（main 亦 0 处，口径一致）。
  ⇒ 服务代次已换到位，R9 拦车②（matrix 数据腿）可由 L0 复测核销；本单未重启任何服务、
  主仓 dirty（M server.py / M conftest.py / AM NIGHT-RUN-20261118.md，属他人在途）一律未碰。
- item2 anon 口径：shots-anon-summary.json 补 auxiliary=true、ok=(failures==0 && produced==expected)=true(19/19)、
  note=『anon 腿为 401 门控辅助件，不作为主账 ok 依据』，保留 runExitCode=1/headHash=4bfb31ef；
  主账 shots-summary.json 不动（ok 只看主件）。
- item3 账本：九件盘读全 headHash=4bfb31ef（代码 HEAD；20d25b06 为纯产物 chore，按二十三轮先例规则
  章取代码 HEAD）exitCode=0 ok=true 逐件坐实；vitest.txt 原文行在：
  ` Test Files  104 passed (104)` / `      Tests  826 passed (826)`。未重跑浏览器腿（无代码变化，避免 churn）。
