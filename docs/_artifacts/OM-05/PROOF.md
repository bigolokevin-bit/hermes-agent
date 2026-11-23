# OM-05 交付实证 — KPI 缺失/错误态测试面补齐

分支 `task/OM-05`，stacked：OM-01→03→04→本件（合并顺序即此序）。基线 0bb3657b15。

## 改动
- `web/src/modules/overview/OverviewPage.tsx`：员工统计 issue 补 `gap: OVERVIEW_GAP.employees`
  （此前唯一一条不带台账号的 issue，DoD「每条 issue 带 gap 号」的缺口；其余零改动）。
- 新增 `web/src/modules/overview/overview.gaps.test.tsx`：11 例，error 态与 ready-缺字段态分开。

## 覆盖台账（5 条 KPI GAP 逐一点名）
| GAP | error 态 | ready-缺字段态 |
|---|---|---|
| GAP-OV5-EMPLOYEES 员工统计 | 卡值恰「—」+issue「员工统计未接入…」+gap 号+rid+重试钮 | 在岗口径缺 byLifecycle → foot「在岗 —」 |
| GAP-OV5-RUN 运行统计 | 今日运行「—」+issue+rid | summary 缺 kpis → 「—」vs 真零 runs:0 显示 0+「今天还没有运行，失败率不计算」note（title=RUNS） |
| GAP-OV5-APPROVALS 审批统计 | 待审批「—」+issue+rid+重试钮存在 | 缺 pending 字段 → 「—」（不填 0） |
| GAP-OV5-RISK 风险矩阵 | issue+rid | matrix 返回 {} → 「有风险 —」+note「风险口径未接入」title=RISK |
| GAP-OV5-COST 成本账本 | note title=COST + rid（budget-usage 未发起请求＝连坐不白读） | budgetDay {} → 「—」 |
- 另钉**员工目录 500 连坐腿**（真 LiveOverview + stub fetch）：成本卡继承同一错误（rid=req-emp-9），
  `/budget-usage` 请求数 0 —— 证明 `useDutyData.collect` 的 employees-error 连坐是有测试的行为契约，不是巧合。
- 五路全坏例：所有 issue 行 title 均命中 `/^GAP-OV5-/`（禁匿名 issue）。

## DoD 对账
- `vitest run src/modules/overview`：**30 例**（≥15 ✅；既有 19 + 新 11）。
- 每 GAP ≥1 点名断言 ✅（上表 5 条全覆盖，error/缺字段分开）。
- 缺值节点文本恰 `'—'`（toBe 精确，禁空串禁 0）✅；文件内「—」出现 20 处 ≥ 缺值点数。
- `node scripts/lint-fake-success.mjs` → `ok:true, violations:[]`，「未接入」22 处 ✅（exit 0）。

## 门禁
- `vitest run src/modules/overview src/modules/duty src/shell` → **28 files / 300 passed / 1 skipped**
  （skip=e1Contract 未部署腿；build 后该腿比对已部署 hash 为结构性红，判环境不判 diff，口径同 OM-03/04）。
- `vite build` exit **0**。

## 移交注记
- deep doc 测试面条款回写：本 PROOF 可移植（board 写域 L0，未代笔）。
- 今日成本卡的 `usd()` 渲染在 error 态走「—」已由 连坐例钉住；账本实扣口径归 OM-09。
