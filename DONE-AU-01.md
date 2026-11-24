# DONE · AU-01 事件详情上下文关联补链（aud 车道，2026-11-24）

- 仓/分支：fork `hermes-agent`，`task/AU-01-run`。基=当拍盘读 `db793b7b10e77b511a402d4b9475fab25f341cad`
  （`git worktree` 现读，勿换基坐实）。本卡为**收口补全腿**：主体实装已由并行实例先行落笔
  （`148ca879a5` 三链接+契约 8 例、`cbc7e72d5c` 采样证据入档；总控已并 `ce5e5a098d` 进 lane/hermes-console）。
  本腿纪律=禁重做，只做核验（既有三件 resourceLinks.ts/model.ts/audit.detail.resource.link.test.tsx
  diff=0 行，`git diff db793b7b10..HEAD` 亲验）+补缺口：494 事件全窗四键表、门禁全套原始 stdout、
  活体截图两档、e1 漂移单列读数、主仓需求单、板仓转办、DONE 归位根目录（票面位=worktree 根；
  原实例误置 `web/src/modules/audit/`，本腿 `git mv` 归位）。

## 交付形制（核验记录）

`web/src/modules/audit/contextLinks.ts`（150 行单表，禁死链教义同 resourceLinks.ts）：
- **谁→身份页**：employee/agent/bot 号→`/employees/<裸编号>`（App.tsx:1376/361 读径注账）；
  human/member→`/identity?tab=people` 到名录不到人（PeopleModulePage.tsx:491「Q12 零路由」钉 title，
  不假承诺）；system/service→说值不给链；无号→「无关联」。
- **哪次运行→`/runs?run=<原值>`**（RunsModulePage.tsx:1104 `params.get("run")` 当拍复核）。
  traceId 全窗 0 样本（见需求单②），run 链只认 runId，不拿 correlation 凑。
- **哪次判定**：policyDecisionId 带回→值上屏+「本控制台没有该页面」（主仓 BFF-ROUTE-MATRIX.md 缺口#2 待裁）；
  缺值→「无关联」。
- `states.tsx` `AuditContextChains`：三行恒显（`aud3-chain-actor/run/decision` + `data-aud-chain-kind`），
  链=真 `<a target=_blank rel="noreferrer noopener">` 无 onClick 替身；短码上屏、全 id 只在 title。
- `views.tsx` 关联 Section 恒渲染（链块在前，原关联行逐字不动）。词表统一：缺失=「无关联」，
  与 evidence 五跳（PRD L94/L100 ChannelEvent→IdentityLink→PolicyDecision→Run→OutboundAttempt）
  同名词形制「名词：值/无关联」。
- 拼装器 `actorChainOf/runChainOf/decisionChainOf/auditChainsOf` 导出面即 KB-04 citation→run
  深链的复用点（步骤④，跨卡协调登记于原 DONE 遗留④）。
- 本腿唯一代码改动=`audit.context.chain.test.tsx` 负例强化 +5 行：缺字段链位断言
  `tagName==="SPAN"` 且 `querySelectorAll("a,button")` 长度 0（票面「零 <a>/零钮」逐字钉死）。

## 接口原文摘要（opsadmin 真登录腿，只读 GET 经 :8092 真 BFF）

```
$ curl -H "Cookie: access_token_cookie=<~/.seakoi/opsadmin-token.txt>" \
    "http://127.0.0.1:8092/api/audit?from=2026-10-25T00:19:53Z&to=2026-11-24T00:19:53Z&limit=50"
200
{"events": [{"eventId": "ev_993E70D4E6FA4F559259879455", … "actor": {"type": "system", "id": "employee-api"},
"action": "employee.create.denied", "resource": {"type": "creation_attempt", …
top keys: events,nextCursor,limit,cursor,hasMore,total,totalSource  total=494 → 分页 10 页全取，
原始 JSON=evidence/au01-audit-p1..p10.json（已随 cbc7e72d5c 入档）

$ curl … "http://127.0.0.1:8092/api/audit-detail?id=ev-dispatch-8af0c2546ed788cf251aeebe04"
200  body keys: eventId,schemaVersion,tenantId,occurredAt,recordedAt,sourceSystem,actor,action,resource,
outcome,onBehalfOf,responsibleUnresolvedReason,decision,runId,policyDecisionId,employeeVersionRef,after,correlationId
（A4 详情 runId/policyDecisionId/correlationId 三键原样透传实证，前端三链读径成立；
原响应=evidence/au01-detail-probe.json）

$ curl -H "Cookie: access_token_cookie=…" http://127.0.0.1:9122/auth/whoami
200 {"user_id": 1, "tenant_id": null, "granted": true, "display": "opsadmin"}
```

## 四键覆盖率表（步骤①；分母=入档证据 494 事件全窗，`node -e` 当拍重算，原 stdout=evidence/au01-coverage-494.md）

