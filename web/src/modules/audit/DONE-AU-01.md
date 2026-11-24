# DONE · AU-01 事件详情上下文三链接（fixer ses_df554b40f，L0 板 2026-11-24）

- 仓/分支：fork `hermes-agent`，`task/AU-01-run`，基=当拍 `ls-remote origin refs/heads/lane/hermes-console`
  实读 `db793b7b10e77b511a402d4b9475fab25f341cad`（票面预期同值，坐实）。开工前 `ls-remote | grep -i au-01` = 0（无同名抢占）。
- 写域：`web/src/modules/audit/` 四件（新 contextLinks.ts + 新测试件 + states.tsx/views.tsx 接线），
  零越界：server.py/main 未动，AU-02/03/04/06、KB-02/OM-16 未触；域 projection 缺口按表账=转需求单零触碰。
- lanes.yaml：H 仓自登 `au-01-run`（state: external，fork 树免跨仓校验），板笔
  `a1900c1c005c083dc6d69cfa6cc943204ad606ba` 落 main（ls-remote 同值当拍回读）。完工 `worktree remove` 保分支，登记随 close 摘除。

## 判据读数（当拍实跑）

```
$ cd web && PATH="/opt/homebrew/bin:$PATH" pnpm exec vitest run src/modules/audit
Test Files  1 failed | 90 passed (91)
     Tests  3 failed | 704 passed (707)
# 基线对照（开工当拍同命令同窗实读）：3 failed | 696 passed (699)
# 3 红逐枚=audit.time.window.parity.test.tsx R229 预存红（表账在册：禁消禁修、纪律=不新增红）——
# 红名逐字核对同为三例（prints the same instant / swaps the row set / costs one read to open），
# 新增 8 例全绿，零新增红。

$ pnpm exec tsc --noEmit
（无输出=0 错；开工基线同拍实读亦为 0）

$ git diff --stat
（见下节）
```

## 真库覆盖率表（只读采样，步骤①要求，进档于此）

采样命令（只读 GET，同 resourceLinks.ts 头部既有探针谱系）：
`curl -H "X-Tenant-Id: t_seakoi_pilot" http://127.0.0.1:8101/v1/audit/events?from=2026-11-10T00:00:00+08:00&to=2026-11-25T00:00:00+08:00&limit=60` → 200，60 事件。

| action | n | actor | runId | policyDecisionId | correlationId |
|---|---|---|---|---|---|
| budget.ledger_entry_applied | 24 | 24/24 | 24/24 | 0/24 | 24/24 |
| dispatch.event | 18 | 18/18 | 13/18 | 13/18 | 18/18 |
| approval.expired | 6 | 6/6 | 0/6 | 0/6 | 6/6 |
| employee.create.denied | 3 | 3/3 | 0/3 | 0/3 | 3/3 |
| recognition.unknown | 3 | 3/3 | 0/3 | 0/3 | 3/3 |
| channel.event_ingested | 3 | 3/3 | 0/3 | 0/3 | 3/3 |
| approval.decided | 1 | 1/1 | 0/1 | 0/1 | 1/1 |
| approval.denied | 1 | 1/1 | 0/1 | 0/1 | 1/1 |
| budget.ledger_ensured | 1 | 1/1 | 0/1 | 0/1 | 0/1 |
| **TOTAL** | **60** | **60/60** | **37/60** | **13/60** | **59/60** |

actor type 分布：system 49 / service 9 / human 2（id 如 "1"；无 employee 型样本——
链的 employee 正面形态以 fixture 钉，真实分布入表为证）。真实样本三链判读：
run 链 37/60 可跳；判定链 13/60 有值但**无落点**（见下遗留①）；actor 链绝大多数为机器主体
→ 说值不给链，恰证「禁死链」必要。

## 交付形制

`contextLinks.ts`（单表，AU-01 版资源链教义）：
- 谁→身份页：employee 号→`/employees/<裸编号>`（证据 App.tsx:361/1376 路由读径）；
  human/member→`/identity?tab=people`（名录到页不到人——PeopleModulePage.tsx:491
  「Q12 行打开页内详情（零路由）」钉进 title，不假承诺）；system/service→no-page 说值；
  无号→无关联。
- 哪次运行→`/runs?run=<原值>`（RunsModulePage.tsx:1104 `params.get("run")` 当拍复核）。
- 哪次判定→值上屏 + 「本控制台没有该页面」（主仓 BFF-ROUTE-MATRIX.md 缺口#2：P4 读口在、
  上屏待裁定）；缺值→无关联。
`states.tsx` `AuditContextChains`：三行恒显（aud3-chain-actor/run/decision +
data-aud-chain-kind），链=真 `<a target=_blank rel=noreferrer noopener>`（无 onClick 替身）；
短码上屏、全 id 只在 title（资源链同词面纪律）。
`views.tsx`：关联 Section 改恒渲染（链块在前、原关联行 dl 逐字不动——fourfaces/fields.parity
既有钉零触碰）；无 links 的旧事件不再整段消失，「无关联」即答案。

## 文件×行数（git diff --cached --stat 实测）

```
web/src/modules/audit/contextLinks.ts                | 150 +（新，单表三链）
web/src/modules/audit/audit.context.chain.test.tsx   | 243 +（新，8 例：三链正反 + 封闭集 + 抽屉 DOM + 零新请求）
web/src/modules/audit/states.tsx                     | +82/−1（AuditContextChains 渲染）
web/src/modules/audit/views.tsx                      | +15/−6 段（关联 Section 恒渲染，原关联行逐字不动）
4 files changed, 484 insertions(+), 6 deletions(-)
web/src/modules/audit/DONE-AU-01.md（本卡，随同一笔入库）
```

## 遗留（点名不藏）

1. 判定链「接真」卡在产品裁定：P4 判定详情上屏与否=参谋件（主仓矩阵缺口#2 在册）；
   本卡=有值如实报值+明说无页面，落点一旦裁定即进 contextLinks 一行。
2. human actor 到名录不到人（People 零路由现状）——若 L6/参谋要深链到人，属 people 道改动，非本卡写域。
3. R229 三枚预存红未动（纪律），交 L0 按 Q41c 同型注账。
4. 「与 KB-04 citation→run 复用同一路由拼装器」=KB-04 跨仓暂缓（表账在册），本卡 run 拼装
   形制已按可复用函数落（contextLinks 导出面），KB-04 复活时直走此表。
5. 采样面=HTTP 只读 60 事件（≥票面 20 手测要求），非 sqlite 直查；两口径同源（domain 读出）。
