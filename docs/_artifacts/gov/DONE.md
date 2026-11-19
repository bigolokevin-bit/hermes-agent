# 波 3 治理组 — T20 / T21 / T23 / T24

Worktree: `/Users/kevin_studio/Projects/forks/console-gov` · branch `lane/console-gov` · base `c28ebc16`.
Write domain: `web/src/modules/{people,org,settings,version}/**`, `docs/_artifacts/gov/**`.
No App/routes/shell/registry/manifest/package.json/lockfile changes.

## Commits

| Page | Commit | Status |
|---|---|---|
| people 人员目录 | `235ee9f5` | testids aligned to `ppl4-`; 9 tests |
| org 组织与部门 | `f94c49ce` | testids aligned to `org4-`; 9 tests |
| settings 默认设置 | `d9b20e26` + `a0a25304` | removed engineering copy (CR-M2-02), reasons now match enabled/disabled/unknown/not-landed; 4 tests |
| version 版本 | `f205b27d` | removed V4/script jargon, Beijing time normalized to `YYYY-MM-DD HH:mm`; 3 tests |

## Data truth

- people: candidates `/agent-api/api/v1/user/list`, `/all`; no verified BFF route in this worktree →
  honest `待核实（GAP-02）`, no fabricated rows. Live 200 not fetched.
- org: candidates `/agent-api/api/v1/dept/list`, `/tree`; same GAP-02, empty/apply guidance kept.
- settings: `/agent-api/api/config`; 404 → explicit `未启用` per switch with reason; no save/reset control,
  only real links to `#/system` and `#/employees`. Live 200 not fetched.
- version: build identity/ref/commit/time are read from `VITE_BUILD_*`; this worktree has none → `未知`
  with reason. Dependency versions come from `package.json`. Live 200 not applicable.

## Commands + raw stdout

```bash
$ cd /Users/kevin_studio/Projects/forks/console-gov/web
$ ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0
```

```bash
$ pnpm exec vitest run src/modules/people src/modules/org src/modules/settings src/modules/version
 Test Files  4 passed (4)
      Tests  25 passed (25)
```

```bash
# Chrome CDP, all four sections on one preview page (temporary preview removed before commit):
{"w":1440,"sw":1440,"parts":[{"id":"p-people","sw":1397,"cw":1395},{"id":"p-org","sw":1397,"cw":1395},{"id":"p-settings","sw":1397,"cw":1395},{"id":"p-version","sw":1395,"cw":1395}]}
{"w":375,"sw":375,"parts":[{"id":"p-people","sw":330,"cw":330},{"id":"p-org","sw":332,"cw":330},{"id":"p-settings","sw":330,"cw":330},{"id":"p-version","sw":330,"cw":330}]}
ERRORS:0
# body scrollWidth equals viewport at both widths; no page-level horizontal overflow.
# org has a 2px internal section scrollWidth delta at 375 (no body overflow), noted as residual.
```

## Screenshots

- `docs/_artifacts/gov/shots/gov-1440.png`
- `docs/_artifacts/gov/shots/gov-375.png`

## Honest gaps

- Live BFF/毕升 user/dept endpoints were not available; GAP-02 states are exercised by tests, not a live 200.
- Pages are still mounted by the shell lane (no App/manifest change here); preview harness was used for layout proof.
- Org's 2px per-section scroll delta at 375 is internal only; body never exceeds 375.
