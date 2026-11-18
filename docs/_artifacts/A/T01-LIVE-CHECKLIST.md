# T01 live checklist (22 visible tabs, served build @ http://127.0.0.1:9119)

Raw outputs below, not transcriptions. Probe: ego-browser full page load per
`#/…` form, 1.6s wait, DOM assertions. Generated 2026-11-18 23:4x local from
`hermes_cli/web_dist` (python http.server, lane D's, static — no API backend).

Fixes this round enables the checklist (committed with it):
- `shell/bridge.ts`: boot-time hash snapshot (bootHash). ProfileProvider's
  `?profile=` re-assert commits AFTER App's bridge navigate and stomped it
  back to `/` — PRD `#/…` deep links lost the console route on boot. Snapshot
  captured at module evaluation, replayed until the canonical pathname lands.
- `shell/fixtures.ts` + `shell/console.tsx`: `FixtureBadge` accepts a `state`
  prop; `ConsoleFixtureChrome` computes the override from the router location
  (`parseFixtureState(search, window.location.hash)`) because react-router
  pushState fires neither popstate nor hashchange (T03-CONTRACT caveat).
  `<html data-fixture>` mirror now follows SPA nav.

Gate statics (same commit):
- routes.ts count law at module load: 51 routes / 23 redirect-only forms.
- registry globs `web/src/modules/*/manifest.ts`: 6 manifest files exist
  (board, chat, duty, employee-detail, matrix, runs); the 8-module count is
  `CONSOLE_MODULES` in routes.ts (nav truth). Module-manifest allocation
  across lanes stays an L0 arbitration item.
- `[data-chat-host]` element literal lives in ONE component
  (`ConsoleChatMount`, App.tsx; console.tsx/EmployeeDetailWorkbench only
  carry comments/prop plumbing). Exactly one instance mounts at a time.
- `pnpm --filter web build` EXIT 0 — tail in build.log (stage-2 re-verify).

## 22-tab hash list + live verdicts (raw)

```
#/overview
#/overview?tab=usage
#/employees
#/employees?tab=matrix
#/work
#/work?tab=runs
#/approvals
#/approvals?tab=history
#/identity
#/identity?tab=departments
#/identity?tab=roles
#/knowledge
#/knowledge?tab=sources
#/knowledge?tab=evidence
#/capabilities
#/capabilities?tab=tools
#/capabilities?tab=models
#/capabilities?tab=channels
#/system
#/system?tab=defaults
#/system?tab=version
#/system?tab=events
```

Raw probe lines (full page loads, `laneA-t01-clicks-v2.out`):

```
{"hash":"#/overview","http":200,"status":"ok","rendered":true,"path":"/overview?profile=default","bodyLen":136,"tabnames":1,"activeTab":"duty","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/overview?tab=usage","http":200,"status":"ok","rendered":true,"path":"/overview?profile=default&tab=usage","bodyLen":842,"tabnames":1,"activeTab":"usage","paneState":"ready","chatHosts":0,"plannedDisabled":0}
{"hash":"#/employees","http":200,"status":"ok","rendered":true,"path":"/employees?profile=default","bodyLen":113,"tabnames":1,"activeTab":"list","paneState":"ready","chatHosts":0,"plannedDisabled":0}
{"hash":"#/employees?tab=matrix","http":200,"status":"ok","rendered":true,"path":"/employees?profile=default&tab=matrix","bodyLen":140,"tabnames":1,"activeTab":"matrix","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/work","http":200,"status":"ok","rendered":true,"path":"/work?profile=default","bodyLen":100,"tabnames":1,"activeTab":"board","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/work?tab=runs","http":200,"status":"ok","rendered":true,"path":"/work?profile=default&tab=runs","bodyLen":114,"tabnames":1,"activeTab":"runs","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/approvals","http":200,"status":"ok","rendered":true,"path":"/approvals?profile=default","bodyLen":92,"tabnames":1,"activeTab":"pending","paneState":"ready","chatHosts":0,"plannedDisabled":0}
{"hash":"#/approvals?tab=history","http":200,"status":"ok","rendered":true,"path":"/approvals?profile=default&tab=history","bodyLen":106,"tabnames":1,"activeTab":"history","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/identity","http":200,"status":"ok","rendered":true,"path":"/identity?profile=default","bodyLen":118,"tabnames":1,"activeTab":"people","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/identity?tab=departments","http":200,"status":"ok","rendered":true,"path":"/identity?profile=default&tab=departments","bodyLen":115,"tabnames":1,"activeTab":"departments","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/identity?tab=roles","http":200,"status":"ok","rendered":true,"path":"/identity?profile=default&tab=roles","bodyLen":110,"tabnames":1,"activeTab":"roles","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/knowledge","http":200,"status":"ok","rendered":true,"path":"/knowledge?profile=default","bodyLen":120,"tabnames":1,"activeTab":"spaces","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/knowledge?tab=sources","http":200,"status":"ok","rendered":true,"path":"/knowledge?profile=default&tab=sources","bodyLen":95,"tabnames":1,"activeTab":"sources","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/knowledge?tab=evidence","http":200,"status":"ok","rendered":true,"path":"/knowledge?profile=default&tab=evidence","bodyLen":123,"tabnames":1,"activeTab":"evidence","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/capabilities","http":200,"status":"ok","rendered":true,"path":"/capabilities?profile=default","bodyLen":3378,"tabnames":1,"activeTab":"skills","paneState":"ready","chatHosts":0,"plannedDisabled":0}
{"hash":"#/capabilities?tab=tools","http":200,"status":"ok","rendered":true,"path":"/capabilities?profile=default&tab=tools","bodyLen":10632,"tabnames":1,"activeTab":"tools","paneState":"ready","chatHosts":0,"plannedDisabled":0}
{"hash":"#/capabilities?tab=models","http":200,"status":"ok","rendered":true,"path":"/capabilities?profile=default&tab=models","bodyLen":796,"tabnames":1,"activeTab":"models","paneState":"ready","chatHosts":0,"plannedDisabled":0}
{"hash":"#/capabilities?tab=channels","http":200,"status":"ok","rendered":true,"path":"/capabilities?profile=default&tab=channels","bodyLen":3577,"tabnames":1,"activeTab":"channels","paneState":"ready","chatHosts":0,"plannedDisabled":0}
{"hash":"#/system","http":200,"status":"ok","rendered":true,"path":"/system?profile=default","bodyLen":33,"tabnames":1,"activeTab":"health","paneState":"ready","chatHosts":0,"plannedDisabled":0}
{"hash":"#/system?tab=defaults","http":200,"status":"ok","rendered":true,"path":"/system?profile=default&tab=defaults","bodyLen":134,"tabnames":1,"activeTab":"defaults","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/system?tab=version","http":200,"status":"ok","rendered":true,"path":"/system?profile=default&tab=version","bodyLen":90,"tabnames":1,"activeTab":"version","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"hash":"#/system?tab=events","http":200,"status":"ok","rendered":true,"path":"/system?profile=default&tab=events","bodyLen":132,"tabnames":1,"activeTab":"events","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"probe":"unknown-fallback","landed":"/overview?profile=default","path":"/overview?profile=default","bodyLen":136,"tabnames":1,"activeTab":"duty","paneState":"empty","chatHosts":0,"plannedDisabled":1}
{"summary":{"total":22,"rendered":22,"white":[]}}
```

22/22 render non-white; every hash lands on its canonical path with the
correct active tab; unknown form falls back to /overview (PRD §7).
`paneState` "empty" rows are honest API-less states on the static server
(no backend at :9119), not dead links; `plannedDisabled` marks the honest
`[data-planned]` placeholder panes.

## T03 four-state live legs (raw, post-fix)

```
{"leg":"fixture","want":"loading","path":"/overview?profile=default&state=loading","htmlFixture":"loading","badge":"FIXTURE加载中","paneState":"loading"}
{"leg":"fixture","want":"empty","path":"/overview?profile=default&state=empty","htmlFixture":"empty","badge":"FIXTURE空态","paneState":"empty"}
{"leg":"fixture","want":"error","path":"/overview?profile=default&state=error","htmlFixture":"error","badge":"FIXTURE错误","paneState":"error"}
{"leg":"fixture","want":"ready","path":"/overview?profile=default&state=ready","htmlFixture":"ready","badge":"FIXTURE就绪","paneState":"empty"}
```

## Detail (hidden 详情 tab) + zone deep links (raw)

```
{"hash":"#/employees/EMP-LIVE-PROBE","landed":"/employees/EMP-LIVE-PROBE?profile=default","chatHosts":0,"tabnames":["详情"],"zones":["workbench","config","tasks","runs","evidence"]}
{"hash":"#/employees/EMP-LIVE-PROBE?zone=config","landed":"/employees/EMP-LIVE-PROBE/config?profile=default","chatHosts":0,"tabnames":["详情"],"zones":["workbench","config","tasks","runs","evidence"]}
{"hash":"#/employees/EMP-LIVE-PROBE?zone=runs","landed":"/employees/EMP-LIVE-PROBE/runs?profile=default","chatHosts":0,"tabnames":["详情"],"zones":["workbench","config","tasks","runs","evidence"]}
```

Note (honest): `chatHosts:0` on the static server — the workbench employee
fetch gets the SPA index.html (no backend) → JSON parse error → the detail
error state replaces the pane, so `ConsoleChatMount` never mounts. The DOM
literal is single-sourced in App.tsx `ConsoleChatMount`; with a backend that
resolves the employee, the left cell carries the one `[data-chat-host]`.
`#/employees/:id/workbench` (segment spelling) is NOT a PRD address form —
Appendix A rows 23–27 are `#/employees/:id` + `?zone=…`; the segment paths
are internal react-router representations (rows 24–27 `path`).