判据：actor=actor.id 非空；run=runId；trace=traceId/trace_id；decision=policyDecisionId；correlation=correlationId。

| action | n | actor | run | trace | decision | correlation |
|---|---|---|---|---|---|---|
| budget.ledger_entry_applied | 195 | 195/195 | 195/195 | 0/195 | 0/195 | 195/195 |
| dispatch.event | 164 | 164/164 | 80/164 | 0/164 | 136/164 | 164/164 |
| employee.create.denied | 25 | 25/25 | 0/25 | 0/25 | 0/25 | 25/25 |
| recognition.unknown | 17 | 17/17 | 0/17 | 0/17 | 0/17 | 16/17 |
| task.created | 14 | 14/14 | 0/14 | 0/14 | 0/14 | 14/14 |
| approval.expired | 12 | 12/12 | 0/12 | 0/12 | 0/12 | 12/12 |
| workstation.bound | 10 | 10/10 | 0/10 | 0/10 | 0/10 | 10/10 |
| budget.ledger_ensured | 8 | 8/8 | 0/8 | 0/8 | 0/8 | 0/8 |
| approval.decided | 7 | 7/7 | 0/7 | 0/7 | 0/7 | 7/7 |
| workstation.unbound | 7 | 7/7 | 0/7 | 0/7 | 0/7 | 7/7 |
| grant.created | 6 | 6/6 | 0/6 | 0/6 | 0/6 | 6/6 |
| employee.version.created | 5 | 5/5 | 0/5 | 0/5 | 0/5 | 5/5 |
| approval.consumed | 5 | 5/5 | 0/5 | 0/5 | 0/5 | 5/5 |
| employee.lifecycle.transitioned | 4 | 4/4 | 0/4 | 0/4 | 0/4 | 4/4 |
| channel.event_ingested | 3 | 3/3 | 0/3 | 0/3 | 0/3 | 3/3 |
| employee.created | 3 | 3/3 | 0/3 | 0/3 | 0/3 | 3/3 |
| budget.soft_alert_sent | 3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 |
| approval.denied | 2 | 2/2 | 0/2 | 0/2 | 0/2 | 2/2 |
| employee.lifecycle.denied | 2 | 2/2 | 0/2 | 0/2 | 0/2 | 2/2 |
| employee.updated | 1 | 1/1 | 0/1 | 0/1 | 0/1 | 1/1 |
| workstation.bind_conflict | 1 | 1/1 | 0/1 | 0/1 | 0/1 | 1/1 |
| **合计** | **494** | **494/494** | **275/494** | **0/494** | **139/494** | **485/494** |

补充读数：扁平 `decision` 枚举面 472/494（not_applicable 275/allow 90/deny 84/rejected 12/approved 10/require_approval 1）；
actor.type 分布 system 442/service 29/human 23（human id 如 "1"；employee 型 0 样本，链正面形态以 fixture 钉）。
原实例 :8101 六十事件表（actor 60/60、run 37/60、pd 13/60、corr 59/60）与本表同形制互证；本表分母为入档文件，可复核。
**覆盖矩阵 L24「事件体是否恒带 correlation」判读：非恒带**——485/494，缺于 budget.ledger_ensured（8/8 全缺）与
recognition.unknown（1/17）；前端该类链恒显「无关联」为真实答案，非缺陷。traceId 键在域事件体 0 出现。

## 门禁原始 stdout（全部当拍实跑；开工/收工两份 tail 对账）

- **开工**（`cd web && node_modules/.bin/vitest run src/modules/audit`，evidence/au01-vitest-baseline.log）：
  `Test Files 1 failed | 90 passed (91)` / `Tests 3 failed | 704 passed (707)`。
  注账：票面基线「699 例中 3 红」为开工指令口径；开工当拍盘读工作树已含并行实例的 8 例链测试，
  原始 tail 即 707/3，无 699 原始 stdout 存在（禁编造，以盘为准）。红名逐枚=`prints the same instant…`/
  `swaps the row set…`/`costs one read to open…`=audit.time.window.parity.test.tsx R229 预存三枚，未修未消（已报 L0）。
- **收工**（同命令，evidence/au01-vitest-final.log）：`3 failed | 704 passed (707)`——总数不降、
  红恰为预存三枚、零新增红（本腿强化断言并入既有用例，不加例数）。
- **全量**（`vitest run src`，evidence/au01-vitest-full-final.log）：`Test Files 1 failed | 542 passed (543)` /
  `Tests 3 failed | 4183 passed | 1 skipped (4187)`；三红仍=R229 逐名一致；1 skipped=e1Contract
  （该跑次在 build 前，dist 未生成⇒自报 SKIPPED-NOT-DEPLOYED 路径，非消解）。
