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
- `docs/_artifacts/D/1-assert-ia-html.txt` … `5-lint-reuse.txt` (five raw gate logs) and `docs/_artifacts/D/DONE.md` (this file). `docs/_artifacts/D/6-commit-hook-blocked.txt` exists on disk in this worktree but is intentionally left uncommitted.
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