- **e1Contract 单独腿**（build 后补跑，evidence/au01-e1contract-leg.log）：**红=部署漂移闸，按票面豁免单列禁消解**：
  `PORT=9122 DISK_ENTRY=assets/index-Ba7hC9Wo.js SERVED_ENTRY=assets/index-CtA6doEj.js`
  （served≠disk 为本 worktree 新代次 vs 9122 现服代次之差；非产品红，9122 归总控发布节拍，本腿未动）。
- **build**（`node_modules/.bin/vite build`，evidence/au01-vite-build.log）：exit 0，产物 `hermes_cli/web_dist`。
  未用 pnpm run build（tsc -b 预存错非本道判据），未 pnpm install（symlink 纪律）。
- **lint**（`node web/scripts/lint-fake-success.mjs`，evidence/au01-lint-fake-success.log）：
  `"violations": [] , "ok": true`。
- **tsc**（`node_modules/.bin/tsc --noEmit -p tsconfig.app.json`，evidence/au01-tsc.log）：
  49 error 全在 `../apps/shared/src/*.test.ts`（预存基线，delta=0）；`grep -c modules/audit`=0 错。

## 截图（du01-shoot 形制：本 worktree build 产物 + 临时同源代理 :9262 反代 /agent-api→8092 + opsadmin cookie）

- 配方：`evidence/au01-proxy.mjs`/`au01-shoot.mjs`（lineage du01）；goto=domcontentloaded+settle ≥2s，
  每图前 whoami==200 断言（`user=opsadmin`），视口图，375 验横向溢出。
- `evidence/au01-1440.png`/`evidence/au01-375.png`：事件详情三链实态（真库事件
  `ev-dispatch-8af0c2546ed788cf251aeebe04`）——谁：系统 · worker（说值不给链）｜哪次运行：运行 · KKTEVZG1
  真锚 href=`/runs?run=rn_01M81AZV6P7TAX8KGXKKTEVZG1`｜哪次判定：策略判定 · 42A78328（说而不链）。
  横向溢出 0/0；读口 `audit-detail` 200 + `audit` 200 当拍实录（evidence/au01-shoot.log）。
- 「无关联」渲染真态（缺字段事件）由契约例钉（DOM 级 SPAN+零 <a> 零钮），抽样真库另腿未拍——票面该分支仅
  「若抽样事件无关联字段」兜底语，本机样本事件带字段，按实拍三链实态交付。
- 代理用完按 pid 61569 精杀（kill 后 `lsof :9262`=0 LISTEN）；未触 9122/colima/docker/共享栈。

## 主仓 projection 需求单（只登记零触碰，同 AP-08 先例）

期望端点=域 `GET /v1/audit/events*`（A3）/`GET /v1/audit/events/{id}`（A4）事件体，主仓 `services/domain/audit.py`/`audit_query.py`：
1. **判定链落点**：policyDecisionId 已投影（139/494），卡的是控制台无 P4 判定详情上屏（主仓 BFF-ROUTE-MATRIX.md 缺口#2）——
   裁定后 `contextLinks.ts` decisionChainOf 一行接表即通。
2. **trace 腿**：`traceId`/`trace_id` 键全窗 0/494——PRD 链1 correlation 若含 trace 语义，域投影需补该键或明写不补；
   前端现以 runId 驱动运行链，trace 恒「无关联」为真实答案。
3. **correlation 恒带性**：`budget.ledger_ensured`（8/8）与部分 `recognition.unknown`（1/17）事件生成侧未带
   correlationId——属各 action 写口补键问题（非 A3/A4 投影丢失），供审计写入道排期。

## 板仓转办（L0）

`docs/product/CONSOLE-COVERAGE-MATRIX.md` L24「上下文」列销账口径：三链前端腿已交付（本卡），correlation
恒带性判读=非恒带（485/494，缺于 ledger_ensured/recognition，见需求单③），traceId 0 样本（需求单②），
判定落点待裁（需求单①）。矩阵行文更新由总控执笔（本道禁碰板仓）。

## 偏差如实

1. 现场竞态：本腿开工自查时 worktree 干净（HEAD=db793b7b10），采样/基线进行中并行实例完成主体实装并
   commit+push+merge，且 `worktree remove` 掉目录（原始 JSON/基线日志恰被 cbc7e72d5c 收编入档——内容为本腿
   :8092 采样，commit message 误标 :8101；本表以入档文件为准重算覆盖）。本腿以 `git worktree add` 复位后
   走核验-补全路线，零重做。
2. DONE 位置：票面=worktree 根；原实例置 modules/audit 内，本腿 `git mv` 归位（内容并入上方全部）。
3. evidence 提交面：png/日志/脚本超出「只改写域」字面，沿 cbc7e72d5c 已裁先例（防 prune 灭证），逐文件 add。
4. 开工基线 699 无原始 stdout（见门禁注账）；收工对账以盘为 707/3。
5. 采样腿 whoami 在 :8092 `/api/auth/whoami` 返 404 console.unknown_route（BFF 无该路由），登录证据以 :9122
   `/auth/whoami`=200 为准（原文已贴）。
